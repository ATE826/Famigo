package health

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

type fakeDB struct{ err error }

func (f fakeDB) PingContext(context.Context) error { return f.err }

func TestCheck(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cases := []struct {
		name   string
		db     fakeDB
		status int
		body   string
	}{
		{"база доступна", fakeDB{}, http.StatusOK, `"status":"ok"`},
		{"база недоступна", fakeDB{err: errors.New("секретная деталь")}, http.StatusServiceUnavailable, `"database":"unavailable"`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := gin.New()
			r.GET("/api/health", NewHandler(tc.db).Check)
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/health", nil))
			if rec.Code != tc.status || !strings.Contains(rec.Body.String(), tc.body) || strings.Contains(rec.Body.String(), "секретная") {
				t.Fatalf("status %d, body %s", rec.Code, rec.Body.String())
			}
		})
	}
}
