// Пакет calendar — события семейного календаря.
// Дни рождения сюда не входят: фронтенд вычисляет их из дат рождения участников.
package calendar

import (
	"time"

	"github.com/google/uuid"
)

var places = []string{"apartment", "dacha", "cafe", "restaurant", "other"}

type Event struct {
	ID          uuid.UUID   `json:"id"`
	CreatedBy   *uuid.UUID  `json:"createdBy"`
	Title       string      `json:"title"`
	Description *string     `json:"description"`
	StartsAt    time.Time   `json:"startsAt"`
	EndsAt      *time.Time  `json:"endsAt"`
	Place       *string     `json:"place"`
	MemberIDs   []uuid.UUID `json:"memberIds"`
	CreatedAt   time.Time   `json:"createdAt"`
}

type eventInput struct {
	Title       string
	Description *string
	StartsAt    time.Time
	EndsAt      *time.Time
	Place       *string
	MemberIDs   []uuid.UUID
}
