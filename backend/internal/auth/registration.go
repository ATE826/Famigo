package auth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/ATE826/Famigo/backend/internal/database"
	"github.com/ATE826/Famigo/backend/internal/httpx"
	"github.com/ATE826/Famigo/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type pendingRegistration struct {
	ID                                                uuid.UUID `gorm:"primaryKey"`
	Email, Name, PasswordHash, LegalVersion, CodeHash string
	Birthday                                          time.Time
	Attempts                                          int
	CreatedAt, ExpiresAt                              time.Time
}

func (pendingRegistration) TableName() string { return "pending_registrations" }
func registrationChallenge(row pendingRegistration) challengeResponse {
	return challengeResponse{row.ID, row.Email, row.ExpiresAt, row.CreatedAt.Add(time.Minute)}
}

func (s *Service) sendRegistration(ctx context.Context, tx *gorm.DB, row *pendingRegistration) error {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return err
	}
	code := fmt.Sprintf("%06d", n.Int64())
	row.CodeHash = s.codeHash(row.ID, code)
	row.Attempts = 0
	row.CreatedAt = time.Now()
	row.ExpiresAt = row.CreatedAt.Add(10 * time.Minute)
	if err := s.email.SendCode(ctx, row.Email, code); err != nil {
		return errEmailUnavailable
	}
	return tx.Save(row).Error
}

func (s *Service) beginRegistration(ctx context.Context, in RegisterInput) (challengeResponse, error) {
	hash, err := HashPassword(in.Password)
	if err != nil {
		return challengeResponse{}, err
	}
	row := pendingRegistration{ID: uuid.New(), Email: in.Email, Name: in.Name, PasswordHash: hash, Birthday: in.Birthday, LegalVersion: s.legalVersion}
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Serialize registration requests for the same normalized email, including
		// when no pending row exists yet. The users unique index is the final guard.
		if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", strings.ToLower(in.Email)).Error; err != nil {
			return err
		}
		var count int64
		if err := tx.Model(&models.User{}).Where("lower(email) = lower(?)", in.Email).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return httpx.Conflict("email_taken", "Эта почта уже зарегистрирована")
		}
		if err := tx.Model(&pendingRegistration{}).Where("lower(email) = lower(?) AND created_at > ?", in.Email, time.Now().Add(-time.Minute)).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return httpx.TooManyRequests()
		}
		if err := tx.Where("lower(email) = lower(?) OR expires_at < ?", in.Email, time.Now()).Delete(&pendingRegistration{}).Error; err != nil {
			return err
		}
		return s.sendRegistration(ctx, tx, &row)
	})
	return registrationChallenge(row), err
}

// Registration uses a separate table so no user exists until code verification.
func (h *Handler) verifyRegistration(c *gin.Context, req codeRequest, id uuid.UUID) bool {
	var candidate pendingRegistration
	if err := h.service.db.WithContext(c.Request.Context()).First(&candidate, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false
		}
		httpx.Respond(c, err)
		return true
	}
	var session Session
	valid := false
	err := h.service.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var row pendingRegistration
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&row, "id = ?", id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		if row.Attempts >= 5 || !time.Now().Before(row.ExpiresAt) {
			return nil
		}
		if !hmac.Equal([]byte(row.CodeHash), []byte(h.service.codeHash(id, req.Code))) {
			return tx.Model(&row).Update("attempts", gorm.Expr("attempts + 1")).Error
		}
		now := time.Now()
		user := models.User{Email: row.Email, Name: row.Name, PasswordHash: row.PasswordHash, Birthday: &row.Birthday, AvatarTone: "green", EmailVerifiedAt: &now}
		if err := insertUser(tx, &user); err != nil {
			if database.IsUniqueViolation(err) {
				return httpx.Conflict("email_taken", "Эта почта уже зарегистрирована")
			}
			return err
		}
		if err := insertSettings(tx, user.ID); err != nil {
			return err
		}
		if err := insertConsents(tx, user.ID, row.LegalVersion, "terms", "privacy", "data"); err != nil {
			return err
		}
		var err error
		session, err = h.service.startSession(tx, user.ID, uuid.New(), c.Request.UserAgent())
		if err != nil {
			return err
		}
		if err := tx.Delete(&row).Error; err != nil {
			return err
		}
		valid = true
		return nil
	})
	if err != nil {
		httpx.Respond(c, err)
	} else if !valid {
		httpx.Respond(c, errCode)
	} else {
		h.respondSession(c, http.StatusOK, session)
	}
	return true
}

func (h *Handler) resendRegistration(c *gin.Context, id uuid.UUID) bool {
	db := h.service.db.WithContext(c.Request.Context())
	var row pendingRegistration
	if err := db.First(&row, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false
		}
		httpx.Respond(c, err)
		return true
	}
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&row, "id = ?", id).Error; err != nil {
			return errCode
		}
		if !time.Now().Before(row.ExpiresAt) {
			return errCode
		}
		if time.Now().Before(row.CreatedAt.Add(time.Minute)) {
			return httpx.TooManyRequests()
		}
		return h.service.sendRegistration(c.Request.Context(), tx, &row)
	})
	if err != nil {
		httpx.Respond(c, err)
	} else {
		c.JSON(http.StatusOK, registrationChallenge(row))
	}
	return true
}
