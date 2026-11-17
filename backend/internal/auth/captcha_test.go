package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/ATE826/Famigo/backend/internal/database"
	"github.com/ATE826/Famigo/backend/internal/httpx"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestYandexCaptchaValidation(t *testing.T) {
	for _, tc := range []struct {
		name, body string
		status     int
		want       error
	}{
		{"ok", `{"status":"ok","host":"localhost"}`, 200, nil},
		{"localhost with port", `{"status":"ok","host":"localhost:8080"}`, 200, nil},
		{"vite port", `{"status":"ok","host":"localhost:5173"}`, 200, nil},
		{"case and trailing dot", `{"status":"ok","host":"LOCALHOST.:8080"}`, 200, nil},
		{"wrong host", `{"status":"ok","host":"evil.example"}`, 200, errCaptchaInvalid},
		{"lookalike host", `{"status":"ok","host":"localhost.evil.example:8080"}`, 200, errCaptchaInvalid},
		{"userinfo", `{"status":"ok","host":"localhost@evil.example:8080"}`, 200, errCaptchaInvalid},
		{"URL instead of host", `{"status":"ok","host":"https://localhost:8080"}`, 200, errCaptchaInvalid},
		{"invalid port", `{"status":"ok","host":"localhost:99999"}`, 200, errCaptchaInvalid},
		{"missing host", `{"status":"ok"}`, 200, errCaptchaInvalid},
		{"failed", `{"status":"failed"}`, 200, errCaptchaInvalid},
		{"service down", `{}`, 503, errCaptchaUnavailable},
		{"broken JSON", `broken`, 200, errCaptchaUnavailable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				r.ParseForm()
				if r.Method != "POST" || r.Form.Get("secret") != "server-test" || r.Form.Get("token") != "token-test" || r.Form.Get("ip") != "192.0.2.1" {
					t.Error("wrong validation request")
				}
				w.WriteHeader(tc.status)
				io.WriteString(w, tc.body)
			}))
			defer srv.Close()
			v := &yandexCaptcha{config: CaptchaConfig{ServerKey: "server-test", AllowedHosts: []string{"localhost"}}, client: srv.Client(), endpoint: srv.URL}
			if err := v.Verify(context.Background(), "token-test", "192.0.2.1"); err != tc.want {
				t.Fatalf("got %v want %v", err, tc.want)
			}
			if err := v.Verify(context.Background(), "", "192.0.2.1"); err != errCaptchaRequired {
				t.Fatal("empty token accepted")
			}
			if err := v.Verify(context.Background(), strings.Repeat("x", 16385), "192.0.2.1"); err != errCaptchaInvalid {
				t.Fatal("oversize token accepted")
			}
			if calls != 1 {
				t.Fatal("invalid input reached provider")
			}
		})
	}
}

func TestCaptchaAuthFlow(t *testing.T) {
	databaseURL := os.Getenv("FAMIGO_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("requires isolated FAMIGO_TEST_DATABASE_URL")
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	db, err := database.Connect(context.Background(), databaseURL, log)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close(db)
	if err = database.Migrate(context.Background(), db, log); err != nil {
		t.Fatal(err)
	}
	secret := []byte("captcha-test-secret-captcha-test-secret")
	service := NewService(db, NewTokenManager(secret, time.Minute), time.Hour, "test")
	mail := resetDelivery{code: make(chan string, 20)}
	service.SetEmailSender(mail, secret)
	var mu sync.Mutex
	used := map[string]bool{}
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.ParseForm()
		token := r.Form.Get("token")
		mu.Lock()
		defer mu.Unlock()
		if token == "down" {
			w.WriteHeader(503)
			return
		}
		if used[token] || !strings.HasPrefix(token, "valid-") {
			io.WriteString(w, `{"status":"failed"}`)
			return
		}
		used[token] = true
		io.WriteString(w, `{"status":"ok","host":"localhost:8080"}`)
	}))
	defer provider.Close()
	cfg := CaptchaConfig{ClientKey: "public-test", ServerKey: "server-test", AllowedHosts: []string{"localhost"}}
	makeRouter := func() *gin.Engine {
		h := NewHandler(service, CookieOptions{}, httpx.NewRateLimiter(1000, 1000)).WithCaptcha(cfg, secret)
		h.loginByEmail = httpx.NewRateLimiter(1000, 1000)
		h.captcha = &yandexCaptcha{config: cfg, client: provider.Client(), endpoint: provider.URL}
		r := gin.New()
		r.SetTrustedProxies(nil)
		g := r.Group("")
		h.RegisterRoutes(g, g, g)
		return r
	}
	router := makeRouter()
	request := func(method, path string, body any, status int) map[string]any {
		t.Helper()
		data, _ := json.Marshal(body)
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(method, path, bytes.NewReader(data))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(rec, req)
		if rec.Code != status {
			t.Fatalf("%s %s: %d want %d: %s", method, path, rec.Code, status, rec.Body.String())
		}
		if strings.Contains(rec.Body.String(), cfg.ServerKey) {
			t.Fatal("server key leaked")
		}
		var result map[string]any
		json.Unmarshal(rec.Body.Bytes(), &result)
		return result
	}
	email := "captcha-" + uuid.NewString() + "@example.com"
	registration := map[string]any{"name": "Captcha test", "email": email, "password": "Password1!", "birthday": "1990-05-01", "acceptTerms": true, "acceptData": true}
	request("POST", "/auth/register", registration, 403)
	var count int64
	db.Table("pending_registrations").Where("email=?", email).Count(&count)
	if count != 0 {
		t.Fatal("registration bypassed captcha")
	}
	registration["captchaToken"] = "bad"
	request("POST", "/auth/register", registration, 403)
	registration["captchaToken"] = "valid-register"
	challenge := request("POST", "/auth/register", registration, 201)
	request("POST", "/auth/email/verify", map[string]any{"challengeId": challenge["challengeId"], "code": <-mail.code}, 200)
	if request("GET", "/auth/captcha", nil, 200)["required"] != false {
		t.Fatal("first login should not require captcha")
	}
	login := map[string]any{"email": email, "password": "wrong password"}
	request("POST", "/auth/login", login, 401)
	if request("GET", "/auth/captcha", nil, 200)["required"] != true {
		t.Fatal("failed login did not set gate")
	}
	// A new handler and no browser cookies must preserve the requirement.
	router = makeRouter()
	if request("GET", "/auth/captcha", nil, 200)["required"] != true {
		t.Fatal("restart cleared gate")
	}
	login["password"] = "Password1!"
	request("POST", "/auth/login", login, 403)
	login["captchaToken"] = "bad"
	request("POST", "/auth/login", login, 403)
	login["captchaToken"] = "down"
	request("POST", "/auth/login", login, 503)
	login["email"] = "other-" + email
	delete(login, "captchaToken")
	request("POST", "/auth/login", login, 403)
	login["email"] = email
	login["captchaToken"] = "valid-once"
	login["password"] = "wrong password"
	request("POST", "/auth/login", login, 401)
	login["password"] = "Password1!"
	request("POST", "/auth/login", login, 403)
	login["captchaToken"] = "valid-login"
	request("POST", "/auth/login", login, 200)
	if request("GET", "/auth/captcha", nil, 200)["required"] != false {
		t.Fatal("successful credentials did not clear gate")
	}
	login["password"] = "wrong password"
	delete(login, "captchaToken")
	request("POST", "/auth/login", login, 401)
	request("POST", "/auth/login", login, 403)
}
