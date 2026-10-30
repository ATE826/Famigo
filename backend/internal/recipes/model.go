// Пакет recipes — блюда из продуктов холодильника, которые придумывает нейросеть
// с учётом аллергий, непереносимостей и диет тех, кто будет есть.
package recipes

import "github.com/google/uuid"

// Dish — блюдо для ответа API.
type Dish struct {
	Title       string       `json:"title"`
	Servings    int          `json:"servings"`
	Minutes     int          `json:"minutes"`
	Ingredients []Ingredient `json:"ingredients"`
	Steps       []string     `json:"steps"`
	// MissingCount — сколько ингредиентов нужно докупить.
	MissingCount int `json:"missingCount"`
}

type Ingredient struct {
	Name   string `json:"name"`
	Amount string `json:"amount"`
	// InFridge — продукт есть в холодильнике. Отсутствующие продукты нужно докупить, кроме Staple.
	InFridge bool `json:"inFridge"`
	// Staple — базовый продукт, который обычно уже есть дома; виден в тегах.
	Staple bool `json:"staple,omitempty"`
}

type Suggestions struct {
	Items    []Dish `json:"items"`
	Category string `json:"category"`
	// Dropped — сколько блюд от нейросети отброшено проверкой ограничений.
	Dropped int    `json:"dropped"`
	Model   string `json:"model"`
}

type suggestInput struct {
	Servings int
	// AllMembers включает ограничения всей семьи; иначе только MemberIDs.
	// Пустой MemberIDs при AllMembers=false означает отсутствие ограничений.
	AllMembers bool
	MemberIDs  []uuid.UUID
	Language   string
	Category   string
}

// fridgeItem и eater — то, что уходит нейросети. Имён, почты и других личных данных
// здесь нет: модели нужны только продукты и ограничения.
type fridgeItem struct {
	Name     string  `json:"name"`
	Quantity float64 `json:"quantity"`
	Unit     string  `json:"unit"`
	DaysLeft int     `json:"daysLeft"`
}

type eater struct {
	Prefs []string
	Note  string
}
