package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/ATE826/Famigo/backend/internal/database"
	"github.com/ATE826/Famigo/backend/internal/httpx"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type resetDelivery struct{ code chan string }

func (m resetDelivery) SendCode(_ context.Context, _, code string) error { m.code <- code; return nil }

func TestPasswordResetFlow(t *testing.T) {
	url := os.Getenv("FAMIGO_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("requires isolated FAMIGO_TEST_DATABASE_URL")
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	db, err := database.Connect(context.Background(), url, log)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close(db)
	if err := database.Migrate(context.Background(), db, log); err != nil {
		t.Fatal(err)
	}
	s := NewService(db, NewTokenManager([]byte("reset-test-secret-reset-test-secret"), time.Minute), time.Hour, "test")
	mail := resetDelivery{code: make(chan string, 10)}
	s.SetEmailSender(mail, []byte("reset-code-secret-reset-code-secret"))
	h := NewHandler(s, CookieOptions{}, httpx.NewRateLimiter(1000, 1000))
	r := gin.New()
	r.POST("/request", h.requestPasswordReset)
	r.POST("/verify", h.verifyPasswordReset)
	r.POST("/reset", h.resetPassword)
	r.POST("/emailverify", h.verifyEmail)
	request := func(path string, body any, status int) map[string]any {
		t.Helper()
		data, _ := json.Marshal(body)
		rec := httptest.NewRecorder()
		req := httptest.NewRequest("POST", path, bytes.NewReader(data))
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(rec, req)
		if rec.Code != status {
			t.Fatalf("%s: got %d want %d: %s", path, rec.Code, status, rec.Body.String())
		}
		var result map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &result)
		return result
	}
	email := "reset-" + uuid.NewString() + "@example.com"
	pending, err := s.beginRegistration(context.Background(), RegisterInput{Name: "Reset test", Email: email, Password: "old password", Birthday: time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)})
	if err != nil {
		t.Fatal(err)
	}
	var usersBefore int64
	if err := db.Table("users").Where("email = ?", email).Count(&usersBefore).Error; err != nil || usersBefore != 0 {
		t.Fatalf("user created before confirmation: %d %v", usersBefore, err)
	}
	if _, err := s.Login(context.Background(), email, "old password", "test"); err == nil {
		t.Fatal("pending registration can log in")
	}
	registrationCode := <-mail.code
	wrongRegistrationCode := "000000"
	if registrationCode == wrongRegistrationCode {
		wrongRegistrationCode = "999999"
	}
	request("/emailverify", map[string]any{"challengeId": pending.ChallengeID, "code": wrongRegistrationCode}, 422)
	confirmed := request("/emailverify", map[string]any{"challengeId": pending.ChallengeID, "code": registrationCode}, 200)
	created := Session{UserID: uuid.MustParse(confirmed["userId"].(string))}
	request("/emailverify", map[string]any{"challengeId": pending.ChallengeID, "code": registrationCode}, 422)
	var remaining int64
	db.Model(&pendingRegistration{}).Where("id = ?", pending.ChallengeID).Count(&remaining)
	if remaining != 0 {
		t.Fatal("pending data retained after confirmation")
	}
	var verified bool
	if err := db.Raw("SELECT email_verified_at IS NOT NULL FROM users WHERE id = ?", created.UserID).Scan(&verified).Error; err != nil || !verified {
		t.Fatal("user not verified after confirmation")
	}
	defer db.Exec("DELETE FROM users WHERE id = ?", created.UserID)
	session, err := s.startSession(db, created.UserID, uuid.New(), "test")
	if err != nil {
		t.Fatal(err)
	}
	unknown := request("/request", map[string]any{"email": "missing-" + uuid.NewString() + "@example.com"}, 422)
	if unknown["challengeId"] != nil || unknown["error"].(map[string]any)["code"] != "account_not_found" {
		t.Fatal("unknown account received challenge")
	}
	known := request("/request", map[string]any{"email": email}, 202)
	if known["resendAt"] == nil {
		t.Fatal("known account missing challenge")
	}
	var code string
	select {
	case code = <-mail.code:
	case <-time.After(3 * time.Second):
		t.Fatal("no reset delivery")
	}
	// Delivery is asynchronous; wait until its transaction commits.
	id := known["challengeId"].(string)
	for until := time.Now().Add(time.Second); ; {
		var n int64
		db.Model(&emailCode{}).Where("id = ?", id).Count(&n)
		if n > 0 {
			break
		}
		if time.Now().After(until) {
			t.Fatal("challenge not saved")
		}
		time.Sleep(10 * time.Millisecond)
	}
	wrong := "000000"
	if code == wrong {
		wrong = "999999"
	}
	request("/verify", map[string]any{"challengeId": id, "code": wrong}, 422)
	grant := request("/verify", map[string]any{"challengeId": id, "code": code}, 200)
	request("/verify", map[string]any{"challengeId": id, "code": code}, 422)
	request("/verify", map[string]any{"challengeId": uuid.NewString(), "code": code}, 422)
	reset := map[string]any{"challengeId": id, "resetToken": grant["resetToken"], "password": "new password", "confirmPassword": "different"}
	request("/reset", reset, 422)
	reset["confirmPassword"] = "new password"
	reset["resetToken"] = newRefreshToken()
	request("/reset", reset, 422)
	reset["resetToken"] = grant["resetToken"]
	request("/reset", reset, 204)
	request("/reset", reset, 422)
	if _, err := s.Login(context.Background(), email, "old password", "test"); err == nil {
		t.Fatal("old password accepted")
	}
	if _, err := s.Login(context.Background(), email, "new password", "test"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Refresh(context.Background(), session.RefreshToken, "test"); err == nil {
		t.Fatal("old session survived")
	}
	if active, err := sessionActive(db, created.UserID, sessionIDFromTest(t, s, session)); err != nil || active {
		t.Fatalf("access session survived: %v", err)
	}

	for _, purpose := range []string{"email", "password_reset"} {
		row := emailCode{ID: uuid.New(), UserID: created.UserID, Purpose: purpose, Target: email, CreatedAt: time.Now(), ExpiresAt: time.Now().Add(time.Minute)}
		row.CodeHash = s.codeHash(row.ID, "123456")
		if err := db.Create(&row).Error; err != nil {
			t.Fatal(err)
		}
		if purpose == "email" {
			request("/verify", map[string]any{"challengeId": row.ID, "code": "123456"}, 422)
			continue
		}
		for i := 0; i < 5; i++ {
			request("/verify", map[string]any{"challengeId": row.ID, "code": "000000"}, 422)
		}
		request("/verify", map[string]any{"challengeId": row.ID, "code": "123456"}, 422)
		db.Model(&row).Updates(map[string]any{"attempts": 0, "expires_at": time.Now().Add(-time.Second)})
		request("/verify", map[string]any{"challengeId": row.ID, "code": "123456"}, 422)
	}
}

func sessionIDFromTest(t *testing.T, s *Service, session Session) uuid.UUID {
	t.Helper()
	_, id, err := s.tokens.Parse(session.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	return id
}
