// Пакет models — таблицы базы данных в виде Go-структур для GORM.
//
// Схему таблиц создают SQL-миграции (database/migrations), а не AutoMigrate из GORM:
// AutoMigrate не умеет триггеры (передача прав владельца), частичные уникальные индексы
// («владелец в семье один») и CHECK-ограничения, а на них держится целостность данных.
// Поэтому структуры здесь только описывают уже готовые таблицы.
//
// Правила, которых держимся во всём проекте:
//   - Значения от пользователя попадают в запрос только как параметры «?» — GORM передаёт
//     их в PostgreSQL отдельно от текста SQL, поэтому SQL-инъекция невозможна.
//     Никогда не склеиваем строки запроса из пользовательского ввода (fmt.Sprintf, +).
//   - Запрос к таблице данных семьи всегда фильтруется по family_id (защита от IDOR).
//   - Тело запроса никогда не декодируется прямо в модель: иначе клиент мог бы прислать
//     лишние поля (id, role, family_id) и переписать их. Модели заполняет только код сервера.
//   - Ассоциации (FoodPrefs, Members, User...) заполняются только при чтении через
//     Preload/Joins. При Create они пустые, и GORM их не трогает.
//
// Поля id и created_at заполняет сама база (DEFAULT gen_random_uuid() и now()): GORM не
// вставляет их, а получает обратно через RETURNING. Так время у всех записей — по часам базы.
package models

import (
	"time"

	"github.com/google/uuid"
)

// DateLayout — формат дат (колонок DATE) в API: 2026-10-27.
const DateLayout = "2006-01-02"

// FormatDate — дата для ответа API или nil, если даты нет.
func FormatDate(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format(DateLayout)
	return &s
}

// --- Пользователь и его личные данные (0001_create_users.sql) ---

type User struct {
	ID              uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	Email           string
	EmailVerifiedAt *time.Time
	// json:"-" — хеш пароля не уйдёт в ответ, даже если кто-то по ошибке отдаст модель целиком.
	PasswordHash    string `json:"-"`
	Name            string
	Birthday        *time.Time `gorm:"type:date"`
	Phone           *string
	PhoneVerifiedAt *time.Time
	AvatarURL       *string
	AvatarTone      string
	FoodNote        *string
	CreatedAt       time.Time `gorm:"default:now();autoCreateTime:false"`
	UpdatedAt       time.Time

	FoodPrefs []UserFoodPref `gorm:"foreignKey:UserID"`
	Settings  *UserSettings  `gorm:"foreignKey:UserID"`
}

func (User) TableName() string { return "users" }

type UserFoodPref struct {
	UserID uuid.UUID `gorm:"primaryKey"`
	Value  string    `gorm:"primaryKey"`
}

func (UserFoodPref) TableName() string { return "user_food_prefs" }

// UserSettings — без тегов default у bool-полей намеренно: с default:true GORM заменил бы
// false на true при вставке, и выключить уведомление было бы нельзя.
type UserSettings struct {
	UserID         uuid.UUID `gorm:"primaryKey"`
	NotifyBudget   bool
	NotifyCalendar bool
	NotifyFridge   bool
	NotifyChat     bool
	NotifyFamily   bool
	Language       string
}

func (UserSettings) TableName() string { return "user_settings" }

// DefaultSettings — настройки нового пользователя: все уведомления включены.
func DefaultSettings(userID uuid.UUID) UserSettings {
	return UserSettings{
		UserID: userID, NotifyBudget: true, NotifyCalendar: true, NotifyFridge: true,
		NotifyChat: true, NotifyFamily: true, Language: "ru",
	}
}

// Wants — хочет ли человек получать уведомления этого типа.
func (s UserSettings) Wants(kind string) bool {
	switch kind {
	case "budget":
		return s.NotifyBudget
	case "calendar":
		return s.NotifyCalendar
	case "fridge":
		return s.NotifyFridge
	case "chat":
		return s.NotifyChat
	case "family":
		return s.NotifyFamily
	}
	return true
}

type Consent struct {
	ID        uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	UserID    uuid.UUID
	Document  string
	Version   string
	GivenAt   time.Time `gorm:"default:now()"`
	RevokedAt *time.Time
}

func (Consent) TableName() string { return "consents" }

// RefreshToken — токен обновления сессии. В базе только хеш токена.
// SessionID один на всю сессию входа: при обновлении токен меняется, сессия остаётся.
// Задаётся всегда явно (default нет): нулевой id склеил бы чужие сессии.
type RefreshToken struct {
	ID        uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	UserID    uuid.UUID
	SessionID uuid.UUID
	TokenHash string `json:"-"`
	UserAgent string
	CreatedAt time.Time `gorm:"default:now();autoCreateTime:false"`
	ExpiresAt time.Time
	// RevokedAt — сессию завершили (выход, смена пароля, подозрение на кражу).
	RevokedAt *time.Time
	// ReplacedAt — токен обменяли на новый (ротация при обновлении сессии).
	ReplacedAt *time.Time
}

func (RefreshToken) TableName() string { return "refresh_tokens" }

// --- Семья (0002_create_families.sql) ---

type Family struct {
	ID             uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	Name           string
	Timezone       string `gorm:"default:Europe/Moscow"`
	OpeningBalance int64
	CreatedBy      *uuid.UUID
	CreatedAt      time.Time `gorm:"default:now();autoCreateTime:false"`
}

func (Family) TableName() string { return "families" }

// FamilyMember — участник семьи. HomeID — дом, где он сейчас живёт.
type FamilyMember struct {
	FamilyID uuid.UUID `gorm:"primaryKey"`
	UserID   uuid.UUID `gorm:"primaryKey"`
	Role     string
	HomeID   *uuid.UUID
	JoinedAt time.Time `gorm:"default:now()"`

	Family Family `gorm:"foreignKey:FamilyID"`
	User   User   `gorm:"foreignKey:UserID"`
}

func (FamilyMember) TableName() string { return "family_members" }

type FamilyInvite struct {
	Code      string `gorm:"primaryKey"`
	FamilyID  uuid.UUID
	CreatedBy *uuid.UUID
	CreatedAt time.Time `gorm:"default:now();autoCreateTime:false"`
	ExpiresAt time.Time
}

func (FamilyInvite) TableName() string { return "family_invites" }

// --- Дома и дела по дому (0003_create_homes.sql) ---

type Home struct {
	ID          uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	FamilyID    uuid.UUID
	Name        string
	Kind        string
	Place       *string
	Rooms       int
	PeopleCount int
	CreatedAt   time.Time `gorm:"default:now();autoCreateTime:false"`

	Residents []FamilyMember `gorm:"foreignKey:HomeID"`
	// OpenTasks — не колонка, а число невыполненных дел, которое считает запрос.
	// «->» — поле только для чтения: GORM никогда не попытается его записать.
	OpenTasks int `gorm:"->;-:migration"`
}

func (Home) TableName() string { return "homes" }

type HomeTask struct {
	ID          uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	HomeID      uuid.UUID
	Text        string
	Description *string
	DoneAt      *time.Time
	CreatedBy   *uuid.UUID
	CreatedAt   time.Time `gorm:"default:now();autoCreateTime:false"`
}

func (HomeTask) TableName() string { return "home_tasks" }

// --- Холодильник (0004_create_products.sql) ---

type Product struct {
	ID        uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	HomeID    uuid.UUID
	Name      string
	Category  string
	Quantity  float64
	Unit      string
	ExpiresOn time.Time `gorm:"type:date"`
	AddedBy   *uuid.UUID
	CreatedAt time.Time `gorm:"default:now();autoCreateTime:false"`
	UpdatedAt time.Time
}

func (Product) TableName() string { return "products" }

// --- Бюджет (0005_create_transactions.sql) ---

// Transaction — доход или расход. Сумма в копейках.
type Transaction struct {
	ID          uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	FamilyID    uuid.UUID
	UserID      *uuid.UUID
	HomeID      *uuid.UUID
	Type        string
	Category    string
	Title       *string
	Description *string
	Amount      int64
	OccurredOn  time.Time `gorm:"type:date"`
	CreatedAt   time.Time `gorm:"default:now();autoCreateTime:false"`
}

func (Transaction) TableName() string { return "transactions" }

// --- Календарь (0006_create_events.sql) ---

type Event struct {
	ID          uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	FamilyID    uuid.UUID
	CreatedBy   *uuid.UUID
	Title       string
	Description *string
	StartsAt    time.Time
	EndsAt      *time.Time
	Place       *string
	CreatedAt   time.Time `gorm:"default:now();autoCreateTime:false"`

	Members []EventMember `gorm:"foreignKey:EventID"`
}

func (Event) TableName() string { return "events" }

type EventMember struct {
	EventID uuid.UUID `gorm:"primaryKey"`
	UserID  uuid.UUID `gorm:"primaryKey"`
}

func (EventMember) TableName() string { return "event_members" }

// --- Чаты (0007_create_chats.sql) ---

type Chat struct {
	ID        uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	FamilyID  uuid.UUID
	Kind      string
	DirectKey *string
	CreatedAt time.Time `gorm:"default:now();autoCreateTime:false"`
}

func (Chat) TableName() string { return "chats" }

type ChatMember struct {
	ChatID     uuid.UUID `gorm:"primaryKey"`
	UserID     uuid.UUID `gorm:"primaryKey"`
	Muted      bool
	Pinned     bool
	LastReadAt time.Time `gorm:"default:now()"`

	Chat Chat `gorm:"foreignKey:ChatID"`
}

func (ChatMember) TableName() string { return "chat_members" }

// Message — сообщение чата. DeletedAt здесь обычное поле (*time.Time), а не gorm.DeletedAt:
// удалённые сообщения должны оставаться в ленте как «Сообщение удалено», а gorm.DeletedAt
// прятал бы их из всех запросов.
type Message struct {
	ID        uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	ChatID    uuid.UUID
	UserID    *uuid.UUID
	Text      string
	CreatedAt time.Time `gorm:"default:now();autoCreateTime:false"`
	EditedAt  *time.Time
	DeletedAt *time.Time
}

func (Message) TableName() string { return "messages" }

// --- Уведомления (0008_create_notifications.sql) ---

type Notification struct {
	ID        uuid.UUID `gorm:"primaryKey;default:gen_random_uuid()"`
	UserID    uuid.UUID
	FamilyID  *uuid.UUID
	Type      string
	Title     string
	Body      *string
	Link      *string
	ReadAt    *time.Time
	CreatedAt time.Time `gorm:"default:now();autoCreateTime:false"`
}

func (Notification) TableName() string { return "notifications" }

// --- Подписка (0009_create_subscriptions.sql) ---

type Subscription struct {
	FamilyID          uuid.UUID `gorm:"primaryKey"`
	Plan              string
	Period            string
	RenewsAt          *time.Time
	CancelAtPeriodEnd bool
	PayerID           *uuid.UUID
	CreatedAt         time.Time `gorm:"default:now();autoCreateTime:false"`
	UpdatedAt         time.Time
}

func (Subscription) TableName() string { return "subscriptions" }
