package auth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"net/http"
	"time"

	"github.com/ATE826/Famigo/backend/internal/httpx"
	"github.com/ATE826/Famigo/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type emailSender interface {
	SendCode(context.Context, string, string) error
}

func (s *Service) SetEmailSender(sender emailSender, secret []byte) {
	s.email = sender
	s.codeSecret = secret
}

var errEmailUnavailable = &httpx.Error{Status: 503, Code: "email_unavailable", Message: "Не удалось отправить письмо. Попробуйте позже"}
var errCode = &httpx.Error{Status: 422, Code: "invalid_code", Message: "Неверный или просроченный код"}

type emailCode struct {
	ID                        uuid.UUID `gorm:"primaryKey"`
	UserID                    uuid.UUID
	Purpose, Target, CodeHash string
	Attempts                  int
	CreatedAt, ExpiresAt      time.Time
	UsedAt                    *time.Time
}

func (emailCode) TableName() string { return "verification_codes" }

type challengeResponse struct {
	ChallengeID uuid.UUID `json:"challengeId"`
	Email       string    `json:"email"`
	ExpiresAt   time.Time `json:"expiresAt"`
	ResendAt    time.Time `json:"resendAt"`
}

func challenge(c emailCode) challengeResponse {
	return challengeResponse{c.ID, c.Target, c.ExpiresAt, c.CreatedAt.Add(time.Minute)}
}
func (s *Service) codeHash(id uuid.UUID, code string) string {
	h := hmac.New(sha256.New, s.codeSecret)
	_, _ = h.Write([]byte(id.String() + ":" + code))
	return hex.EncodeToString(h.Sum(nil))
}
func (s *Service) deliver(ctx context.Context, tx *gorm.DB, c *emailCode) error {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return err
	}
	code := fmt.Sprintf("%06d", n.Int64())
	c.CodeHash = s.codeHash(c.ID, code)
	c.Attempts = 0
	c.CreatedAt = time.Now()
	c.ExpiresAt = c.CreatedAt.Add(10 * time.Minute)
	if err := s.email.SendCode(ctx, c.Target, code); err != nil {
		return errEmailUnavailable
	}
	return tx.Save(c).Error
}
func (h *Handler) respondChallenge(c *gin.Context, status int, userID uuid.UUID) {
	var row emailCode
	err := h.service.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var u models.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&u, "id = ?", userID).Error; err != nil {
			return err
		}
		var count int64
		if err := tx.Model(&emailCode{}).Where("user_id = ? AND purpose = 'email' AND used_at IS NULL AND created_at > ?", userID, time.Now().Add(-time.Minute)).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return httpx.TooManyRequests()
		}
		// Только последняя проверка входа может выдать сессию.
		if err := tx.Model(&emailCode{}).Where("user_id = ? AND purpose = 'email' AND used_at IS NULL", userID).Update("used_at", time.Now()).Error; err != nil {
			return err
		}
		row = emailCode{ID: uuid.New(), UserID: userID, Purpose: "email", Target: u.Email}
		return h.service.deliver(c.Request.Context(), tx, &row)
	})
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	c.JSON(status, challenge(row))
}

type codeRequest struct {
	ChallengeID string `json:"challengeId"`
	Code        string `json:"code"`
}

func readCodeRequest(c *gin.Context) (codeRequest, uuid.UUID, error) {
	var req codeRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		return req, uuid.Nil, err
	}
	id, err := uuid.Parse(req.ChallengeID)
	if err != nil {
		return req, uuid.Nil, errCode
	}
	return req, id, nil
}
func (h *Handler) verifyEmail(c *gin.Context) {
	if h.service.email == nil {
		httpx.Respond(c, errEmailUnavailable)
		return
	}
	req, id, err := readCodeRequest(c)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	if len(req.Code) != 6 {
		httpx.Respond(c, errCode)
		return
	}
	var session Session
	valid := false
	err = h.service.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var row emailCode
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&row, "id = ? AND purpose = 'email'", id).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		if row.UsedAt != nil || row.Attempts >= 5 || time.Now().After(row.ExpiresAt) {
			return nil
		}
		if !hmac.Equal([]byte(row.CodeHash), []byte(h.service.codeHash(id, req.Code))) {
			return tx.Model(&row).Update("attempts", gorm.Expr("attempts + 1")).Error
		}
		now := time.Now()
		if err := tx.Model(&row).Update("used_at", now).Error; err != nil {
			return err
		}
		updated := tx.Model(&models.User{}).Where("id = ? AND email = ?", row.UserID, row.Target).Update("email_verified_at", now)
		if updated.Error != nil {
			return updated.Error
		}
		if updated.RowsAffected != 1 {
			return errCode
		}
		var err error
		session, err = h.service.startSession(tx, row.UserID, uuid.New(), c.Request.UserAgent())
		valid = err == nil
		return err
	})
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	if !valid {
		httpx.Respond(c, errCode)
		return
	}
	h.respondSession(c, http.StatusOK, session)
}
func (h *Handler) resendEmail(c *gin.Context) {
	if h.service.email == nil {
		httpx.Respond(c, errEmailUnavailable)
		return
	}
	_, id, err := readCodeRequest(c)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	var row emailCode
	err = h.service.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&row, "id = ? AND purpose = 'email'", id).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return errCode
			}
			return err
		}
		if row.UsedAt != nil || time.Now().After(row.ExpiresAt) {
			return errCode
		}
		if time.Now().Before(row.CreatedAt.Add(time.Minute)) {
			return httpx.TooManyRequests()
		}
		return h.service.deliver(c.Request.Context(), tx, &row)
	})
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, challenge(row))
}
