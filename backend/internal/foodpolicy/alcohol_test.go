package foodpolicy

import (
	"testing"
	"time"
)

func TestAgeBoundary(t *testing.T) {
	now := time.Date(2026, 11, 17, 0, 0, 0, 0, location)
	for _, test := range []struct {
		date  string
		adult bool
	}{{"2008-11-17", true}, {"2008-11-18", false}, {"2008-11-16", true}, {"2030-01-01", false}} {
		birthday, _ := time.Parse("2006-01-02", test.date)
		if Adult(&birthday, now) != test.adult {
			t.Fatal(test)
		}
	}
	if Adult(nil, now) {
		t.Fatal("unknown birthday accepted")
	}
	birthday, _ := time.Parse("2006-01-02", "2008-11-17")
	if !Adult(&birthday, now.UTC()) {
		t.Fatal("Moscow midnight boundary failed")
	}
}
func TestAlcoholDetection(t *testing.T) {
	for _, text := range []string{"Рис с вином", "Добавьте 100 мл вина", "Ром", "Водка", "Пивной соус", "Chicken with wine", "Beer soup", "Wein", "CervezA", "葡萄酒", "日本酒"} {
		if !ContainsAlcohol(text) {
			t.Fatal("missed " + text)
		}
	}
	for _, text := range []string{"Говядина", "Свинина", "Виноград", "Ромашка", "Лимонад", "Молочный коктейль"} {
		if ContainsAlcohol(text) {
			t.Fatal("false positive " + text)
		}
	}
}
