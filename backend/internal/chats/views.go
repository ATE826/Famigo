package chats

import (
	"context"
	"github.com/ATE826/Famigo/backend/internal/httpx"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"time"
)

// A receipt belongs to one message. Seeing a later message never marks skipped
// messages as read. All current recipients, excluding its author, must view it.
func allViewedIDs(db *gorm.DB, chatID uuid.UUID, ids []uuid.UUID) ([]uuid.UUID, error) {
	result := []uuid.UUID{}
	if len(ids) == 0 {
		return result, nil
	}
	err := db.Raw(`SELECT m.id FROM messages m WHERE m.chat_id = ? AND m.id IN ?
 AND NOT EXISTS (SELECT 1 FROM chat_members cm
 WHERE cm.chat_id = m.chat_id AND cm.user_id IS DISTINCT FROM m.user_id
 AND NOT EXISTS (SELECT 1 FROM message_views v WHERE v.message_id=m.id AND v.user_id=cm.user_id))`, chatID, ids).Scan(&result).Error
	return result, err
}

func fillViewStatus(db *gorm.DB, chatID uuid.UUID, messages []Message) error {
	ids := make([]uuid.UUID, len(messages))
	for i, m := range messages {
		ids[i] = m.ID
	}
	read, err := allViewedIDs(db, chatID, ids)
	if err != nil {
		return err
	}
	byID := map[uuid.UUID]bool{}
	for _, id := range read {
		byID[id] = true
	}
	for i := range messages {
		messages[i].ReadByAll = byID[messages[i].ID]
	}
	return nil
}

func (s *Service) MarkViewed(ctx context.Context, familyID, chatID, userID uuid.UUID, ids []uuid.UUID) (readEvent, error) {
	event := readEvent{Type: "read", FamilyID: familyID, ChatID: chatID, UserID: userID, At: time.Now().UTC()}
	if err := s.access(ctx, familyID, chatID, userID); err != nil {
		return event, err
	}
	if len(ids) == 0 || len(ids) > 100 {
		return event, httpx.BadRequest("invalid_views", "Укажите от 1 до 100 сообщений")
	}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Serialize receipts for this chat so concurrent final readers cannot
		// both publish an incomplete aggregate before the other's commit.
		if err := tx.Exec("SELECT id FROM chats WHERE id = ? FOR UPDATE", chatID).Error; err != nil {
			return err
		}
		if err := tx.Exec(`INSERT INTO message_views(message_id,user_id)
    SELECT id, ? FROM messages WHERE chat_id = ? AND id IN ? AND deleted_at IS NULL
    AND user_id IS DISTINCT FROM ? ON CONFLICT DO NOTHING`, userID, chatID, ids, userID).Error; err != nil {
			return err
		}
		var err error
		event.AllReadIDs, err = allViewedIDs(tx, chatID, ids)
		if err != nil {
			return err
		}
		return tx.Raw(`SELECT count(*) FROM messages m WHERE m.chat_id = ? AND m.deleted_at IS NULL
    AND m.user_id IS DISTINCT FROM ? AND NOT EXISTS
    (SELECT 1 FROM message_views v WHERE v.message_id=m.id AND v.user_id=?)`, chatID, userID, userID).Scan(&event.Unread).Error
	})
	if err != nil {
		return event, err
	}
	s.broadcast(ctx, chatID, event)
	return event, nil
}
