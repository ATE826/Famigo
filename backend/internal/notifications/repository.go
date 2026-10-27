package notifications

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/models"
)

// recipients — кому из семьи отправить уведомление: участники семьи (только only, если
// список задан), кроме except, у которых этот тип уведомлений не выключен в настройках.
func recipients(db *gorm.DB, familyID uuid.UUID, only, except []uuid.UUID, kind string) ([]uuid.UUID, error) {
	q := db.Model(&models.FamilyMember{}).Where("family_id = ?", familyID)
	if only != nil {
		q = q.Where("user_id IN ?", only)
	}
	if len(except) > 0 {
		q = q.Where("user_id NOT IN ?", except)
	}
	var ids []uuid.UUID
	if err := q.Pluck("user_id", &ids).Error; err != nil || len(ids) == 0 {
		return nil, err
	}

	// Настройки — отдельным запросом. Строки настроек может не быть: тогда всё включено.
	var settings []models.UserSettings
	if err := db.Where("user_id IN ?", ids).Find(&settings).Error; err != nil {
		return nil, err
	}
	muted := make(map[uuid.UUID]bool, len(settings))
	for _, s := range settings {
		muted[s.UserID] = !s.Wants(kind)
	}
	result := make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		if !muted[id] {
			result = append(result, id)
		}
	}
	return result, nil
}

// insert создаёт по уведомлению каждому получателю одним INSERT на все строки.
func insert(db *gorm.DB, familyID uuid.UUID, userIDs []uuid.UUID, n Notification) error {
	if len(userIDs) == 0 {
		return nil
	}
	rows := make([]models.Notification, len(userIDs))
	for i, id := range userIDs {
		rows[i] = models.Notification{
			UserID:   id,
			FamilyID: &familyID,
			Type:     n.Type,
			Title:    n.Title,
			Body:     optional(n.Body),
			Link:     optional(n.Link),
		}
	}
	return db.Create(&rows).Error
}

func optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func list(db *gorm.DB, userID uuid.UUID, before *time.Time, limit int) ([]Item, error) {
	q := db.Where("user_id = ?", userID)
	if before != nil {
		q = q.Where("created_at < ?", *before)
	}
	var rows []models.Notification
	if err := q.Order("created_at DESC").Limit(limit).Find(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]Item, len(rows))
	for i, r := range rows {
		items[i] = Item{
			ID: r.ID, FamilyID: r.FamilyID, Type: r.Type, Title: r.Title,
			Body: r.Body, Link: r.Link, ReadAt: r.ReadAt, CreatedAt: r.CreatedAt,
		}
	}
	return items, nil
}

func unreadCount(db *gorm.DB, userID uuid.UUID) (int, error) {
	var n int64
	err := db.Model(&models.Notification{}).Where("user_id = ? AND read_at IS NULL", userID).Count(&n).Error
	return int(n), err
}

// markRead — условие user_id = ? не даёт отметить прочитанным чужое уведомление.
func markRead(db *gorm.DB, userID, id uuid.UUID) (bool, error) {
	res := db.Model(&models.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("read_at", gorm.Expr("COALESCE(read_at, now())"))
	return res.RowsAffected > 0, res.Error
}

func markAllRead(db *gorm.DB, userID uuid.UUID) error {
	return db.Model(&models.Notification{}).
		Where("user_id = ? AND read_at IS NULL", userID).
		Update("read_at", gorm.Expr("now()")).Error
}
