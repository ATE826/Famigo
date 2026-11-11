package chats

import (
	"net/http"
	"slices"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/ATE826/Famigo/backend/internal/auth"
	"github.com/ATE826/Famigo/backend/internal/families"
	"github.com/ATE826/Famigo/backend/internal/httpx"
)

type Handler struct {
	service  *Service
	hub      *Hub
	tickets  *TicketStore
	upgrader websocket.Upgrader
	// Фронтенд берёт билет при каждом (пере)подключении — это несколько раз в минуту.
	// Лимит не даёт одному человеку забить хранилище билетов и помешать остальным.
	ticketLimiter *httpx.RateLimiter
}

func NewHandler(service *Service, hub *Hub, allowedOrigins []string) *Handler {
	h := &Handler{service: service, hub: hub, tickets: NewTicketStore(), ticketLimiter: httpx.NewRateLimiter(30, 10)}
	h.upgrader = websocket.Upgrader{
		ReadBufferSize:  4096,
		WriteBufferSize: 4096,
		// Защита от CSWSH (перехвата WebSocket чужим сайтом): подключаться можно
		// только со страниц нашего фронтенда.
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			return origin == "" || slices.Contains(allowedOrigins, origin) ||
				origin == "http://"+r.Host || origin == "https://"+r.Host
		},
	}
	return h
}

// RegisterRoutes: authed — для вошедших, family — для участников семьи,
// public — подключение WebSocket (вход по одноразовому билету, а не по токену).
func (h *Handler) RegisterRoutes(authed, family, public *gin.RouterGroup) {
	authed.POST("/chats/ws-ticket", h.wsTicket)
	public.GET("/chats/ws", h.ws)

	family.GET("/chats", h.list)
	family.POST("/chats/direct", h.openDirect)
	family.PATCH("/chats/:chatID", h.updateSettings)
	family.GET("/chats/:chatID/messages", h.messages)
	family.POST("/chats/:chatID/messages", h.send)
	family.DELETE("/chats/:chatID/messages/:messageID", h.deleteMessage)
	family.POST("/chats/:chatID/read", h.markRead)
}

func (h *Handler) list(c *gin.Context) {
	items, err := h.service.List(c.Request.Context(), families.FamilyID(c), auth.UserID(c))
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, gin.H{"items": items})
}

type directRequest struct {
	UserID uuid.UUID `json:"userId"`
}

func (h *Handler) openDirect(c *gin.Context) {
	var req directRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	chatID, err := h.service.OpenDirect(c.Request.Context(), families.FamilyID(c), auth.UserID(c), req.UserID)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, gin.H{"chatId": chatID})
}

// messages: страница от новых к старым; следующая — ?before=<createdAt самого старого>.
func (h *Handler) messages(c *gin.Context) {
	chatID, err := httpx.ParamUUID(c, "chatID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	var before *time.Time
	if value := c.Query("before"); value != "" {
		t, err := time.Parse(time.RFC3339Nano, value)
		if err != nil {
			httpx.Respond(c, httpx.BadRequest("invalid_query", "Неверный параметр before"))
			return
		}
		before = &t
	}
	items, err := h.service.Messages(c.Request.Context(), families.FamilyID(c), chatID, auth.UserID(c), before, httpx.QueryLimit(c, 50, 100))
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, gin.H{"items": items})
}

type sendRequest struct {
	Text string `json:"text"`
}

// send: текст хранится как есть и отдаётся как JSON-строка. React показывает его
// текстом, а не HTML, поэтому <script> в сообщении просто отобразится символами (защита от XSS).
func (h *Handler) send(c *gin.Context) {
	userID := auth.UserID(c)
	chatID, err := httpx.ParamUUID(c, "chatID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	var req sendRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	v := httpx.NewValidator()
	text := v.MultilineText("text", req.Text, 1, 2000)
	if err := v.Err(); err != nil {
		httpx.Respond(c, err)
		return
	}
	msg, err := h.service.Send(c.Request.Context(), families.FamilyID(c), chatID, userID, text, "")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.Created(c, msg)
}

func (h *Handler) deleteMessage(c *gin.Context) {
	chatID, err := httpx.ParamUUID(c, "chatID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	messageID, err := httpx.ParamUUID(c, "messageID")
	if err == nil {
		err = h.service.DeleteMessage(c.Request.Context(), families.FamilyID(c), chatID, messageID, auth.UserID(c))
	}
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.NoContent(c)
}

func (h *Handler) markRead(c *gin.Context) {
	chatID, err := httpx.ParamUUID(c, "chatID")
	if err == nil {
		err = h.service.MarkRead(c.Request.Context(), families.FamilyID(c), chatID, auth.UserID(c))
	}
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.NoContent(c)
}

type settingsRequest struct {
	Muted  *bool `json:"muted"`
	Pinned *bool `json:"pinned"`
}

func (h *Handler) updateSettings(c *gin.Context) {
	chatID, err := httpx.ParamUUID(c, "chatID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	var req settingsRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	if err := h.service.UpdateSettings(c.Request.Context(), families.FamilyID(c), chatID, auth.UserID(c), req.Muted, req.Pinned); err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.NoContent(c)
}

// wsTicket выдаёт одноразовый билет для подключения к WebSocket (см. ticket.go).
func (h *Handler) wsTicket(c *gin.Context) {
	userID := auth.UserID(c)
	if !h.ticketLimiter.Allow(userID.String()) {
		httpx.Respond(c, httpx.TooManyRequests())
		return
	}
	ticket, ok := h.tickets.Issue(userID, auth.SessionID(c))
	if !ok {
		httpx.Respond(c, httpx.TooManyRequests())
		return
	}
	httpx.OK(c, gin.H{"ticket": ticket, "expiresIn": int(ticketTTL.Seconds())})
}

// ws — подключение WebSocket: GET /api/chats/ws?ticket=...
func (h *Handler) ws(c *gin.Context) {
	userID, sessionID, ok := h.tickets.Consume(c.Query("ticket"))
	if !ok {
		httpx.Respond(c, httpx.Unauthorized("Билет недействителен, получите новый"))
		return
	}
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return // upgrader уже ответил клиенту ошибкой (например, чужой Origin)
	}
	client := &Client{hub: h.hub, service: h.service, conn: conn, userID: userID, sessionID: sessionID, send: make(chan []byte, sendQueue)}
	if !h.hub.add(client) {
		conn.WriteControl(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "too many connections"),
			time.Now().Add(writeWait))
		conn.Close()
		return
	}
	go client.writePump()
	client.readPump()
}
