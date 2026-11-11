package notifications

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/httpx"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

// NotifyFamily отправляет уведомление всем участникам семьи, кроме except
// (обычно кроме автора действия: себе уведомление о своём расходе не нужно).
// tx — транзакция действия: уведомление сохранится только вместе с самим действием.
func (s *Service) NotifyFamily(tx *gorm.DB, familyID uuid.UUID, except []uuid.UUID, n Notification) error {
	ids, err := recipients(tx, familyID, nil, except, n.Type)
	if err != nil {
		return err
	}
	return insert(tx, familyID, ids, n)
}

// NotifyUsers — только выбранным участникам семьи (например, участникам события).
// Человек не из этой семьи уведомление не получит, даже если его id есть в списке.
func (s *Service) NotifyUsers(tx *gorm.DB, familyID uuid.UUID, userIDs []uuid.UUID, n Notification) error {
	if len(userIDs) == 0 {
		return nil
	}
	ids, err := recipients(tx, familyID, userIDs, nil, n.Type)
	if err != nil {
		return err
	}
	return insert(tx, familyID, ids, n)
}

func (s *Service) List(ctx context.Context, userID uuid.UUID, before *time.Time, limit int) ([]Item, error) {
	return list(s.db.WithContext(ctx), userID, before, limit)
}

func (s *Service) UnreadCount(ctx context.Context, userID uuid.UUID) (int, error) {
	return unreadCount(s.db.WithContext(ctx), userID)
}

func (s *Service) MarkRead(ctx context.Context, userID, id uuid.UUID) error {
	ok, err := markRead(s.db.WithContext(ctx), userID, id)
	if err == nil && !ok {
		return httpx.NotFound("Уведомление не найдено")
	}
	return err
}

func (s *Service) MarkAllRead(ctx context.Context, userID uuid.UUID) error {
	return markAllRead(s.db.WithContext(ctx), userID)
}
