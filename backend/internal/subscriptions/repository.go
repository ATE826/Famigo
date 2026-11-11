package subscriptions

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/ATE826/Famigo/backend/internal/database"
	"github.com/ATE826/Famigo/backend/internal/models"
)

// get — подписка семьи или nil, если строки нет (тариф Free).
func get(db *gorm.DB, familyID uuid.UUID) (*models.Subscription, error) {
	var sub models.Subscription
	err := db.Where("family_id = ?", familyID).Take(&sub).Error
	if database.IsNotFound(err) {
		return nil, nil
	}
	return &sub, err
}

// upsert — INSERT ... ON CONFLICT (family_id) DO UPDATE: у семьи одна строка подписки.
func upsert(db *gorm.DB, familyID uuid.UUID, plan, period string, renewsAt time.Time, payerID uuid.UUID) error {
	sub := models.Subscription{
		FamilyID: familyID, Plan: plan, Period: period,
		RenewsAt: &renewsAt, CancelAtPeriodEnd: false, PayerID: &payerID,
	}
	return db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "family_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"plan", "period", "renews_at", "cancel_at_period_end", "payer_id", "updated_at"}),
	}).Create(&sub).Error
}

func setCancel(db *gorm.DB, familyID uuid.UUID, cancel bool) error {
	return db.Model(&models.Subscription{}).Where("family_id = ?", familyID).Update("cancel_at_period_end", cancel).Error
}
