// Пакет chats — общий чат семьи и личные чаты пар участников.
// Новые сообщения и отметки «прочитано» доставляются мгновенно через WebSocket
// (hub.go, client.go); история и список чатов — обычными запросами.
package chats

import (
	"time"

	"github.com/google/uuid"
)

type Chat struct {
	ID   uuid.UUID `json:"id"`
	Kind string    `json:"kind"`
	// Для личного чата — собеседник.
	PeerID *uuid.UUID `json:"peerId"`
	Muted  bool       `json:"muted"`
	Pinned bool       `json:"pinned"`
	Unread int        `json:"unread"`
	// Когда остальные участники последний раз читали чат: всё, что раньше, — «прочитано».
	OthersReadAt *time.Time `json:"othersReadAt"`
	LastMessage  *Message   `json:"lastMessage"`
}

type Message struct {
	ID        uuid.UUID  `json:"id"`
	UserID    *uuid.UUID `json:"userId"`
	Text      string     `json:"text"`
	CreatedAt time.Time  `json:"createdAt"`
	Deleted   bool       `json:"deleted"`
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
	Type     string    `json:"type"` // "read"
	FamilyID uuid.UUID `json:"familyId"`
	ChatID   uuid.UUID `json:"chatId"`
	UserID   uuid.UUID `json:"userId"`
	At       time.Time `json:"at"`
}

type deletedEvent struct {
	Type      string    `json:"type"` // "deleted"
	FamilyID  uuid.UUID `json:"familyId"`
	ChatID    uuid.UUID `json:"chatId"`
	MessageID uuid.UUID `json:"messageId"`
}
