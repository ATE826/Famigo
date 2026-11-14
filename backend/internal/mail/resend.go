package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Config struct {
	APIKey, From, BaseURL                          string
	Provider                                       string
	SMTPHost, SMTPPort, SMTPUsername, SMTPPassword string
}
type Sender struct {
	cfg    Config
	client *http.Client
}

func New(cfg Config) *Sender {
	if cfg.Provider == "smtp" {
		if cfg.SMTPPassword == "" {
			return nil
		}
		return &Sender{cfg: cfg}
	}
	if cfg.APIKey == "" {
		return nil
	}
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://api.resend.com"
	}
	return &Sender{cfg: cfg, client: &http.Client{Timeout: 15 * time.Second}}
}
func (s *Sender) SendCode(ctx context.Context, to, code string) error {
	if s.cfg.Provider == "smtp" {
		return s.sendSMTP(ctx, to, code)
	}
	body, _ := json.Marshal(map[string]any{"from": s.cfg.From, "to": []string{to}, "subject": "Famigo — verification code / код подтверждения", "text": fmt.Sprintf("Famigo: %s\nКод подтверждения / Verification code. Действует 10 минут / Valid for 10 minutes.\nЕсли вы не запрашивали код, проигнорируйте письмо / If you did not request this code, ignore this email.", code)})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.BaseURL+"/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("email delivery failed")
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("email delivery status %d", resp.StatusCode)
	}
	return nil
}
