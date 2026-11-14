package auth

import (
	"context"
	"crypto/hmac"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/ATE826/Famigo/backend/internal/httpx"
	"github.com/ATE826/Famigo/backend/internal/models"
)

// Check account existence before allowing the UI to advance to code entry.
// This deliberately exposes account existence; the shared IP limiter remains active.
func (h *Handler) requestPasswordReset(c *gin.Context) {
	var req struct {
		Email string `json:"email"`
	}
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	v := httpx.NewValidator()
	email := v.Email("email", req.Email)
	if err := v.Err(); err != nil {
		httpx.Respond(c, err)
		return
	}
	if _, err := findByEmail(h.service.db.WithContext(c.Request.Context()), email); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			httpx.Respond(c, &httpx.Error{Status: http.StatusUnprocessableEntity, Code: "account_not_found", Message: "Аккаунт с такой почтой не найден", Fields: map[string]string{"email": "Аккаунт с такой почтой не найден"}})
		} else {
			httpx.Respond(c, err)
		}
		return
	}
	row := emailCode{ID: uuid.New(), Purpose: "password_reset", Target: email, CreatedAt: time.Now()}
	row.ExpiresAt = row.CreatedAt.Add(10 * time.Minute)
	if h.service.email != nil && h.resetByEmail.Allow(email) {
		go h.service.issuePasswordReset(row)
	}
	c.JSON(http.StatusAccepted, challenge(row))
}

func (s *Service) issuePasswordReset(row emailCode) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var user models.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("lower(email) = lower(?)", row.Target).Take(&user).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		// Persistent per-account limits survive process restarts. Only successful
		// deliveries create rows; requests never lock or modify the account itself.
		var recent, hourly int64
		q := tx.Model(&emailCode{}).Where("user_id = ? AND purpose = 'password_reset'", user.ID)
		if err := q.Where("created_at > ?", time.Now().Add(-time.Minute)).Count(&recent).Error; err != nil {
			return err
		}
		if err := tx.Model(&emailCode{}).Where("user_id = ? AND purpose = 'password_reset' AND created_at > ?", user.ID, time.Now().Add(-time.Hour)).Count(&hourly).Error; err != nil {
			return err
		}
		if recent > 0 || hourly >= 3 {
			return nil
		}
		if err := tx.Model(&emailCode{}).Where("user_id = ? AND purpose = 'password_reset' AND used_at IS NULL", user.ID).Update("used_at", time.Now()).Error; err != nil {
			return err
		}
		row.UserID, row.Target = user.ID, user.Email
		return s.deliver(ctx, tx, &row)
	})
	if err != nil {
		slog.Warn("не удалось отправить код сброса пароля")
	}
}

func resetCodeValid(row emailCode, now time.Time) bool {
	return row.Purpose == "password_reset" && row.UsedAt == nil && row.VerifiedAt == nil && row.Attempts < 5 && now.Before(row.ExpiresAt)
}

func (h *Handler) verifyPasswordReset(c *gin.Context) {
	req, id, err := readCodeRequest(c)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	if len(req.Code) != 6 {
		httpx.Respond(c, errCode)
		return
	}
	var token string
	err = h.service.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var row emailCode
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND purpose = 'password_reset'", id).Take(&row).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		if !resetCodeValid(row, time.Now()) {
			return nil
		}
		if !hmac.Equal([]byte(row.CodeHash), []byte(h.service.codeHash(id, req.Code))) {
			return tx.Model(&row).Update("attempts", gorm.Expr("attempts + 1")).Error
		}
		token = newRefreshToken()
		return tx.Model(&row).Updates(map[string]any{"verified_at": time.Now(), "code_hash": h.service.codeHash(id, token)}).Error
	})
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	if token == "" {
		httpx.Respond(c, errCode)
		return
	}
	c.JSON(http.StatusOK, gin.H{"resetToken": token})
}

func (h *Handler) resetPassword(c *gin.Context) {
	var req struct {
		ChallengeID     string `json:"challengeId"`
		ResetToken      string `json:"resetToken"`
		Password        string `json:"password"`
		ConfirmPassword string `json:"confirmPassword"`
	}
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	v := httpx.NewValidator()
	v.Password("password", req.Password)
	v.Check(req.Password == req.ConfirmPassword, "confirmPassword", "Пароли не совпадают")
	if err := v.Err(); err != nil {
		httpx.Respond(c, err)
		return
	}
	id, err := uuid.Parse(req.ChallengeID)
	if err != nil || len(req.ResetToken) != len(newRefreshToken()) {
		httpx.Respond(c, errCode)
		return
	}
	err = h.service.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		// Lock user first, matching issuance. Concurrent completion, resend and
		// login-code checks cannot revive credentials after this reset commits.
		var candidate emailCode
		if err := tx.Where("id = ? AND purpose = 'password_reset'", id).Take(&candidate).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errCode
			}
			return err
		}
		var user models.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, "id = ?", candidate.UserID).Error; err != nil {
			return err
		}
		var row emailCode
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&row, "id = ?", id).Error; err != nil {
			return err
		}
		if row.UsedAt != nil || row.VerifiedAt == nil || !time.Now().Before(row.ExpiresAt) || !hmac.Equal([]byte(row.CodeHash), []byte(h.service.codeHash(id, req.ResetToken))) {
			return errCode
		}
		hash, err := HashPassword(req.Password)
		if err != nil {
			return err
		}
		if err := updatePassword(tx, row.UserID, hash); err != nil {
			return err
		}
		if err := revokeAllRefreshTokens(tx, row.UserID); err != nil {
			return err
		}
		return tx.Model(&emailCode{}).Where("user_id = ? AND used_at IS NULL", row.UserID).Update("used_at", time.Now()).Error
	})
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	h.clearRefreshCookie(c)
	httpx.NoContent(c)
}
