// Пакет budget — доходы и расходы семьи. Все суммы — в копейках (целые числа).
package budget

import (
	"time"

	"github.com/google/uuid"
)

var (
	expenseCategories = []string{"groceries", "home", "transport", "entertainment", "other"}
	incomeCategories  = []string{"salary", "gift", "other"}
)

type Transaction struct {
	ID          uuid.UUID  `json:"id"`
	UserID      *uuid.UUID `json:"userId"`
	HomeID      *uuid.UUID `json:"homeId"`
	Type        string     `json:"type"`
	Category    string     `json:"category"`
	Title       *string    `json:"title"`
	Description *string    `json:"description"`
	Amount      int64      `json:"amount"`
	OccurredOn  string     `json:"occurredOn"`
	CreatedAt   time.Time  `json:"createdAt"`
}

type CategoryTotal struct {
	Type     string `json:"type"`
	Category string `json:"category"`
	Amount   int64  `json:"amount"`
}

// Summary — сводка за месяц: остаток на конец месяца и итоги по категориям.
type Summary struct {
	Month      string          `json:"month"`
	Balance    int64           `json:"balance"`
	Income     int64           `json:"income"`
	Expense    int64           `json:"expense"`
	Categories []CategoryTotal `json:"categories"`
}

type transactionInput struct {
	Type        string
	Category    string
	Title       *string
	Description *string
	Amount      int64
	OccurredOn  time.Time
	HomeID      *uuid.UUID
}
