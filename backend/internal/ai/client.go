// Пакет ai — клиент нейросети по OpenAI-совместимому API (POST /chat/completions).
//
// Этот формат понимают Ollama (локальная модель), Gemini, OpenRouter, Groq, DeepSeek, Qwen и
// другие, поэтому провайдер меняется настройками AI_BASE_URL, AI_MODEL и AI_API_KEY, без правок кода.
//
// Ответ нейросети — недоверенные данные: его разбирает и проверяет вызывающий код.
// Никаких «действий» (tools) модели не даём — она только возвращает текст.
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync/atomic"
	"time"
)

// Config — настройки подключения. Пустой BaseURL — нейросеть не настроена.
type Config struct {
	BaseURL string
	Model   string
	APIKey  string
	Timeout time.Duration
	// MaxConcurrent — сколько запросов к модели идут одновременно. Локальная модель
	// считает по одному запросу за раз, поэтому для Ollama это 1.
	MaxConcurrent int
	// JSONMode — schema (ответ строго по JSON-схеме) или object (просто JSON, для провайдеров
	// без поддержки схем, например DeepSeek).
	JSONMode string
	// Reasoning — значение reasoning_effort. none отключает «размышления» у моделей, которые
	// это умеют (Gemma, Qwen в Ollama): ответ приходит в несколько раз быстрее. Пусто — не отправляем.
	Reasoning string
}

var (
	// ErrBusy — очередь к модели переполнена.
	ErrBusy = errors.New("ai: модель занята")
	// ErrTimeout — модель не ответила за отведённое время.
	ErrTimeout = errors.New("ai: модель не ответила вовремя")
	// ErrUnavailable — модель недоступна или ответила ошибкой.
	ErrUnavailable = errors.New("ai: модель недоступна")
	// ErrRateLimited — провайдер ограничил число запросов (у бесплатных тарифов это частая ситуация).
	ErrRateLimited = errors.New("ai: провайдер ограничил запросы")
)

// maxWaiting — сколько запросов могут ждать своей очереди. Остальные сразу получают ErrBusy:
// незачем держать десятки соединений, которые всё равно не дождутся ответа.
const maxWaiting = 4

// maxResponseBytes — больше ответ от провайдера не читаем.
const maxResponseBytes = 1 << 20

type Client struct {
	cfg     Config
	http    *http.Client
	slots   chan struct{}
	waiting atomic.Int32
	log     *slog.Logger
}

// New возвращает nil, если нейросеть не настроена.
func New(cfg Config, log *slog.Logger) *Client {
	if cfg.BaseURL == "" {
		return nil
	}
	return &Client{
		cfg: cfg,
		// Таймаут задаёт контекст в Complete: он учитывает и время в очереди.
		http:  &http.Client{},
		slots: make(chan struct{}, max(cfg.MaxConcurrent, 1)),
		log:   log,
	}
}

// Model — имя модели (уходит в ответ API, чтобы было видно, кто придумал блюда).
func (c *Client) Model() string { return c.cfg.Model }

// Timeout — сколько можно ждать ответа, включая очередь.
func (c *Client) Timeout() time.Duration { return c.cfg.Timeout }

// Request — что спросить у модели.
type Request struct {
	System string
	User   string
	// SchemaName и Schema — JSON-схема ответа.
	SchemaName  string
	Schema      map[string]any
	Temperature float64
}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model           string         `json:"model"`
	Messages        []message      `json:"messages"`
	Temperature     float64        `json:"temperature"`
	ResponseFormat  map[string]any `json:"response_format"`
	ReasoningEffort string         `json:"reasoning_effort,omitempty"`
	Stream          bool           `json:"stream"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

// Complete отправляет запрос и возвращает текст ответа модели (ожидается JSON).
func (c *Client) Complete(ctx context.Context, req Request) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, c.cfg.Timeout)
	defer cancel()

	if err := c.acquire(ctx); err != nil {
		return "", err
	}
	defer func() { <-c.slots }()

	format := map[string]any{"type": "json_object"}
	if c.cfg.JSONMode != "object" {
		format = map[string]any{
			"type":        "json_schema",
			"json_schema": map[string]any{"name": req.SchemaName, "strict": true, "schema": req.Schema},
		}
	}
	body, err := json.Marshal(chatRequest{
		Model: c.cfg.Model,
		Messages: []message{
			{Role: "system", Content: req.System},
			{Role: "user", Content: req.User},
		},
		Temperature:     req.Temperature,
		ResponseFormat:  format,
		ReasoningEffort: c.cfg.Reasoning,
	})
	if err != nil {
		return "", err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(c.cfg.BaseURL, "/")+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if c.cfg.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+c.cfg.APIKey)
	}

	started := time.Now()
	resp, err := c.http.Do(httpReq)
	if err != nil {
		return "", c.transportError(ctx, err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes+1))
	if err != nil {
		return "", c.transportError(ctx, err)
	}
	if len(raw) > maxResponseBytes {
		return "", ErrUnavailable
	}

	switch {
	case resp.StatusCode == http.StatusTooManyRequests:
		return "", ErrRateLimited
	case resp.StatusCode != http.StatusOK:
		// Текст ошибки провайдера — только в журнал: в нём бывают подробности аккаунта.
		c.log.Warn("нейросеть ответила ошибкой", "status", resp.StatusCode, "body", truncate(string(raw), 300))
		return "", ErrUnavailable
	}

	var parsed chatResponse
	if err := json.Unmarshal(raw, &parsed); err != nil || len(parsed.Choices) == 0 {
		c.log.Warn("непонятный ответ нейросети", "err", err, "body", truncate(string(raw), 300))
		return "", ErrUnavailable
	}
	if strings.TrimSpace(parsed.Choices[0].Message.Content) == "" {
		return "", ErrUnavailable
	}
	c.log.Info("нейросеть ответила", "model", c.cfg.Model, "took", time.Since(started).Round(time.Second))
	return parsed.Choices[0].Message.Content, nil
}

// acquire ждёт свободного места у модели, пока жив запрос.
func (c *Client) acquire(ctx context.Context) error {
	select {
	case c.slots <- struct{}{}:
		return nil
	default:
	}
	if c.waiting.Add(1) > maxWaiting {
		c.waiting.Add(-1)
		return ErrBusy
	}
	defer c.waiting.Add(-1)
	select {
	case c.slots <- struct{}{}:
		return nil
	case <-ctx.Done():
		return c.transportError(ctx, ctx.Err())
	}
}

// transportError: клиент сам ушёл — отдаём context.Canceled (сервер ответит 499),
// истёк наш таймаут — ErrTimeout, остальное — модель недоступна.
func (c *Client) transportError(ctx context.Context, err error) error {
	switch {
	case errors.Is(ctx.Err(), context.DeadlineExceeded):
		return ErrTimeout
	case errors.Is(err, context.Canceled):
		return err
	}
	c.log.Warn("не удалось связаться с нейросетью", "err", err)
	return fmt.Errorf("%w: %v", ErrUnavailable, err)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
