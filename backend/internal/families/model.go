// Пакет families — семьи, участники, роли и приглашения.
// Здесь же проверка «состоит ли пользователь в семье», на которой держится
// защита всех семейных данных (домов, бюджета, чатов) от чужих глаз.
package families

import (
	"time"

	"github.com/google/uuid"
)

// Роли участников. В базе хранятся строками, в коде — константами, чтобы не опечататься.
const (
	RoleOwner  = "owner"
	RoleAdmin  = "admin"
	RoleMember = "member"
)

var roleRank = map[string]int{RoleOwner: 3, RoleAdmin: 2, RoleMember: 1}

type Family struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Role         string    `json:"role"`
	MembersCount int       `json:"membersCount"`
	CreatedAt    time.Time `json:"createdAt"`
}

type Member struct {
	UserID     uuid.UUID  `json:"userId"`
	Name       string     `json:"name"`
	AvatarURL  *string    `json:"avatarUrl"`
	AvatarTone string     `json:"avatarTone"`
	Role       string     `json:"role"`
	HomeID     *uuid.UUID `json:"homeId"`
	JoinedAt   time.Time  `json:"joinedAt"`
	Birthday   *string    `json:"birthday"`
	FoodPrefs  []string   `json:"foodPrefs"`
	FoodNote   *string    `json:"foodNote"`
}

type Details struct {
	Family
	OpeningBalance int64    `json:"openingBalance"`
	Members        []Member `json:"members"`
}

type Invite struct {
	Code      string    `json:"code"`
	ExpiresAt time.Time `json:"expiresAt"`
}
