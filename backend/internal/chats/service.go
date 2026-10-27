package chats

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/auth"
	"github.com/ATE826/Famigo/backend/internal/fieldcrypt"
	"github.com/ATE826/Famigo/backend/internal/httpx"
)

type Service struct {
	db  *gorm.DB
	hub *Hub
	log *slog.Logger
	// cipher шифрует текст сообщений в базе (см. encryption.go).
	cipher *fieldcrypt.Cipher
	// Защита от спама: не больше 60 сообщений в минуту от одного человека —
	// одинаково для REST и WebSocket.
	sendLimiter *httpx.RateLimiter
	// commandLimiter — все команды WebSocket (отправка, «прочитано») от одного человека.
	commandLimiter *httpx.RateLimiter
}

func NewService(db *gorm.DB, hub *Hub, log *slog.Logger, cipher *fieldcrypt.Cipher) *Service {
	return &Service{db: db, hub: hub, log: log, cipher: cipher, sendLimiter: httpx.NewRateLimiter(60, 20),
		commandLimiter: httpx.NewRateLimiter(240, 60)}
}

var errChatNotFound = httpx.NotFound("Чат не найден")

// access — проверка перед любым действием с чатом: чат из этой семьи и пользователь его участник.
func (s *Service) access(ctx context.Context, familyID, chatID, userID uuid.UUID) error {
	ok, err := isChatMember(s.db.WithContext(ctx), familyID, chatID, userID)
	if err != nil {
		return err
	}
	if !ok {
		return errChatNotFound
	}
	return nil
}

// broadcast рассылает событие участникам чата. Список берётся из базы в момент отправки,
// поэтому человек, которого удалили из семьи, новых сообщений уже не получит.
func (s *Service) broadcast(ctx context.Context, chatID uuid.UUID, event any) {
	ids, err := memberIDs(s.db.WithContext(ctx), chatID)
	if err != nil {
		s.log.Error("не удалось получить участников чата", "err", err)
		return
	}
	s.hub.SendTo(ids, event)
}

func (s *Service) List(ctx context.Context, familyID, userID uuid.UUID) ([]Chat, error) {
	return listChats(s.db.WithContext(ctx), s.cipher, familyID, userID)
}

func (s *Service) OpenDirect(ctx context.Context, familyID, userID, peerID uuid.UUID) (uuid.UUID, error) {
	if peerID == userID {
		return uuid.Nil, httpx.BadRequest("self_chat", "Нельзя открыть чат с самим собой")
	}
	db := s.db.WithContext(ctx)
	ok, err := bothInFamily(db, familyID, userID, peerID)
	if err != nil {
		return uuid.Nil, err
	}
	if !ok {
		return uuid.Nil, httpx.NotFound("Участник не найден")
	}
	var chatID uuid.UUID
	err = db.Transaction(func(tx *gorm.DB) error {
		var err error
		chatID, err = getOrCreateDirect(tx, familyID, userID, peerID)
		return err
	})
	return chatID, err
}

func (s *Service) Messages(ctx context.Context, familyID, chatID, userID uuid.UUID, before *time.Time, limit int) ([]Message, error) {
	if err := s.access(ctx, familyID, chatID, userID); err != nil {
		return nil, err
	}
	return listMessages(s.db.WithContext(ctx), s.cipher, chatID, before, limit)
}

// Send сохраняет сообщение и мгновенно рассылает его участникам чата (в том числе
// на другие устройства самого автора). clientID — метка фронтенда, возвращается в событии.
func (s *Service) Send(ctx context.Context, familyID, chatID, userID uuid.UUID, text, clientID string) (Message, error) {
	if !s.sendLimiter.Allow(userID.String()) {
		return Message{}, httpx.TooManyRequests()
	}
	if err := s.access(ctx, familyID, chatID, userID); err != nil {
		return Message{}, err
	}
	var msg Message
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var err error
		if msg, err = insertMessage(tx, s.cipher, chatID, userID, text); err != nil {
			return err
		}
		// Своё сообщение автор уже прочитал.
		_, err = markRead(tx, chatID, userID)
		return err
	})
	if err != nil {
		return Message{}, err
	}
	s.broadcast(ctx, chatID, messageEvent{Type: "message", FamilyID: familyID, ChatID: chatID, ClientID: clientID, Message: msg})
	return msg, nil
}

func (s *Service) DeleteMessage(ctx context.Context, familyID, chatID, messageID, userID uuid.UUID) error {
	if err := s.access(ctx, familyID, chatID, userID); err != nil {
		return err
	}
	ok, err := deleteMessage(s.db.WithContext(ctx), chatID, messageID, userID)
	if err != nil {
		return err
	}
	if !ok {
		return httpx.NotFound("Сообщение не найдено")
	}
	s.broadcast(ctx, chatID, deletedEvent{Type: "deleted", FamilyID: familyID, ChatID: chatID, MessageID: messageID})
	return nil
}

// MarkRead отмечает чат прочитанным и сообщает остальным: у отправителя появится «прочитано».
func (s *Service) MarkRead(ctx context.Context, familyID, chatID, userID uuid.UUID) error {
	if err := s.access(ctx, familyID, chatID, userID); err != nil {
		return err
	}
	at, err := markRead(s.db.WithContext(ctx), chatID, userID)
	if err != nil {
		return err
	}
	s.broadcast(ctx, chatID, readEvent{Type: "read", FamilyID: familyID, ChatID: chatID, UserID: userID, At: at})
	return nil
}

func (s *Service) UpdateSettings(ctx context.Context, familyID, chatID, userID uuid.UUID, muted, pinned *bool) error {
	if err := s.access(ctx, familyID, chatID, userID); err != nil {
		return err
	}
	return updateSettings(s.db.WithContext(ctx), chatID, userID, muted, pinned)
}

// sessionAlive — сессия, с которой открыто соединение, ещё не завершена.
// При сбое базы соединение не рвём: это не повод выбрасывать человека из чата.
func (s *Service) sessionAlive(userID, sessionID uuid.UUID) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	active, err := auth.SessionActive(s.db.WithContext(ctx), userID, sessionID)
	return err != nil || active
}
