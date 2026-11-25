package chats

import (
	"context"
	"encoding/json"
	"github.com/google/uuid"
	"time"
)

const typingTTL = 6 * time.Second

type typingState struct {
	familyID, chatID uuid.UUID
	recipients       []uuid.UUID
	timer            *time.Timer
}

// All typing state is connection-local and guarded by hub.mu, never persisted.
func (h *Hub) broadcastTypingLocked(state *typingState) {
	users := []uuid.UUID{}
	for userID, clients := range h.clients {
		for client := range clients {
			if client.typing != nil && client.typing.chatID == state.chatID {
				users = append(users, userID)
				break
			}
		}
	}
	data, err := json.Marshal(struct {
		Type     string      `json:"type"`
		FamilyID uuid.UUID   `json:"familyId"`
		ChatID   uuid.UUID   `json:"chatId"`
		UserIDs  []uuid.UUID `json:"userIds"`
	}{"typing", state.familyID, state.chatID, users})
	if err != nil {
		return
	}
	for _, userID := range state.recipients {
		for client := range h.clients[userID] {
			client.enqueue(data)
		}
	}
}

func (h *Hub) stopTypingLocked(c *Client) {
	if c.typing == nil {
		return
	}
	old := c.typing
	old.timer.Stop()
	c.typing = nil
	h.broadcastTypingLocked(old)
}

func (c *Client) updateTyping(ctx context.Context, familyID, chatID uuid.UUID, active bool) error {
	if err := c.service.access(ctx, familyID, chatID, c.userID); err != nil {
		return err
	}
	recipients, err := memberIDs(c.service.db.WithContext(ctx), chatID)
	if err != nil {
		return err
	}
	h := c.hub
	h.mu.Lock()
	defer h.mu.Unlock()
	if c.typing != nil && (!active || c.typing.chatID != chatID) {
		h.stopTypingLocked(c)
	}
	if !active {
		return nil
	}
	if c.typing != nil {
		c.typing.timer.Stop()
	}
	state := &typingState{familyID: familyID, chatID: chatID, recipients: recipients}
	c.typing = state
	state.timer = time.AfterFunc(typingTTL, func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if c.typing == state {
			h.stopTypingLocked(c)
		}
	})
	h.broadcastTypingLocked(state)
	return nil
}
