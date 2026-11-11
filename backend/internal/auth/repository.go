package auth

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/ATE826/Famigo/backend/internal/models"
)

// Все условия — с параметрами «?»: значения от пользователя не попадают в текст SQL.
// db — пул или транзакция (*gorm.DB внутри db.Transaction), контекст запроса уже в нём.

func insertUser(db *gorm.DB, u *models.User) error {
	return db.Create(u).Error
}

func insertSettings(db *gorm.DB, userID uuid.UUID) error {
	settings := models.DefaultSettings(userID)
	return db.Create(&settings).Error
}

func insertConsents(db *gorm.DB, userID uuid.UUID, version string, documents ...string) error {
	consents := make([]models.Consent, len(documents))
	for i, doc := range documents {
		consents[i] = models.Consent{UserID: userID, Document: doc, Version: version}
	}
	return db.Create(&consents).Error
}

// findByEmail — почта сравнивается без учёта регистра, как в уникальном индексе users_email_unique.
func findByEmail(db *gorm.DB, email string) (models.User, error) {
	var u models.User
	err := db.Select("id", "password_hash").Where("lower(email) = lower(?)", email).Take(&u).Error
	return u, err
}

func passwordHash(db *gorm.DB, userID uuid.UUID) (string, error) {
	var u models.User
	err := db.Select("password_hash").Where("id = ?", userID).Take(&u).Error
	return u.PasswordHash, err
}

func updatePassword(db *gorm.DB, userID uuid.UUID, hash string) error {
	return db.Model(&models.User{}).Where("id = ?", userID).Update("password_hash", hash).Error
}

func insertRefreshToken(db *gorm.DB, token *models.RefreshToken) error {
	// Заодно чистим просроченные сессии этого пользователя, чтобы таблица не разрасталась.
	if err := db.Where("user_id = ? AND expires_at < now()", token.UserID).Delete(&models.RefreshToken{}).Error; err != nil {
		return err
	}
	return db.Create(token).Error
}

// lockRefreshToken находит сессию и блокирует строку до конца транзакции (FOR UPDATE):
// если один токен прислали дважды одновременно, второй запрос подождёт и увидит,
// что токен уже обменян.
func lockRefreshToken(tx *gorm.DB, tokenHash string) (models.RefreshToken, error) {
	var t models.RefreshToken
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("token_hash = ?", tokenHash).Take(&t).Error
	return t, err
}

func markReplaced(db *gorm.DB, id uuid.UUID, at time.Time) error {
	return db.Model(&models.RefreshToken{}).Where("id = ? AND replaced_at IS NULL", id).Update("replaced_at", at).Error
}

// revokeSessionByHash завершает всю сессию, к которой относится токен: и сам токен,
// и более старые токены той же сессии, и (через sessionActive) выданные ей access-токены.
func revokeSessionByHash(db *gorm.DB, tokenHash string) error {
	return db.Model(&models.RefreshToken{}).
		Where("session_id = (SELECT session_id FROM refresh_tokens WHERE token_hash = ?) AND revoked_at IS NULL", tokenHash).
		Update("revoked_at", gorm.Expr("now()")).Error
}

// sessionActive — сессия существует, не завершена и не истекла. Заодно это проверка,
// что пользователь не удалён: токены удалённого пользователя уходят каскадом.
func sessionActive(db *gorm.DB, userID, sessionID uuid.UUID) (bool, error) {
	var n int64
	err := db.Model(&models.RefreshToken{}).
		Where("session_id = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > now()", sessionID, userID).
		Count(&n).Error
	return n > 0, err
}

func revokeAllRefreshTokens(db *gorm.DB, userID uuid.UUID) error {
	return db.Model(&models.RefreshToken{}).
		Where("user_id = ? AND revoked_at IS NULL", userID).
		Update("revoked_at", gorm.Expr("now()")).Error
}
