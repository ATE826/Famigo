package calendar

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/database"
	"github.com/ATE826/Famigo/backend/internal/families"
	"github.com/ATE826/Famigo/backend/internal/httpx"
	"github.com/ATE826/Famigo/backend/internal/notifications"
)

type Service struct {
	db     *gorm.DB
	notify *notifications.Service
}

func NewService(db *gorm.DB, notify *notifications.Service) *Service {
	return &Service{db: db, notify: notify}
}

var errNotFound = httpx.NotFound("Событие не найдено")

func (s *Service) List(ctx context.Context, familyID uuid.UUID, from, to time.Time) ([]Event, error) {
	return list(s.db.WithContext(ctx), familyID, from, to)
}

func (s *Service) Create(ctx context.Context, familyID, userID uuid.UUID, in eventInput) (Event, error) {
	db := s.db.WithContext(ctx)
	var eventID uuid.UUID
	err := db.Transaction(func(tx *gorm.DB) error {
		found, err := countFamilyMembers(tx, familyID, in.MemberIDs)
		if err != nil {
			return err
		}
		if found != len(in.MemberIDs) {
			return httpx.Validation(map[string]string{"memberIds": "Участники должны быть из вашей семьи"})
		}
		eventID, err = insert(tx, familyID, userID, in)
		if err != nil {
			return err
		}
		others := make([]uuid.UUID, 0, len(in.MemberIDs))
		for _, id := range in.MemberIDs {
			if id != userID {
				others = append(others, id)
			}
		}
		return s.notify.NotifyUsers(tx, familyID, others, notifications.Notification{
			Type:  notifications.TypeCalendar,
			Title: "Новое событие: " + in.Title,
			Body:  "Вас добавили в событие",
			Link:  "/calendar",
		})
	})
	if err != nil {
		return Event{}, err
	}
	return get(db, familyID, eventID)
}

// Delete: событие удаляет его автор, владелец или администратор.
func (s *Service) Delete(ctx context.Context, familyID, userID uuid.UUID, role string, eventID uuid.UUID) error {
	db := s.db.WithContext(ctx)
	creator, err := creatorOf(db, familyID, eventID)
	if database.IsNotFound(err) {
		return errNotFound
	}
	if err != nil {
		return err
	}
	if (creator == nil || *creator != userID) && !families.CanManage(role) {
		return httpx.Forbidden("Удалить чужое событие могут только владелец и администраторы")
	}
	return remove(db, familyID, eventID)
}
