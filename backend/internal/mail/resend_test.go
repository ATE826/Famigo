package mail

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestResendDelivery(t *testing.T) {
	for _, status := range []int{200, 403, 429} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/emails" || r.Method != "POST" || r.Header.Get("Authorization") != "Bearer test-key" {
					t.Error("invalid provider request")
				}
				var body struct {
					From string   `json:"from"`
					To   []string `json:"to"`
					Text string   `json:"text"`
				}
				if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
					t.Error(err)
				}
				if body.From != "test@example.com" || len(body.To) != 1 || body.To[0] != "recipient@example.com" || !strings.Contains(body.Text, "123456") {
					t.Error("wrong email content")
				}
				w.WriteHeader(status)
				_, _ = w.Write([]byte(`{"id":"test"}`))
			}))
			defer srv.Close()
			sender := New(Config{APIKey: "test-key", From: "test@example.com", BaseURL: srv.URL})
			err := sender.SendCode(context.Background(), "recipient@example.com", "123456")
			if (err == nil) != (status == 200) {
				t.Fatalf("status=%d err=%v", status, err)
			}
		})
	}
	if New(Config{}) != nil {
		t.Fatal("unconfigured sender must be disabled")
	}
}
