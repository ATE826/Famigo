package budget

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/models"
)

// В каждом запросе есть условие family_id = ?: операции другой семьи не видны.

func toTransaction(t models.Transaction) Transaction {
	return Transaction{
		ID: t.ID, UserID: t.UserID, HomeID: t.HomeID, Type: t.Type, Category: t.Category,
		Title: t.Title, Description: t.Description, Amount: t.Amount,
		OccurredOn: t.OccurredOn.Format(models.DateLayout), CreatedAt: t.CreatedAt,
	}
}

func list(db *gorm.DB, familyID uuid.UUID, from, to time.Time, limit int) ([]Transaction, error) {
	var rows []models.Transaction
	err := db.Where("family_id = ? AND occurred_on >= ? AND occurred_on < ?", familyID, from, to).
		Order("occurred_on DESC, created_at DESC").
		Limit(limit).
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	items := make([]Transaction, len(rows))
	for i, t := range rows {
		items[i] = toTransaction(t)
	}
	return items, nil
}

// homeInFamily — указанный в операции дом должен принадлежать этой же семье.
func homeInFamily(db *gorm.DB, familyID, homeID uuid.UUID) (bool, error) {
	var count int64
	err := db.Model(&models.Home{}).Where("family_id = ? AND id = ?", familyID, homeID).Count(&count).Error
	return count > 0, err
}

func insert(db *gorm.DB, familyID, userID uuid.UUID, in transactionInput) (Transaction, error) {
	t := models.Transaction{
		FamilyID: familyID, UserID: &userID, HomeID: in.HomeID, Type: in.Type, Category: in.Category,
		Title: in.Title, Description: in.Description, Amount: in.Amount, OccurredOn: in.OccurredOn,
	}
	err := db.Create(&t).Error
	return toTransaction(t), err
}

func authorOf(db *gorm.DB, familyID, id uuid.UUID) (*uuid.UUID, error) {
	var t models.Transaction
	err := db.Select("user_id").Where("family_id = ? AND id = ?", familyID, id).Take(&t).Error
	return t.UserID, err
}

func remove(db *gorm.DB, familyID, id uuid.UUID) error {
	return db.Where("family_id = ? AND id = ?", familyID, id).Delete(&models.Transaction{}).Error
}

// summary считает всё в базе: остаток = стартовый остаток семьи + доходы − расходы
// по конец месяца включительно. Отдельной колонки «остаток» нет, поэтому он не расходится с историей.
func summary(db *gorm.DB, familyID uuid.UUID, from, to time.Time) (Summary, error) {
	var s Summary

	var family models.Family
	if err := db.Select("opening_balance").Where("id = ?", familyID).Take(&family).Error; err != nil {
		return s, err
	}
	var net int64
	err := db.Model(&models.Transaction{}).
		Select("COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0)").
		Where("family_id = ? AND occurred_on < ?", familyID, to).
		Scan(&net).Error
	if err != nil {
		return s, err
	}
	s.Balance = family.OpeningBalance + net

	// Итоги по категориям за месяц; из них же складываются доходы и расходы.
	err = db.Model(&models.Transaction{}).
		Select("type, category, SUM(amount) AS amount").
		Where("family_id = ? AND occurred_on >= ? AND occurred_on < ?", familyID, from, to).
		Group("type, category").
		Order("type, SUM(amount) DESC").
		Scan(&s.Categories).Error
	for _, c := range s.Categories {
		if c.Type == "income" {
			s.Income += c.Amount
		} else {
			s.Expense += c.Amount
		}
	}
	return s, err
}
