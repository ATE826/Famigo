package chats

import (
	"context"
	"github.com/google/uuid"
)

// HideMessage lets an author hide their own message only from their account.
func (s *Service) HideMessage(ctx context.Context, familyID, chatID, messageID, userID uuid.UUID) error {
	if err := s.access(ctx, familyID, chatID, userID); err != nil {
		return err
	}
	db := s.db.WithContext(ctx)
	var exists bool
	if err := db.Raw("SELECT EXISTS(SELECT 1 FROM messages WHERE id=? AND chat_id=? AND user_id=?)", messageID, chatID, userID).Scan(&exists).Error; err != nil {
		return err
	}
	if !exists {
		return errChatNotFound
	}
	if err := db.Exec("INSERT INTO hidden_chat_messages(user_id,message_id) VALUES (?,?) ON CONFLICT DO NOTHING", userID, messageID).Error; err != nil {
		return err
	}
	s.hub.SendTo([]uuid.UUID{userID}, struct {
		Type      string    `json:"type"`
		FamilyID  uuid.UUID `json:"familyId"`
		ChatID    uuid.UUID `json:"chatId"`
		MessageID uuid.UUID `json:"messageId"`
	}{"hidden", familyID, chatID, messageID})
	return nil
}
