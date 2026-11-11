package httpx

import (
	"bytes"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

var quietLog = slog.New(slog.NewTextHandler(io.Discard, nil))

func init() { gin.SetMode(gin.TestMode) }

func newEngine(middlewares ...gin.HandlerFunc) *gin.Engine {
	r := gin.New()
	r.Use(middlewares...)
	return r
}

func TestCORS(t *testing.T) {
	r := newEngine(CORS([]string{"http://localhost:5173"}))
	r.GET("/x", func(c *gin.Context) { c.Status(http.StatusOK) })

	cases := []struct {
		origin string
		want   string
	}{
		{"http://localhost:5173", "http://localhost:5173"},
		{"https://evil.example", ""},
	}
	for _, tc := range cases {
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		req.Header.Set("Origin", tc.origin)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != tc.want {
			t.Errorf("origin %s: Allow-Origin = %q, want %q", tc.origin, got, tc.want)
		}
	}
}

func TestSameOriginBlocksForeignSite(t *testing.T) {
	r := newEngine(SameOrigin([]string{"http://localhost:5173"}))
	r.POST("/refresh", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodPost, "/refresh", nil)
	req.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("чужой Origin: status %d, want 403", rec.Code)
	}
}

func TestRecoverHidesPanic(t *testing.T) {
	r := newEngine(Recover(quietLog))
	r.GET("/boom", func(c *gin.Context) { panic("секретная деталь") })

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/boom", nil))
	if rec.Code != http.StatusInternalServerError || strings.Contains(rec.Body.String(), "секретная") {
		t.Fatalf("status %d, body %s", rec.Code, rec.Body.String())
	}
}

func TestSecurityHeaders(t *testing.T) {
	r := newEngine(SecurityHeaders(true))
	r.GET("/x", func(c *gin.Context) { c.Status(http.StatusOK) })
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
	for _, h := range []string{"X-Content-Type-Options", "X-Frame-Options", "Content-Security-Policy", "Strict-Transport-Security"} {
		if rec.Header().Get(h) == "" {
			t.Errorf("нет заголовка %s", h)
		}
	}
}

type payload struct {
	Name string `json:"name"`
}

func decodeRequest(t *testing.T, body, contentType string, limit int64) (int, payload) {
	t.Helper()
	var got payload
	status := http.StatusOK
	r := newEngine(BodyLimit(limit))
	r.POST("/x", func(c *gin.Context) {
		if err := DecodeJSON(c, &got); err != nil {
			Respond(c, err)
			status = c.Writer.Status()
			return
		}
		c.Status(http.StatusOK)
	})
	req := httptest.NewRequest(http.MethodPost, "/x", strings.NewReader(body))
	req.Header.Set("Content-Type", contentType)
	r.ServeHTTP(httptest.NewRecorder(), req)
	return status, got
}

func TestDecodeJSON(t *testing.T) {
	cases := []struct {
		name, body, contentType string
		limit                   int64
		status                  int
	}{
		{"нормальный", `{"name":"Антон"}`, "application/json", 1024, http.StatusOK},
		{"неизвестное поле (mass assignment)", `{"name":"А","role":"owner"}`, "application/json", 1024, http.StatusBadRequest},
		{"два объекта подряд", `{"name":"А"}{"name":"Б"}`, "application/json", 1024, http.StatusBadRequest},
		{"не JSON", `name=А`, "application/x-www-form-urlencoded", 1024, http.StatusUnsupportedMediaType},
		{"слишком большой", `{"name":"` + string(bytes.Repeat([]byte("a"), 2000)) + `"}`, "application/json", 100, http.StatusRequestEntityTooLarge},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, _ := decodeRequest(t, tc.body, tc.contentType, tc.limit)
			if status != tc.status {
				t.Fatalf("status %d, want %d", status, tc.status)
			}
		})
	}
}

func TestRateLimiter(t *testing.T) {
	l := NewRateLimiter(1, 3)
	for i := 0; i < 3; i++ {
		if !l.Allow("ip") {
			t.Fatalf("запрос %d должен пройти", i+1)
		}
	}
	if l.Allow("ip") {
		t.Fatal("четвёртый запрос подряд должен быть отклонён")
	}
	if !l.Allow("other-ip") {
		t.Fatal("другой ключ ограничивается отдельно")
	}
}
