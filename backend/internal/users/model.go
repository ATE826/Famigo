// Пакет users — профиль: личные данные, аватар, предпочтения в еде, настройки, удаление аккаунта.
package users

import (
	"time"

	"github.com/google/uuid"
)

var (
	tones     = []string{"green", "terra", "mint", "cream", "graphite"}
	languages = []string{"ru", "en", "es", "zh", "ja", "de"}
)

type Profile struct {
	ID            uuid.UUID `json:"id"`
	Email         string    `json:"email"`
	EmailVerified bool      `json:"emailVerified"`
	Name          string    `json:"name"`
	Birthday      *string   `json:"birthday"`
	Phone         *string   `json:"phone"`
	PhoneVerified bool      `json:"phoneVerified"`
	AvatarURL     *string   `json:"avatarUrl"`
	AvatarTone    string    `json:"avatarTone"`
	FoodPrefs     []string  `json:"foodPrefs"`
	FoodNote      *string   `json:"foodNote"`
	Settings      Settings  `json:"settings"`
	CreatedAt     time.Time `json:"createdAt"`
}

type Settings struct {
	NotifyBudget   bool   `json:"notifyBudget"`
	NotifyCalendar bool   `json:"notifyCalendar"`
	NotifyFridge   bool   `json:"notifyFridge"`
	NotifyChat     bool   `json:"notifyChat"`
	NotifyFamily   bool   `json:"notifyFamily"`
	Language       string `json:"language"`
}

// profilePatch — меняются только присланные поля. ClearX — поле прислали пустым, значит стереть.
type profilePatch struct {
	Name          *string
	Birthday      *time.Time
	ClearBirthday bool
	Phone         *string
	ClearPhone    bool
	AvatarTone    *string
}
