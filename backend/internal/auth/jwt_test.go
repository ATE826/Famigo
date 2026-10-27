package auth

import (
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var testSecret = []byte("test-secret-test-secret-test-secret!")

func TestTokenRoundTrip(t *testing.T) {
	m := NewTokenManager(testSecret, time.Minute)
	userID, sessionID := uuid.New(), uuid.New()
	token, _, err := m.Issue(userID, sessionID)
	if err != nil {
		t.Fatal(err)
	}
	gotUser, gotSession, err := m.Parse(token)
	if err != nil || gotUser != userID || gotSession != sessionID {
		t.Fatalf("Parse = %v, %v, %v; want %v, %v", gotUser, gotSession, err, userID, sessionID)
	}
}

func TestTokenRejectsWrongSecret(t *testing.T) {
	token, _, _ := NewTokenManager(testSecret, time.Minute).Issue(uuid.New(), uuid.New())
	if _, _, err := NewTokenManager([]byte("another-secret-another-secret-123"), time.Minute).Parse(token); err == nil {
		t.Fatal("токен с чужой подписью должен отклоняться")
	}
}

func TestTokenRejectsExpired(t *testing.T) {
	m := NewTokenManager(testSecret, -time.Hour)
	token, _, _ := m.Issue(uuid.New(), uuid.New())
	if _, _, err := m.Parse(token); err == nil {
		t.Fatal("просроченный токен должен отклоняться")
	}
}

// Классическая атака: токен с алгоритмом "none" и без подписи.
func TestTokenRejectsAlgNone(t *testing.T) {
	claims := jwt.RegisteredClaims{
		Subject:   uuid.NewString(),
		Issuer:    issuer,
		Audience:  jwt.ClaimStrings{audience},
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodNone, claims).SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := NewTokenManager(testSecret, time.Minute).Parse(token); err == nil {
		t.Fatal("токен без подписи (alg=none) должен отклоняться")
	}
}

func TestTokenRejectsTampered(t *testing.T) {
	m := NewTokenManager(testSecret, time.Minute)
	token, _, _ := m.Issue(uuid.New(), uuid.New())
	parts := strings.Split(token, ".")
	other, _, _ := m.Issue(uuid.New(), uuid.New())
	// Подпись от одного токена, данные от другого.
	forged := strings.Split(other, ".")[0] + "." + strings.Split(other, ".")[1] + "." + parts[2]
	if _, _, err := m.Parse(forged); err == nil {
		t.Fatal("токен с подменёнными данными должен отклоняться")
	}
}

func TestRefreshTokensAreUniqueAndHashed(t *testing.T) {
	a, b := newRefreshToken(), newRefreshToken()
	if a == b || len(a) < 40 {
		t.Fatalf("refresh-токены должны быть длинными и случайными: %q %q", a, b)
	}
	if hashToken(a) == a || len(hashToken(a)) != 64 {
		t.Fatal("в базе должен храниться SHA-256 хеш, а не токен")
	}
}

func TestPasswordHashing(t *testing.T) {
	hash, err := HashPassword("correct horse")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(hash, "correct horse") || !CheckPassword(hash, "correct horse") || CheckPassword(hash, "wrong") {
		t.Fatal("bcrypt-хеш работает неправильно")
	}
	other, _ := HashPassword("correct horse")
	if other == hash {
		t.Fatal("у одинаковых паролей хеши должны отличаться (соль)")
	}
}

// Токен без номера сессии (выпущенный до этой версии) принимать нельзя:
// иначе его нельзя было бы отозвать при выходе.
func TestTokenWithoutSessionIsRejected(t *testing.T) {
	c := jwt.RegisteredClaims{
		Subject:   uuid.NewString(),
		Issuer:    issuer,
		Audience:  jwt.ClaimStrings{audience},
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(testSecret)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := NewTokenManager(testSecret, time.Minute).Parse(token); err == nil {
		t.Fatal("токен без sid должен отклоняться")
	}
}
