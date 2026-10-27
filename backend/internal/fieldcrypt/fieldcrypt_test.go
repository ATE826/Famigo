package fieldcrypt

import (
	"bytes"
	"encoding/base64"
	"errors"
	"strings"
	"testing"
)

func key(id uint16, fill byte) Key {
	return Key{ID: id, Secret: bytes.Repeat([]byte{fill}, KeySize)}
}

func mustNew(t *testing.T, keys ...Key) *Cipher {
	t.Helper()
	c, err := New(keys)
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestRoundTrip(t *testing.T) {
	c := mustNew(t, key(1, 'a'))
	for _, text := range []string{"Привет, мир", "a", "эмодзи 🎉 и\nперенос строки", strings.Repeat("я", 2000)} {
		stored, err := c.Encrypt(text, "aad")
		if err != nil {
			t.Fatal(err)
		}
		if !strings.HasPrefix(stored, Prefix) || strings.Contains(stored, text) {
			t.Fatalf("запись должна быть зашифрована: %.40q", stored)
		}
		got, err := c.Decrypt(stored, "aad")
		if err != nil || got != text {
			t.Fatalf("Decrypt = %q, %v; want %q", got, err, text)
		}
	}
}

// Один и тот же текст каждый раз даёт другой шифртекст (случайный nonce).
func TestEncryptionIsRandomized(t *testing.T) {
	c := mustNew(t, key(1, 'a'))
	a, _ := c.Encrypt("одинаковый текст", "aad")
	b, _ := c.Encrypt("одинаковый текст", "aad")
	if a == b {
		t.Fatal("одинаковые сообщения не должны давать одинаковый шифртекст")
	}
}

// Шифртекст нельзя перенести в другое сообщение или другой чат.
func TestAADBindsCiphertextToItsPlace(t *testing.T) {
	c := mustNew(t, key(1, 'a'))
	stored, _ := c.Encrypt("секрет", "message|chat-1|msg-1")
	if _, err := c.Decrypt(stored, "message|chat-1|msg-2"); !errors.Is(err, ErrDecrypt) {
		t.Fatalf("перенос в другое сообщение должен отклоняться, err = %v", err)
	}
	if _, err := c.Decrypt(stored, "message|chat-2|msg-1"); !errors.Is(err, ErrDecrypt) {
		t.Fatalf("перенос в другой чат должен отклоняться, err = %v", err)
	}
}

func TestTamperedDataIsRejected(t *testing.T) {
	c := mustNew(t, key(1, 'a'))
	stored, _ := c.Encrypt("секрет", "aad")
	// Меняем один символ шифртекста.
	last := stored[len(stored)-1]
	flipped := stored[:len(stored)-1] + string(map[bool]byte{true: 'B', false: 'A'}[last == 'A'])
	if _, err := c.Decrypt(flipped, "aad"); !errors.Is(err, ErrDecrypt) {
		t.Fatalf("изменённые данные должны отклоняться, err = %v", err)
	}
	for _, bad := range []string{Prefix, Prefix + "1:", Prefix + "1:!!!", Prefix + "x:abc", Prefix + "1:" + base64.RawURLEncoding.EncodeToString([]byte("коротко"))} {
		if _, err := c.Decrypt(bad, "aad"); err == nil {
			t.Fatalf("мусор %q должен отклоняться", bad)
		}
	}
}

func TestWrongKeyCannotDecrypt(t *testing.T) {
	stored, _ := mustNew(t, key(1, 'a')).Encrypt("секрет", "aad")
	if _, err := mustNew(t, key(1, 'b')).Decrypt(stored, "aad"); !errors.Is(err, ErrDecrypt) {
		t.Fatalf("чужой ключ с тем же номером: err = %v", err)
	}
	if _, err := mustNew(t, key(2, 'a')).Decrypt(stored, "aad"); !errors.Is(err, ErrUnknownKey) {
		t.Fatalf("нет ключа с таким номером: err = %v", err)
	}
}

// Смена ключа: новые записи идут активным (первым) ключом, старые читаются старым.
func TestKeyRotation(t *testing.T) {
	old := mustNew(t, key(1, 'a'))
	oldStored, _ := old.Encrypt("старое", "aad")

	rotated := mustNew(t, key(2, 'b'), key(1, 'a'))
	if got, err := rotated.Decrypt(oldStored, "aad"); err != nil || got != "старое" {
		t.Fatalf("старая запись после смены ключа: %q, %v", got, err)
	}
	newStored, _ := rotated.Encrypt("новое", "aad")
	if !strings.HasPrefix(newStored, "enc:v1:2:") || !strings.HasPrefix(rotated.ActivePrefix(), "enc:v1:2:") {
		t.Fatalf("новые записи должны идти ключом 2: %.20q", newStored)
	}
	if strings.HasPrefix(oldStored, rotated.ActivePrefix()) {
		t.Fatal("старая запись не должна считаться переведённой на новый ключ")
	}
}

// Без ключей (режим разработки) ничего не шифруется, а старый текст читается как есть.
func TestDisabledCipherPassesThrough(t *testing.T) {
	c := mustNew(t)
	if c.Enabled() {
		t.Fatal("без ключей шифрование выключено")
	}
	stored, _ := c.Encrypt("открытый текст", "aad")
	if stored != "открытый текст" {
		t.Fatalf("выключенный Cipher не должен шифровать: %q", stored)
	}
	if got, _ := c.Decrypt("старое сообщение без префикса", "aad"); got != "старое сообщение без префикса" {
		t.Fatal("текст без префикса читается как есть")
	}
}

func TestLegacyPlaintextIsReadable(t *testing.T) {
	c := mustNew(t, key(1, 'a'))
	if got, err := c.Decrypt("обычное старое сообщение", "aad"); err != nil || got != "обычное старое сообщение" {
		t.Fatalf("старое сообщение до миграции должно читаться: %q, %v", got, err)
	}
}

func TestNewValidatesKeys(t *testing.T) {
	if _, err := New([]Key{{ID: 1, Secret: []byte("короткий")}}); err == nil {
		t.Fatal("короткий ключ должен отклоняться")
	}
	if _, err := New([]Key{key(1, 'a'), key(1, 'b')}); err == nil {
		t.Fatal("повторяющийся номер должен отклоняться")
	}
}

func TestParseKeys(t *testing.T) {
	a := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{'a'}, KeySize))
	b := base64.RawStdEncoding.EncodeToString(bytes.Repeat([]byte{'b'}, KeySize)) // без «=» тоже принимаем

	keys, err := ParseKeys(" 2:" + a + " , 1:" + b + ",")
	if err != nil || len(keys) != 2 || keys[0].ID != 2 || keys[1].ID != 1 {
		t.Fatalf("ParseKeys = %v, %v", keys, err)
	}
	if keys, err := ParseKeys(""); err != nil || len(keys) != 0 {
		t.Fatalf("пустое значение = нет ключей: %v, %v", keys, err)
	}

	// Ошибки не должны содержать сам ключ: он попал бы в логи.
	secret := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{'z'}, 10))
	for _, bad := range []string{"нет-двоеточия", "0:" + a, "x:" + a, "99999:" + a, "1:не-base64!", "1:" + secret} {
		_, err := ParseKeys(bad)
		if err == nil {
			t.Fatalf("%q должен отклоняться", bad)
		}
		if strings.Contains(err.Error(), secret) || strings.Contains(err.Error(), a) {
			t.Fatalf("ошибка раскрывает ключ: %v", err)
		}
	}
}
