// Пакет homes — дома семьи и дела по дому.
package homes

import (
	"time"

	"github.com/google/uuid"
)

var kinds = []string{"apartment", "house", "dacha", "other"}

type Home struct {
	ID          uuid.UUID   `json:"id"`
	Name        string      `json:"name"`
	Kind        string      `json:"kind"`
	Place       *string     `json:"place"`
	Rooms       int         `json:"rooms"`
	PeopleCount int         `json:"peopleCount"`
	Residents   []uuid.UUID `json:"residents"`
	OpenTasks   int         `json:"openTasks"`
	CreatedAt   time.Time   `json:"createdAt"`
}

type HomeDetails struct {
	Home
	Tasks []Task `json:"tasks"`
}

type Task struct {
	ID          uuid.UUID  `json:"id"`
	Text        string     `json:"text"`
	Description *string    `json:"description"`
	Done        bool       `json:"done"`
	DoneAt      *time.Time `json:"doneAt"`
	CreatedBy   *uuid.UUID `json:"createdBy"`
	CreatedAt   time.Time  `json:"createdAt"`
}

type homeInput struct {
	Name        string
	Kind        string
	Place       *string
	Rooms       int
	PeopleCount int
}
