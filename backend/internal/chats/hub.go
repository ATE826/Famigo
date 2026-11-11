package chats

import (
	"encoding/json"
	"log/slog"
	"sync"

	"github.com/google/uuid"
)

// Hub — «коммутатор» WebSocket-подключений. Он знает, какие подключения открыты
// у каждого пользователя (телефон, ноутбук, несколько вкладок), и рассылает им события.
// Кому что отправлять, решает не hub, а сервис: hub получает готовый список получателей,
// который сервис берёт из базы (участники чата). Поэтому чужие сообщения сюда не попадут.
type Hub struct {
	mu      sync.RWMutex
	clients map[uuid.UUID]map[*Client]struct{}
	log     *slog.Logger
}

// Больше подключений с одного аккаунта не держим: иначе можно открыть тысячи
// соединений и занять память сервера.
const maxConnectionsPerUser = 10

func NewHub(log *slog.Logger) *Hub {
	return &Hub{clients: map[uuid.UUID]map[*Client]struct{}{}, log: log}
}

// add регистрирует подключение. false — у пользователя уже слишком много подключений.
func (h *Hub) add(c *Client) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	set := h.clients[c.userID]
	if len(set) >= maxConnectionsPerUser {
		return false
	}
	if set == nil {
		set = map[*Client]struct{}{}
		h.clients[c.userID] = set
	}
	set[c] = struct{}{}
	return true
}

func (h *Hub) remove(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if set, ok := h.clients[c.userID]; ok {
		delete(set, c)
		if len(set) == 0 {
			delete(h.clients, c.userID)
		}
	}
}

// SendTo отправляет событие всем подключениям перечисленных пользователей.
// Медленный клиент не тормозит остальных: см. Client.enqueue.
func (h *Hub) SendTo(userIDs []uuid.UUID, event any) {
	data, err := json.Marshal(event)
	if err != nil {
		h.log.Error("не удалось закодировать событие", "err", err)
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, id := range userIDs {
		for c := range h.clients[id] {
			c.enqueue(data)
		}
	}
}
