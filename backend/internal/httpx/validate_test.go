package httpx

import (
	"strings"
	"testing"
)

func TestValidatorText(t *testing.T) {
	v := NewValidator()
	if got := v.Text("name", "  Антон  ", 1, 30); got != "Антон" {
		t.Fatalf("пробелы по краям должны обрезаться, got %q", got)
	}
	v.Text("empty", "   ", 1, 30)
	v.Text("long", strings.Repeat("я", 31), 1, 30)
	v.Text("control", "a\x00b", 1, 30)
	v.Text("newline", "a\nb", 1, 30)
	v.MultilineText("multi", "a\nb", 1, 30)

	for field, want := range map[string]bool{"empty": true, "long": true, "control": true, "newline": true, "multi": false} {
		if _, failed := v.fields[field]; failed != want {
			t.Errorf("%s: ошибка = %v, want %v", field, failed, want)
		}
	}
}

func TestValidatorLengthCountsRunes(t *testing.T) {
	v := NewValidator()
	v.Text("name", strings.Repeat("я", 30), 1, 30) // 30 символов, но 60 байт
	if err := v.Err(); err != nil {
		t.Fatalf("длина считается в символах, а не в байтах: %v", err)
	}
}

func TestValidatorEmail(t *testing.T) {
	cases := map[string]bool{
		"anton@example.com":       true,
		" Anton@Example.COM ":     true,
		"anton":                   false,
		"anton@localhost":         false,
		"Anton <anton@mail.ru>":   false,
		"a@b.c\r\nBcc: x@evil.ru": false,
	}
	for email, ok := range cases {
		v := NewValidator()
		got := v.Email("email", email)
		if (v.Err() == nil) != ok {
			t.Errorf("%q: valid = %v, want %v", email, v.Err() == nil, ok)
		}
		if ok && got != strings.ToLower(strings.TrimSpace(email)) {
			t.Errorf("%q: нормализация дала %q", email, got)
		}
	}
}

func TestValidatorPassword(t *testing.T) {
	cases := map[string]bool{
		"короткий":              true, // ровно 8 символов
		"1234567":               false,
		"        ":              false,
		strings.Repeat("a", 73): false, // больше 72 байт — предел bcrypt
		strings.Repeat("я", 37): false, // 74 байта
		"correct horse battery": true,
	}
	for password, ok := range cases {
		v := NewValidator()
		v.Password("password", password)
		if (v.Err() == nil) != ok {
			t.Errorf("%q: valid = %v, want %v", password, v.Err() == nil, ok)
		}
	}
}

func TestValidatorBirthday(t *testing.T) {
	cases := map[string]bool{"2008-10-26": true, "2999-01-01": false, "1800-01-01": false, "26.10.2008": false}
	for date, ok := range cases {
		v := NewValidator()
		v.Birthday("birthday", date)
		if (v.Err() == nil) != ok {
			t.Errorf("%s: valid = %v, want %v", date, v.Err() == nil, ok)
		}
	}
}
