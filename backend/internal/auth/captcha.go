package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"github.com/ATE826/Famigo/backend/internal/httpx"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type CaptchaConfig struct {
	ClientKey    string
	ServerKey    string
	AllowedHosts []string
}

type captchaVerifier interface {
	Verify(context.Context, string, string) error
}

type yandexCaptcha struct {
	config   CaptchaConfig
	client   *http.Client
	endpoint string
}

var errCaptchaRequired = &httpx.Error{Status: 403, Code: "captcha_required", Message: "Пройдите проверку капчи"}
var errCaptchaInvalid = &httpx.Error{Status: 403, Code: "captcha_invalid", Message: "Проверка капчи не пройдена. Повторите её"}
var errCaptchaUnavailable = &httpx.Error{Status: 503, Code: "captcha_unavailable", Message: "Проверка капчи временно недоступна"}

func (v *yandexCaptcha) Verify(ctx context.Context, token, ip string) error {
	if token == "" {
		return errCaptchaRequired
	}
	if len(token) > 16384 {
		return errCaptchaInvalid
	}
	body := url.Values{"secret": {v.config.ServerKey}, "token": {token}, "ip": {ip}}
	req, err := http.NewRequestWithContext(ctx, "POST", v.endpoint, strings.NewReader(body.Encode()))
	if err != nil {
		return errCaptchaUnavailable
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := v.client.Do(req)
	if err != nil {
		return errCaptchaUnavailable
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return errCaptchaUnavailable
	}
	var result struct {
		Status string `json:"status"`
		Host   string `json:"host"`
	}
	if json.NewDecoder(io.LimitReader(res.Body, 65536)).Decode(&result) != nil {
		return errCaptchaUnavailable
	}
	if result.Status != "ok" {
		return errCaptchaInvalid
	}
	// A token solved for another site must never authorize Famigo.
	actualHost := captchaHostname(result.Host)
	for _, host := range v.config.AllowedHosts {
		if actualHost != "" && actualHost == captchaHostname(host) {
			return nil
		}
	}
	return errCaptchaInvalid
}

// SmartCaptcha returns a host with its port (e.g. localhost:8080), while the
// configured allowlist contains hostnames. Parse the authority, never strip
// arbitrary suffixes or accept URLs, userinfo, paths or lookalike domains.
func captchaHostname(value string) string {
	if ip := net.ParseIP(value); ip != nil {
		return ip.String()
	}
	u, err := url.Parse("//" + value)
	if err != nil || u.Host == "" || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" {
		return ""
	}
	if port := u.Port(); port != "" {
		if _, err := strconv.ParseUint(port, 10, 16); err != nil {
			return ""
		}
	}
	name := strings.ToLower(strings.TrimSuffix(u.Hostname(), "."))
	if ip := net.ParseIP(name); ip != nil {
		return ip.String()
	}
	return name
}

func (h *Handler) WithCaptcha(cfg CaptchaConfig, secret []byte) *Handler {
	if cfg.ClientKey != "" && cfg.ServerKey != "" {
		h.captcha = &yandexCaptcha{config: cfg, client: &http.Client{Timeout: 5 * time.Second}, endpoint: "https://smartcaptcha.cloud.yandex.ru/validate"}
		h.captchaClientKey = cfg.ClientKey
		h.captchaHashSecret = secret
	}
	return h
}

func (h *Handler) captchaIP(c *gin.Context) string {
	hash := hmac.New(sha256.New, h.captchaHashSecret)
	hash.Write([]byte("login-captcha:" + c.ClientIP()))
	return hex.EncodeToString(hash.Sum(nil))
}

func (h *Handler) captchaStatus(c *gin.Context) {
	required := false
	if h.captcha != nil {
		if err := h.service.db.WithContext(c.Request.Context()).Raw("SELECT EXISTS (SELECT 1 FROM login_captcha_gates WHERE ip_hash=? AND required)", h.captchaIP(c)).Scan(&required).Error; err != nil {
			httpx.Respond(c, err)
			return
		}
	}
	c.Header("Cache-Control", "no-store")
	httpx.OK(c, gin.H{"enabled": h.captcha != nil, "required": required, "clientKey": h.captchaClientKey})
}

// Serialize attempts for an IP across tabs and backend instances. A failed
// password commits the gate; neither clearing cookies nor reloading removes it.
func (h *Handler) loginWithCaptcha(c *gin.Context, email, password, token string) (Session, error) {
	if h.captcha == nil {
		return h.service.Login(c.Request.Context(), email, password, c.Request.UserAgent())
	}
	var session Session
	var authErr error
	key := h.captchaIP(c)
	err := h.service.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("INSERT INTO login_captcha_gates(ip_hash) VALUES (?) ON CONFLICT DO NOTHING", key).Error; err != nil {
			return err
		}
		var gate struct{ Required bool }
		if err := tx.Raw("SELECT required FROM login_captcha_gates WHERE ip_hash=? FOR UPDATE", key).Scan(&gate).Error; err != nil {
			return err
		}
		if gate.Required {
			if err := h.captcha.Verify(c.Request.Context(), token, c.ClientIP()); err != nil {
				return err
			}
		}
		session, authErr = h.service.loginUsing(tx, email, password, c.Request.UserAgent())
		if authErr != nil && !errors.Is(authErr, errBadCredentials) {
			return authErr
		}
		return tx.Exec("UPDATE login_captcha_gates SET required=?, updated_at=now() WHERE ip_hash=?", authErr != nil, key).Error
	})
	if err != nil {
		return Session{}, err
	}
	return session, authErr
}
