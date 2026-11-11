package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Как устроен вход:
//   - access-токен (JWT) живёт 15 минут, лежит у фронтенда в памяти и отправляется
//     в заголовке Authorization. Короткий срок ограничивает вред, если его украдут.
//     В токене есть номер сессии (sid): после выхода или смены пароля сервер видит,
//     что сессия завершена, и отклоняет токен сразу, не дожидаясь конца срока;
//   - refresh-токен живёт 30 дней в httpOnly-куке: JavaScript на странице его не видит,
//     поэтому XSS не сможет его украсть. Им получают новый access-токен.
//     В базе хранится только его SHA-256 хеш.

const (
	issuer   = "famigo"
	audience = "famigo-web"
)

var errInvalidToken = errors.New("invalid token")

type TokenManager struct {
	secret []byte
	ttl    time.Duration
}

func NewTokenManager(secret []byte, ttl time.Duration) *TokenManager {
	return &TokenManager{secret: secret, ttl: ttl}
}

// claims — содержимое access-токена: стандартные поля и номер сессии.
type claims struct {
	jwt.RegisteredClaims
	SessionID string `json:"sid"`
}

// Issue выпускает access-токен для пользователя в рамках сессии sessionID.
func (m *TokenManager) Issue(userID, sessionID uuid.UUID) (string, time.Time, error) {
	now := time.Now()
	expires := now.Add(m.ttl)
	claims := claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			Issuer:    issuer,
			Audience:  jwt.ClaimStrings{audience},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expires),
		},
		SessionID: sessionID.String(),
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
	return token, expires, err
}

// Parse проверяет подпись и срок токена и возвращает id пользователя и номер сессии.
// Токен без номера сессии (выпущенный старой версией) отклоняется: клиент получит 401,
// обновит сессию по куке и продолжит работу.
// Разрешён только алгоритм HS256: это закрывает известные атаки, когда в токене
// подменяют алгоритм на "none" (без подписи) или на RS256 с публичным ключом.
func (m *TokenManager) Parse(token string) (userID, sessionID uuid.UUID, err error) {
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(issuer),
		jwt.WithAudience(audience),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
		jwt.WithLeeway(30*time.Second),
	)
	var c claims
	if _, err := parser.ParseWithClaims(token, &c, func(*jwt.Token) (any, error) { return m.secret, nil }); err != nil {
		return uuid.Nil, uuid.Nil, errInvalidToken
	}
	userID, err = uuid.Parse(c.Subject)
	if err != nil {
		return uuid.Nil, uuid.Nil, errInvalidToken
	}
	sessionID, err = uuid.Parse(c.SessionID)
	if err != nil {
		return uuid.Nil, uuid.Nil, errInvalidToken
	}
	return userID, sessionID, nil
}

// newRefreshToken — 32 случайных байта (256 бит): угадать невозможно.
func newRefreshToken() string {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(buf)
}

// hashToken — в базе лежит хеш, а не сам токен. Для длинного случайного токена
// достаточно быстрого SHA-256 (bcrypt нужен для паролей, которые придумывают люди).
func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
