package auth

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/httpx"
)

const (
	userIDKey    = "auth_user_id"
	sessionIDKey = "auth_session_id"
)

// RequireAuth пропускает запрос дальше, только если в заголовке
// Authorization: Bearer <токен> лежит действующий access-токен и его сессия ещё жива.
// Вторая проверка (в базе) нужна, чтобы выход, смена пароля и удаление аккаунта
// действовали сразу: иначе токен работал бы до конца своего срока (15 минут).
func RequireAuth(tokens *TokenManager, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		scheme, token, ok := strings.Cut(c.GetHeader("Authorization"), " ")
		if !ok || !strings.EqualFold(scheme, "Bearer") || token == "" {
			httpx.Respond(c, httpx.Unauthorized("Нужно войти"))
			return
		}
		userID, sessionID, err := tokens.Parse(token)
		if err != nil {
			httpx.Respond(c, httpx.Unauthorized("Сессия истекла, войдите снова"))
			return
		}
		active, err := sessionActive(db.WithContext(c.Request.Context()), userID, sessionID)
		if err != nil {
			httpx.Respond(c, err)
			return
		}
		if !active {
			httpx.Respond(c, httpx.Unauthorized("Сессия истекла, войдите снова"))
			return
		}
		c.Set(userIDKey, userID)
		c.Set(sessionIDKey, sessionID)
		c.Next()
	}
}

// UserID — id вошедшего пользователя. Берётся только из проверенного токена,
// никогда из тела запроса или параметров: иначе можно было бы действовать от чужого имени.
func UserID(c *gin.Context) uuid.UUID {
	id, _ := c.Get(userIDKey)
	userID, _ := id.(uuid.UUID)
	return userID
}

// SessionID — номер сессии входа из проверенного токена.
func SessionID(c *gin.Context) uuid.UUID {
	id, _ := c.Get(sessionIDKey)
	sessionID, _ := id.(uuid.UUID)
	return sessionID
}

// SessionActive — сессия ещё не завершена. Нужна долгоживущим соединениям (WebSocket):
// они проверяют сессию не на каждый запрос, а время от времени.
func SessionActive(db *gorm.DB, userID, sessionID uuid.UUID) (bool, error) {
	return sessionActive(db, userID, sessionID)
}
