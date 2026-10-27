package budget

import (
	"testing"
	"time"
)

func TestFormatRubles(t *testing.T) {
	cases := map[int64]string{
		550000:     "5 500",
		550050:     "5 500,50",
		12000000:   "120 000",
		99:         "0,99",
		1234567800: "12 345 678",
	}
	for kopecks, want := range cases {
		if got := formatRubles(kopecks); got != want {
			t.Errorf("formatRubles(%d) = %q, want %q", kopecks, got, want)
		}
	}
}

func TestMonthRange(t *testing.T) {
	from, to := monthRange(time.Date(2026, 12, 15, 0, 0, 0, 0, time.UTC))
	if from.Format(time.DateOnly) != "2026-12-01" || to.Format(time.DateOnly) != "2027-01-01" {
		t.Fatalf("декабрь: %s — %s", from, to)
	}
}

func TestTransactionValidation(t *testing.T) {
	title := "Подарок"
	valid := transactionRequest{Type: "expense", Category: "groceries", Amount: 550000, OccurredOn: "2026-10-03"}
	if _, err := valid.validate(); err != nil {
		t.Fatalf("корректная операция отклонена: %v", err)
	}

	bad := []transactionRequest{
		{Type: "expense", Category: "salary", Amount: 100, OccurredOn: "2026-10-03"},              // зарплата не расход
		{Type: "expense", Category: "other", Amount: 100, OccurredOn: "2026-10-03"},               // «Другое» без названия
		{Type: "expense", Category: "groceries", Amount: 0, OccurredOn: "2026-10-03"},             // ноль
		{Type: "expense", Category: "groceries", Amount: -500, OccurredOn: "2026-10-03"},          // минус
		{Type: "expense", Category: "groceries", Amount: maxAmount + 1, OccurredOn: "2026-10-03"}, // слишком много
		{Type: "transfer", Category: "groceries", Amount: 100, OccurredOn: "2026-10-03"},          // нет такого типа
		{Type: "expense", Category: "groceries", Amount: 100, OccurredOn: "03.10.2026"},           // формат даты
		{Type: "income", Category: "gift", Title: &title, Amount: 100, OccurredOn: "1999-01-01"},  // слишком давно
	}
	for i, req := range bad {
		if _, err := req.validate(); err == nil {
			t.Errorf("случай %d должен быть отклонён: %+v", i, req)
		}
	}
}
