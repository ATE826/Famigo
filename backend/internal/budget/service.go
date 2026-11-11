package budget

import (
	"context"
	"fmt"
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

var (
	errNotFound     = httpx.NotFound("Операция не найдена")
	errHomeNotFound = httpx.NotFound("Дом не найден")
)

// monthRange — начало месяца и начало следующего: [from, to).
func monthRange(month time.Time) (time.Time, time.Time) {
	from := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, time.UTC)
	return from, from.AddDate(0, 1, 0)
}

// List — операции с начала месяца fromMonth по конец месяца toMonth.
func (s *Service) List(ctx context.Context, familyID uuid.UUID, fromMonth, toMonth time.Time, limit int) ([]Transaction, error) {
	from, _ := monthRange(fromMonth)
	_, to := monthRange(toMonth)
	return list(s.db.WithContext(ctx), familyID, from, to, limit)
}

func (s *Service) Summary(ctx context.Context, familyID uuid.UUID, month time.Time) (Summary, error) {
	from, to := monthRange(month)
	sum, err := summary(s.db.WithContext(ctx), familyID, from, to)
	sum.Month = from.Format("2006-01")
	if sum.Categories == nil {
		sum.Categories = []CategoryTotal{}
	}
	return sum, err
}

// Add сохраняет операцию и в той же транзакции уведомляет остальных участников:
// либо сохранится и то и другое, либо ничего.
func (s *Service) Add(ctx context.Context, familyID, userID uuid.UUID, in transactionInput) (Transaction, error) {
	var t Transaction
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if in.HomeID != nil {
			ok, err := homeInFamily(tx, familyID, *in.HomeID)
			if err != nil {
				return err
			}
			if !ok {
				return errHomeNotFound
			}
		}
		var err error
		t, err = insert(tx, familyID, userID, in)
		if database.IsForeignKeyViolation(err) {
			return errHomeNotFound // дом удалили, пока шёл запрос
		}
		if err != nil {
			return err
		}
		kind := "расход"
		if in.Type == "income" {
			kind = "доход"
		}
		return s.notify.NotifyFamily(tx, familyID, []uuid.UUID{userID}, notifications.Notification{
			Type:  notifications.TypeBudget,
			Title: "Новый " + kind,
			Body:  fmt.Sprintf("%s ₽", formatRubles(in.Amount)),
			Link:  "/budget/history",
		})
	})
	return t, err
}

// Delete: свою операцию может удалить автор, любую — владелец и администраторы.
func (s *Service) Delete(ctx context.Context, familyID, userID uuid.UUID, role string, id uuid.UUID) error {
	db := s.db.WithContext(ctx)
	author, err := authorOf(db, familyID, id)
	if database.IsNotFound(err) {
		return errNotFound
	}
	if err != nil {
		return err
	}
	isAuthor := author != nil && *author == userID
	if !isAuthor && !families.CanManage(role) {
		return httpx.Forbidden("Удалить чужую операцию могут только владелец и администраторы")
	}
	return remove(db, familyID, id)
}

// formatRubles: 550050 копеек → «5 500,50».
func formatRubles(kopecks int64) string {
	rubles, rest := kopecks/100, kopecks%100
	digits := fmt.Sprint(rubles)
	var out []byte
	for i := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			out = append(out, ' ')
		}
		out = append(out, digits[i])
	}
	if rest != 0 {
		return fmt.Sprintf("%s,%02d", out, rest)
	}
	return string(out)
}
