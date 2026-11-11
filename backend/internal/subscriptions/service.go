package subscriptions

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/families"
	"github.com/ATE826/Famigo/backend/internal/httpx"
)

type Service struct {
	db *gorm.DB
	// demoPayments — подписка оформляется без оплаты. В production выключено:
	// иначе любой мог бы бесплатно включить себе платный тариф.
	demoPayments bool
}

func NewService(db *gorm.DB, demoPayments bool) *Service {
	return &Service{db: db, demoPayments: demoPayments}
}

// Current — действующая подписка семьи. db — пул или транзакция (homes проверяет лимит в транзакции).
func (s *Service) Current(db *gorm.DB, familyID uuid.UUID) (Subscription, error) {
	r, err := get(db, familyID)
	if err != nil {
		return Subscription{}, err
	}
	return effective(r, time.Now()), nil
}

// Get — действующая подписка семьи для ответа API.
func (s *Service) Get(ctx context.Context, familyID uuid.UUID) (Subscription, error) {
	return s.Current(s.db.WithContext(ctx), familyID)
}

func (s *Service) Subscribe(ctx context.Context, familyID, userID uuid.UUID, role, plan, period string) (Subscription, error) {
	if err := families.RequireManager(role); err != nil {
		return Subscription{}, err
	}
	if !s.demoPayments {
		return Subscription{}, &httpx.Error{Status: http.StatusNotImplemented, Code: "payments_unavailable", Message: "Оплата пока недоступна"}
	}
	renewsAt := time.Now().AddDate(0, 1, 0)
	if period == "year" {
		renewsAt = time.Now().AddDate(1, 0, 0)
	}
	db := s.db.WithContext(ctx)
	if err := upsert(db, familyID, plan, period, renewsAt, userID); err != nil {
		return Subscription{}, err
	}
	return s.Current(db, familyID)
}

// SetAutoRenew — отменить (подписка доживёт до конца оплаченного срока) или возобновить.
// Может владелец, администратор или тот, кто платит.
func (s *Service) SetAutoRenew(ctx context.Context, familyID, userID uuid.UUID, role string, on bool) (Subscription, error) {
	db := s.db.WithContext(ctx)
	current, err := s.Current(db, familyID)
	if err != nil {
		return Subscription{}, err
	}
	if current.Plan.ID == PlanFree {
		return Subscription{}, httpx.Conflict("no_subscription", "Нет активной подписки")
	}
	isPayer := current.PayerID != nil && *current.PayerID == userID
	if !families.CanManage(role) && !isPayer {
		return Subscription{}, httpx.Forbidden("Управлять подпиской может владелец, администратор или тот, кто платит")
	}
	if err := setCancel(db, familyID, !on); err != nil {
		return Subscription{}, err
	}
	return s.Current(db, familyID)
}
