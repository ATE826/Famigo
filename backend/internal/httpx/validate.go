package httpx

import (
	"fmt"
	"net/mail"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// Validator собирает ошибки по полям, чтобы вернуть их все сразу, а не по одной.
//
//	v := httpx.NewValidator()
//	name := v.Text("name", req.Name, 1, 30)
//	if err := v.Err(); err != nil { ... }
type Validator struct {
	fields map[string]string
}

func NewValidator() *Validator { return &Validator{fields: map[string]string{}} }

// Fail записывает ошибку поля (первую: следующие для того же поля не перезаписывают её).
func (v *Validator) Fail(field, message string) {
	if _, exists := v.fields[field]; !exists {
		v.fields[field] = message
	}
}

// Check записывает ошибку, если условие не выполнено.
func (v *Validator) Check(ok bool, field, message string) {
	if !ok {
		v.Fail(field, message)
	}
}

// Err возвращает ошибку валидации или nil, если всё верно.
func (v *Validator) Err() error {
	if len(v.fields) == 0 {
		return nil
	}
	return Validation(v.fields)
}

// Text очищает однострочный текст (обрезает пробелы по краям) и проверяет длину в символах,
// как char_length в PostgreSQL. Управляющие символы запрещены: ими ломают логи и интерфейс.
func (v *Validator) Text(field, value string, minLen, maxLen int) string {
	return v.text(field, value, minLen, maxLen, false)
}

// MultilineText — то же, но разрешает переносы строк (описания, сообщения в чате).
func (v *Validator) MultilineText(field, value string, minLen, maxLen int) string {
	return v.text(field, value, minLen, maxLen, true)
}

func (v *Validator) text(field, value string, minLen, maxLen int, multiline bool) string {
	value = strings.TrimSpace(value)
	if !utf8.ValidString(value) {
		v.Fail(field, "Недопустимые символы")
		return value
	}
	for _, r := range value {
		if unicode.IsControl(r) && !(multiline && (r == '\n' || r == '\t')) {
			v.Fail(field, "Недопустимые символы")
			return value
		}
	}
	length := utf8.RuneCountInString(value)
	switch {
	case length < minLen && minLen == 1:
		v.Fail(field, "Обязательное поле")
	case length < minLen:
		v.Fail(field, fmt.Sprintf("Минимум %d символов", minLen))
	case length > maxLen:
		v.Fail(field, fmt.Sprintf("Максимум %d символов", maxLen))
	}
	return value
}

// OptionalText — необязательное поле: пустая строка превращается в nil (NULL в базе).
func (v *Validator) OptionalText(field string, value *string, maxLen int, multiline bool) *string {
	if value == nil {
		return nil
	}
	cleaned := v.text(field, *value, 0, maxLen, multiline)
	if cleaned == "" {
		return nil
	}
	return &cleaned
}

// Email нормализует почту (нижний регистр, без пробелов) и проверяет формат.
func (v *Validator) Email(field, value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	addr, err := mail.ParseAddress(value)
	if err != nil || addr.Address != value || len(value) > 254 || !strings.Contains(value[strings.LastIndex(value, "@"):], ".") {
		v.Fail(field, "Неверный формат почты")
	}
	return value
}

// OneOf проверяет, что значение из разрешённого списка.
func (v *Validator) OneOf(field, value string, allowed ...string) {
	for _, a := range allowed {
		if value == a {
			return
		}
	}
	v.Fail(field, "Недопустимое значение")
}

// Date разбирает дату вида 2026-10-27.
func (v *Validator) Date(field, value string) time.Time {
	date, err := time.Parse(time.DateOnly, value)
	if err != nil {
		v.Fail(field, "Неверная дата")
	}
	return date
}

// Birthday — дата рождения: не в будущем и не раньше 1900 года.
func (v *Validator) Birthday(field, value string) time.Time {
	date := v.Date(field, value)
	if !date.IsZero() && (date.After(time.Now()) || date.Year() < 1900) {
		v.Fail(field, "Неверная дата рождения")
	}
	return date
}

// Password проверяет пароль. Верхняя граница 72 байта — предел bcrypt:
// всё, что длиннее, bcrypt молча обрезал бы, и разные пароли стали бы одинаковыми.
func (v *Validator) Password(field, value string) {
	switch {
	case utf8.RuneCountInString(value) < 8:
		v.Fail(field, "Минимум 8 символов")
	case len(value) > 72:
		v.Fail(field, "Слишком длинный пароль")
	case strings.TrimSpace(value) == "":
		v.Fail(field, "Пароль не может состоять из пробелов")
	}
}
