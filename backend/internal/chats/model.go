// Пакет chats — общий чат семьи и личные чаты пар участников.
// Новые сообщения и отметки «прочитано» доставляются мгновенно через WebSocket
// (hub.go, client.go); история и список чатов — обычными запросами.
package chats

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Chat struct {
	ID   uuid.UUID `json:"id"`
	Kind string    `json:"kind"`
	// Для личного чата — собеседник.
	PeerID      *uuid.UUID `json:"peerId"`
	Muted       bool       `json:"muted"`
	Pinned      bool       `json:"pinned"`
	Unread      int        `json:"unread"`
	LastMessage *Message   `json:"lastMessage"`
}

type Message struct {
	ReadByAll bool            `json:"readByAll"`
	Details   json.RawMessage `json:"details,omitempty"`
	ID        uuid.UUID       `json:"id"`
	UserID    *uuid.UUID      `json:"userId"`
	Text      string          `json:"text"`
	CreatedAt time.Time       `json:"createdAt"`
	Deleted   bool            `json:"deleted"`
}

// События, которые сервер присылает по WebSocket.

type messageEvent struct {
	Type     string    `json:"type"` // "message"
	FamilyID uuid.UUID `json:"familyId"`
	ChatID   uuid.UUID `json:"chatId"`
	ClientID string    `json:"clientId,omitempty"`
	Message  Message   `json:"message"`
}

type readEvent struct {
	AllReadIDs []uuid.UUID `json:"allReadIds"`
	Unread     int         `json:"unread"`
	Type       string      `json:"type"` // "read"
	FamilyID   uuid.UUID   `json:"familyId"`
	ChatID     uuid.UUID   `json:"chatId"`
	UserID     uuid.UUID   `json:"userId"`
	At         time.Time   `json:"at"`
}

type deletedEvent struct {
	Type      string    `json:"type"` // "deleted"
	FamilyID  uuid.UUID `json:"familyId"`
	ChatID    uuid.UUID `json:"chatId"`
	MessageID uuid.UUID `json:"messageId"`
}
