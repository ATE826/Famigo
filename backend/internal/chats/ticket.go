package chats

import (
	"crypto/rand"
	"encoding/base64"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Как WebSocket узнаёт, кто подключился.
// Браузер не умеет добавлять заголовок Authorization к WebSocket. Класть access-токен
// в адрес (?token=...) опасно: адреса попадают в логи прокси и историю браузера.
// Поэтому так:
//  1. фронтенд обычным защищённым запросом получает «билет» — случайную строку;
//  2. открывает WebSocket с ?ticket=...;
//  3. сервер принимает билет один раз и только в течение 30 секунд.
// Даже если билет попадёт в лог, воспользоваться им уже нельзя.

const ticketTTL = 30 * time.Second

// Ограничение на число неиспользованных билетов в памяти.
const maxTickets = 10_000

type ticket struct {
	userID    uuid.UUID
	sessionID uuid.UUID
	expires   time.Time
}

type TicketStore struct {
	mu      sync.Mutex
	tickets map[string]ticket
}

func NewTicketStore() *TicketStore { return &TicketStore{tickets: map[string]ticket{}} }

// Issue выдаёт новый одноразовый билет для сессии sessionID.
func (s *TicketStore) Issue(userID, sessionID uuid.UUID) (string, bool) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", false
	}
	value := base64.RawURLEncoding.EncodeToString(buf)

	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	if len(s.tickets) >= maxTickets {
		for k, t := range s.tickets {
			if now.After(t.expires) {
				delete(s.tickets, k)
			}
		}
		if len(s.tickets) >= maxTickets {
			return "", false
		}
	}
	s.tickets[value] = ticket{userID: userID, sessionID: sessionID, expires: now.Add(ticketTTL)}
	return value, true
}

// Consume проверяет билет и сразу его уничтожает: второй раз он не сработает.
func (s *TicketStore) Consume(value string) (userID, sessionID uuid.UUID, ok bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	t, found := s.tickets[value]
	if !found {
		return uuid.Nil, uuid.Nil, false
	}
	delete(s.tickets, value)
	if time.Now().After(t.expires) {
		return uuid.Nil, uuid.Nil, false
	}
	return t.userID, t.sessionID, true
}
