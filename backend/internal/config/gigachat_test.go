package config

import "testing"

func TestGigaChatConfiguration(t *testing.T) {
	t.Setenv("AI_PROVIDER", "gigachat")
	t.Setenv("GIGACHAT_AUTH_KEY", "test-key")
	t.Setenv("GIGACHAT_SCOPE", "GIGACHAT_API_PERS")
	t.Setenv("GIGACHAT_MODEL", "GigaChat-2-Pro")
	t.Setenv("AI_BASE_URL", "https://example.com/v1")
	t.Setenv("AI_REASONING", "none")
	t.Setenv("AI_MAX_CONCURRENT", "3")
	cfg, err := loadAI()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.BaseURL != "https://api.giga.chat/v1" || cfg.Model != "GigaChat-2-Pro" || cfg.Reasoning != "" || cfg.MaxConcurrent != 1 {
		t.Fatal("incorrect GigaChat configuration")
	}
	t.Setenv("GIGACHAT_AUTH_KEY", "")
	if _, err := loadAI(); err == nil {
		t.Fatal("missing key accepted")
	}
}
