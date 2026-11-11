package chats

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/ATE826/Famigo/backend/internal/httpx"
)

// Одно WebSocket-подключение. У каждого две горутины:
//   - readPump читает команды клиента (отправить сообщение, отметить прочитанным);
//   - writePump пишет события клиенту и раз в pingPeriod шлёт ping.
// Если клиент не отвечает на ping дольше pongWait — соединение считается мёртвым и закрывается.
//
// Соединение живёт не дольше maxLifetime (как access-токен), потом сервер его закрывает,
// а фронтенд сразу переподключается с новым билетом. Так после выхода со всех устройств,
// смены пароля или удаления аккаунта старое соединение не будет получать сообщения вечно:
// новый билет без действующей сессии не выдадут.

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = 25 * time.Second
	// Сообщение в чате — до 2000 символов (до 8000 байт в UTF-8) плюс служебные поля.
	maxIncomingBytes = 16 << 10
	sendQueue        = 64
	maxLifetime      = 15 * time.Minute
)

// SessionCheckPeriod — как часто открытое соединение проверяет, что сессия входа жива.
// После выхода, смены пароля или «выйти везде» соединение закроется не позже чем через этот срок.
// Переменная, а не константа, чтобы тест мог ускорить проверку.
var SessionCheckPeriod = 20 * time.Second

type Client struct {
	hub       *Hub
	service   *Service
	conn      *websocket.Conn
	userID    uuid.UUID
	sessionID uuid.UUID
	send      chan []byte

	mu     sync.Mutex
	closed bool
}

// incoming — команда от клиента.
type incoming struct {
	Type     string `json:"type"`
	FamilyID string `json:"familyId"`
	ChatID   string `json:"chatId"`
	Text     string `json:"text"`
	// ClientID — метка, которую фронтенд ставит на своё сообщение до ответа сервера,
	// чтобы потом заменить «отправляется…» на настоящее сообщение.
	ClientID string `json:"clientId"`
}

type errorEvent struct {
	Type     string            `json:"type"`
	ClientID string            `json:"clientId,omitempty"`
	Code     string            `json:"code"`
	Message  string            `json:"message"`
	Fields   map[string]string `json:"fields,omitempty"`
}

// enqueue ставит данные в очередь на отправку. Если очередь переполнена (клиент не успевает
// читать), подключение закрывается: фронтенд переподключится и догрузит пропущенное.
func (c *Client) enqueue(data []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return
	}
	select {
	case c.send <- data:
	default:
		c.closed = true
		close(c.send)
	}
}

// close закрывает очередь; writePump увидит это и закроет соединение.
func (c *Client) close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.closed {
		c.closed = true
		close(c.send)
	}
}

func (c *Client) readPump() {
	defer func() {
		c.hub.remove(c)
		c.close()
		c.conn.Close()
	}()
	c.conn.SetReadLimit(maxIncomingBytes)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		var msg incoming
		if err := c.conn.ReadJSON(&msg); err != nil {
			return // клиент закрыл соединение, превышен размер или пришёл не JSON
		}
		c.handle(msg)
	}
}

func (c *Client) handle(msg incoming) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	familyID, err1 := uuid.Parse(msg.FamilyID)
	chatID, err2 := uuid.Parse(msg.ChatID)
	if err1 != nil || err2 != nil {
		c.reply(errorEvent{Type: "error", ClientID: msg.ClientID, Code: "not_found", Message: "Чат не найден"})
		return
	}

	// Общий лимит команд: каждая команда — запрос к базе, а обычный лимит запросов
	// по IP на кадры WebSocket не действует.
	if !c.service.commandLimiter.Allow(c.userID.String()) {
		c.replyError(msg.ClientID, httpx.TooManyRequests())
		return
	}

	var err error
	switch msg.Type {
	case "send":
		v := httpx.NewValidator()
		text := v.MultilineText("text", msg.Text, 1, 2000)
		v.Check(len(msg.ClientID) <= 64, "clientId", "Слишком длинный clientId")
		if err = v.Err(); err == nil {
			_, err = c.service.Send(ctx, familyID, chatID, c.userID, text, msg.ClientID)
		}
	case "read":
		err = c.service.MarkRead(ctx, familyID, chatID, c.userID)
	default:
		err = httpx.BadRequest("unknown_type", "Неизвестная команда")
	}
	if err != nil {
		c.replyError(msg.ClientID, err)
	}
}

func (c *Client) replyError(clientID string, err error) {
	appErr, ok := err.(*httpx.Error)
	if !ok {
		c.service.log.Error("ошибка WebSocket", "err", err)
		appErr = &httpx.Error{Code: "internal", Message: "Внутренняя ошибка сервера"}
	}
	c.reply(errorEvent{Type: "error", ClientID: clientID, Code: appErr.Code, Message: appErr.Message, Fields: appErr.Fields})
}

// reply — ответ только этому подключению (например, ошибка отправки).
func (c *Client) reply(event any) {
	if data, err := json.Marshal(event); err == nil {
		c.enqueue(data)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	lifetime := time.NewTimer(maxLifetime)
	sessionCheck := time.NewTicker(SessionCheckPeriod)
	defer func() {
		ticker.Stop()
		sessionCheck.Stop()
		lifetime.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case <-sessionCheck.C:
			if !c.service.sessionAlive(c.userID, c.sessionID) {
				c.conn.WriteControl(websocket.CloseMessage,
					websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "session ended"),
					time.Now().Add(writeWait))
				return
			}
		case <-lifetime.C:
			c.conn.WriteControl(websocket.CloseMessage,
				websocket.FormatCloseMessage(websocket.CloseNormalClosure, "reconnect"),
				time.Now().Add(writeWait))
			return
		case data, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
