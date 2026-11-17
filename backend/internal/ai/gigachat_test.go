package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestGigaChatTokenCacheAndRefresh(t *testing.T) {
	authCalls, chats := 0, 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oauth" {
			authCalls++
			r.ParseForm()
			if r.Header.Get("Authorization") != "Basic test-key" || r.Header.Get("RqUID") == "" || r.Form.Get("scope") != "GIGACHAT_API_PERS" {
				t.Error("incorrect OAuth request")
			}
			token := "first"
			if authCalls > 1 {
				token = "second"
			}
			json.NewEncoder(w).Encode(map[string]any{"access_token": token, "expires_at": time.Now().Add(30 * time.Minute).UnixMilli()})
			return
		}
		chats++
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		f := body["response_format"].(map[string]any)
		if f["schema"] == nil || f["json_schema"] != nil || f["strict"] != true || body["reasoning_effort"] != nil {
			t.Error("incorrect GigaChat schema")
		}
		if chats == 2 {
			w.WriteHeader(401)
			return
		}
		expected := "Bearer first"
		if chats > 2 {
			expected = "Bearer second"
		}
		if r.Header.Get("Authorization") != expected {
			t.Error("incorrect access token")
		}
		w.Write([]byte(`{"choices":[{"message":{"content":"{\"ok\":true}"}}]}`))
	}))
	defer srv.Close()
	c := New(Config{Provider: "gigachat", BaseURL: srv.URL, GigaChatAuthURL: srv.URL + "/oauth", GigaChatAuthKey: "test-key", Timeout: time.Second}, quiet)
	for i := 0; i < 3; i++ {
		if _, err := c.Complete(context.Background(), Request{Schema: map[string]any{"type": "object"}}); err != nil {
			t.Fatal(err)
		}
	}
	if authCalls != 2 || chats != 4 {
		t.Fatalf("auth=%d chats=%d", authCalls, chats)
	}
	c.tokenExpires = time.Now().Add(-time.Minute)
	if _, err := c.gigaToken(context.Background(), ""); err != nil {
		t.Fatal(err)
	}
	if authCalls != 3 {
		t.Fatal("expired token was reused")
	}
}
