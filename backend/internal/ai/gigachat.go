package ai

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	_ "embed"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Official CA files: https://gu-st.ru/content/lending/ (see GigaChat certificates guide).
// Trust is scoped to this GigaChat client; the OS and other HTTP clients are unchanged.
//
//go:embed certs/russian-root.crt
var gigaRootCA []byte

//go:embed certs/russian-sub.crt
var gigaSubCA []byte

func gigaHTTPClient() *http.Client {
	pool, err := x509.SystemCertPool()
	if err != nil {
		pool = x509.NewCertPool()
	}
	if !pool.AppendCertsFromPEM(gigaRootCA) || !pool.AppendCertsFromPEM(gigaSubCA) {
		panic("invalid embedded GigaChat CA")
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{RootCAs: pool, MinVersion: tls.VersionTLS12}
	return &http.Client{Transport: transport, CheckRedirect: func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse }}
}

func (c *Client) reasoning() string {
	if c.cfg.Provider == "gigachat" {
		return ""
	}
	return c.cfg.Reasoning
}

// Tokens stay in memory; refresh a minute early, sharing one refresh across requests.
// rejected is the token from a 401. Another request may already have replaced it.
func (c *Client) gigaToken(ctx context.Context, rejected string) (string, error) {
	c.tokenMu.Lock()
	defer c.tokenMu.Unlock()
	if c.token != "" && c.token != rejected && time.Now().Add(time.Minute).Before(c.tokenExpires) {
		return c.token, nil
	}
	tokenCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	endpoint := c.cfg.GigaChatAuthURL
	if endpoint == "" {
		endpoint = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
	}
	scope := c.cfg.GigaChatScope
	if scope == "" {
		scope = "GIGACHAT_API_PERS"
	}
	req, err := http.NewRequestWithContext(tokenCtx, http.MethodPost, endpoint, strings.NewReader(url.Values{"scope": {scope}}.Encode()))
	if err != nil {
		return "", ErrUnavailable
	}
	req.Header.Set("Authorization", "Basic "+c.cfg.GigaChatAuthKey)
	req.Header.Set("RqUID", uuid.NewString())
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return "", c.transportError(tokenCtx, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusTooManyRequests {
		return "", ErrRateLimited
	}
	if resp.StatusCode != http.StatusOK {
		c.log.Warn("GigaChat: авторизация отклонена", "status", resp.StatusCode)
		return "", ErrUnavailable
	}
	var token struct {
		AccessToken string `json:"access_token"`
		ExpiresAt   int64  `json:"expires_at"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 65536)).Decode(&token); err != nil || token.AccessToken == "" {
		return "", ErrUnavailable
	}
	expires := time.UnixMilli(token.ExpiresAt)
	if !expires.After(time.Now()) {
		return "", ErrUnavailable
	}
	c.token, c.tokenExpires = token.AccessToken, expires
	return c.token, nil
}
