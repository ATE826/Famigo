package subscriptions

import (
	"time"

	"github.com/google/uuid"

	"github.com/ATE826/Famigo/backend/internal/models"
)

type Subscription struct {
	// Plan — действующий тариф с учётом срока: если оплаченный период кончился, это Free.
	Plan              Plan       `json:"plan"`
	Period            string     `json:"period"`
	RenewsAt          *time.Time `json:"renewsAt"`
	CancelAtPeriodEnd bool       `json:"cancelAtPeriodEnd"`
	PayerID           *uuid.UUID `json:"payerId"`
}

// effective превращает строку из базы в действующую подписку.
// Строки нет или оплаченный срок прошёл — тариф Free.
func effective(r *models.Subscription, now time.Time) Subscription {
	if r == nil || r.Plan == PlanFree || r.RenewsAt == nil || !r.RenewsAt.After(now) {
		return Subscription{Plan: Plans[PlanFree], Period: "month"}
	}
	plan, ok := Plans[r.Plan]
	if !ok {
		plan = Plans[PlanFree]
	}
	return Subscription{Plan: plan, Period: r.Period, RenewsAt: r.RenewsAt, CancelAtPeriodEnd: r.CancelAtPeriodEnd, PayerID: r.PayerID}
}
