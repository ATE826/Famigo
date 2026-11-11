package subscriptions

import (
	"testing"
	"time"

	"github.com/ATE826/Famigo/backend/internal/models"
)

func TestEffectivePlan(t *testing.T) {
	now := time.Now()
	future, past := now.Add(time.Hour), now.Add(-time.Hour)

	cases := []struct {
		name string
		row  *models.Subscription
		want string
	}{
		{"нет подписки", nil, PlanFree},
		{"оплачено", &models.Subscription{Plan: PlanPremium, Period: "month", RenewsAt: &future}, PlanPremium},
		{"срок прошёл", &models.Subscription{Plan: PlanPremiumPlus, Period: "month", RenewsAt: &past}, PlanFree},
		{"отменена, но срок не прошёл", &models.Subscription{Plan: PlanPremium, RenewsAt: &future, CancelAtPeriodEnd: true}, PlanPremium},
		{"неизвестный тариф", &models.Subscription{Plan: "gold", RenewsAt: &future}, PlanFree},
	}
	for _, tc := range cases {
		if got := effective(tc.row, now).Plan.ID; got != tc.want {
			t.Errorf("%s: %s, want %s", tc.name, got, tc.want)
		}
	}
}

func TestHomeLimits(t *testing.T) {
	if !Plans[PlanFree].AllowsHomes(2) || Plans[PlanFree].AllowsHomes(3) {
		t.Error("Free: до 2 домов")
	}
	if !Plans[PlanPremium].AllowsHomes(3) || Plans[PlanPremium].AllowsHomes(4) {
		t.Error("Premium: до 3 домов")
	}
	if !Plans[PlanPremiumPlus].AllowsHomes(100) {
		t.Error("Premium+: без ограничения")
	}
}
