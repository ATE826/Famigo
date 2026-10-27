// Пакет notifications — лента уведомлений пользователя и их рассылка семье.
package notifications

import (
	"time"

	"github.com/google/uuid"
)

// Типы совпадают с переключателями в настройках уведомлений на фронтенде.
const (
	TypeBudget   = "budget"
	TypeCalendar = "calendar"
	TypeFridge   = "fridge"
	TypeChat     = "chat"
	TypeFamily   = "family"
)

// Notification — что разослать.
type Notification struct {
	Type  string
	Title string
	Body  string
	Link  string
}

type Item struct {
	ID        uuid.UUID  `json:"id"`
	FamilyID  *uuid.UUID `json:"familyId"`
	Type      string     `json:"type"`
	Title     string     `json:"title"`
	Body      *string    `json:"body"`
	Link      *string    `json:"link"`
	ReadAt    *time.Time `json:"readAt"`
	CreatedAt time.Time  `json:"createdAt"`
}
