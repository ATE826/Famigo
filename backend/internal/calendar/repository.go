package calendar

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/models"
)

func toEvent(e models.Event) Event {
	ids := make([]uuid.UUID, len(e.Members))
	for i, m := range e.Members {
		ids[i] = m.UserID
	}
	return Event{
		ID: e.ID, CreatedBy: e.CreatedBy, Title: e.Title, Description: e.Description,
		StartsAt: e.StartsAt, EndsAt: e.EndsAt, Place: e.Place, MemberIDs: ids, CreatedAt: e.CreatedAt,
	}
}

func list(db *gorm.DB, familyID uuid.UUID, from, to time.Time) ([]Event, error) {
	var rows []models.Event
	err := db.Preload("Members").
		Where("family_id = ? AND starts_at >= ? AND starts_at < ?", familyID, from, to).
		Order("starts_at").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	events := make([]Event, len(rows))
	for i, e := range rows {
		events[i] = toEvent(e)
	}
	return events, nil
}

func get(db *gorm.DB, familyID, eventID uuid.UUID) (Event, error) {
	var e models.Event
	err := db.Preload("Members").Where("family_id = ? AND id = ?", familyID, eventID).Take(&e).Error
	return toEvent(e), err
}

// countFamilyMembers — сколько из этих людей состоят в семье. Если меньше, чем прислали, —
// среди id есть чужие, и такое событие создавать нельзя.
func countFamilyMembers(db *gorm.DB, familyID uuid.UUID, userIDs []uuid.UUID) (int, error) {
	var n int64
	err := db.Model(&models.FamilyMember{}).Where("family_id = ? AND user_id IN ?", familyID, userIDs).Count(&n).Error
	return int(n), err
}

// insert создаёт событие вместе с участниками: GORM сам вставит строки event_members
// для ассоциации Members и проставит в них event_id.
func insert(db *gorm.DB, familyID, userID uuid.UUID, in eventInput) (uuid.UUID, error) {
	members := make([]models.EventMember, len(in.MemberIDs))
	for i, id := range in.MemberIDs {
		members[i] = models.EventMember{UserID: id}
	}
	e := models.Event{
		FamilyID: familyID, CreatedBy: &userID, Title: in.Title, Description: in.Description,
		StartsAt: in.StartsAt, EndsAt: in.EndsAt, Place: in.Place, Members: members,
	}
	err := db.Create(&e).Error
	return e.ID, err
}

func creatorOf(db *gorm.DB, familyID, eventID uuid.UUID) (*uuid.UUID, error) {
	var e models.Event
	err := db.Select("created_by").Where("family_id = ? AND id = ?", familyID, eventID).Take(&e).Error
	return e.CreatedBy, err
}

func remove(db *gorm.DB, familyID, eventID uuid.UUID) error {
	return db.Where("family_id = ? AND id = ?", familyID, eventID).Delete(&models.Event{}).Error
}
