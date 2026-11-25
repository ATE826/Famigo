package chats

import (
	"encoding/json"
	"github.com/google/uuid"
	"io"
	"log/slog"
	"testing"
	"time"
)

func TestTypingDisconnectPreservesOtherTabsAndUsers(t *testing.T) {
	h := NewHub(slog.New(slog.NewTextHandler(io.Discard, nil)))
	alice, bob, viewer := uuid.New(), uuid.New(), uuid.New()
	family, chat := uuid.New(), uuid.New()
	makeClient := func(user uuid.UUID) *Client {
		c := &Client{userID: user, send: make(chan []byte, 16)}
		if !h.add(c) {
			t.Fatal("registration failed")
		}
		return c
	}
	a1, a2, b, v := makeClient(alice), makeClient(alice), makeClient(bob), makeClient(viewer)
	for _, c := range []*Client{a1, a2, b} {
		c.typing = &typingState{familyID: family, chatID: chat, recipients: []uuid.UUID{viewer}, timer: time.AfterFunc(time.Hour, func() {})}
		defer c.typing.timer.Stop()
	}
	check := func(want ...uuid.UUID) {
		t.Helper()
		select {
		case data := <-v.send:
			var event struct {
				Type    string
				UserIDs []uuid.UUID
			}
			if err := json.Unmarshal(data, &event); err != nil {
				t.Fatal(err)
			}
			if event.Type != "typing" || len(event.UserIDs) != len(want) {
				t.Fatalf("unexpected snapshot: %s", data)
			}
			for _, id := range want {
				found := false
				for _, got := range event.UserIDs {
					found = found || got == id
				}
				if !found {
					t.Fatalf("missing user %s", id)
				}
			}
		default:
			t.Fatal("missing typing update")
		}
	}
	h.mu.Lock()
	h.broadcastTypingLocked(a1.typing)
	h.mu.Unlock()
	check(alice, bob)
	h.remove(a1)
	check(alice, bob)
	h.remove(a2)
	check(bob)
	h.remove(b)
	check()
}
