package ai

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

func TestCompleteRejectsInvalidResponses(t *testing.T) {
	for name, body := range map[string]string{
		"empty choices": `{"choices":[]}`,
		"empty content": `{"choices":[{"message":{"content":"  "}}]}`,
		"invalid json":  `not json`,
		// Валидный JSON в начале не должен скрывать превышение лимита тела.
		"oversized": `{"choices":[{"message":{"content":"ok"}}]}` + strings.Repeat(" ", maxResponseBytes),
	} {
		t.Run(name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_, _ = io.WriteString(w, body)
			}))
			defer srv.Close()
			c := New(Config{BaseURL: srv.URL, Timeout: time.Second}, quiet)
			if _, err := c.Complete(context.Background(), Request{}); !errors.Is(err, ErrUnavailable) {
				t.Fatalf("ожидался ErrUnavailable, получено %v", err)
			}
		})
	}
}

func TestNewWithoutURLIsDisabled(t *testing.T) {
	if New(Config{}, quiet) != nil {
		t.Fatal("без AI_BASE_URL клиент должен быть выключен")
	}
}

func TestCompleteSendsRequestAndReadsAnswer(t *testing.T) {
	var got chatRequest
	var auth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" {
			t.Errorf("путь %s", r.URL.Path)
		}
		auth = r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&got)
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"ok\":true}"}}]}`))
	}))
	defer srv.Close()

	c := New(Config{BaseURL: srv.URL + "/v1/", Model: "m", APIKey: "k", Timeout: 5 * time.Second, Reasoning: "none"}, quiet)
	text, err := c.Complete(context.Background(), Request{System: "s", User: "u", SchemaName: "x", Schema: map[string]any{"type": "object"}})
	if err != nil {
		t.Fatal(err)
	}
	if text != `{"ok":true}` {
		t.Fatalf("ответ %q", text)
	}
	if auth != "Bearer k" || got.Model != "m" || got.ReasoningEffort != "none" || got.Stream {
		t.Fatalf("запрос: auth=%q %+v", auth, got)
	}
	if got.ResponseFormat["type"] != "json_schema" || len(got.Messages) != 2 || got.Messages[1].Content != "u" {
		t.Fatalf("запрос: %+v", got)
	}
}

func TestCompleteErrors(t *testing.T) {
	cases := map[int]error{
		http.StatusTooManyRequests:     ErrRateLimited,
		http.StatusInternalServerError: ErrUnavailable,
	}
	for status, want := range cases {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(status)
		}))
		c := New(Config{BaseURL: srv.URL, Timeout: time.Second}, quiet)
		if _, err := c.Complete(context.Background(), Request{}); !errors.Is(err, want) {
			t.Errorf("status %d: %v, want %v", status, err, want)
		}
		srv.Close()
	}
}

func TestCompleteTimeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Пока тело не прочитано, сервер не замечает, что клиент ушёл.
		_, _ = io.Copy(io.Discard, r.Body)
		<-r.Context().Done()
	}))
	defer srv.Close()
	c := New(Config{BaseURL: srv.URL, Timeout: 50 * time.Millisecond}, quiet)
	if _, err := c.Complete(context.Background(), Request{}); !errors.Is(err, ErrTimeout) {
		t.Fatalf("ожидался ErrTimeout, получено %v", err)
	}
}

// Модель считает один запрос за раз: следующие ждут, а сверх очереди — сразу ErrBusy.
func TestQueueLimit(t *testing.T) {
	release := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-release
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{}"}}]}`))
	}))
	defer srv.Close()
	c := New(Config{BaseURL: srv.URL, Timeout: 5 * time.Second, MaxConcurrent: 1}, quiet)

	results := make(chan error, 1+maxWaiting)
	for range 1 + maxWaiting {
		go func() {
			_, err := c.Complete(context.Background(), Request{})
			results <- err
		}()
	}
	deadline := time.Now().Add(2 * time.Second)
	for c.waiting.Load() < maxWaiting && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if _, err := c.Complete(context.Background(), Request{}); !errors.Is(err, ErrBusy) {
		t.Fatalf("сверх очереди ожидался ErrBusy, получено %v", err)
	}
	close(release)
	for range 1 + maxWaiting {
		if err := <-results; err != nil {
			t.Fatalf("запрос из очереди: %v", err)
		}
	}
}
