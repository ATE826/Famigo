package chats

import "testing"

func TestMediaWhitelist(t *testing.T) {
	for _, mime := range []string{"text/html", "image/svg+xml", "application/javascript", "application/octet-stream"} {
		if allowedMedia(mime) {
			t.Fatalf("unsafe MIME accepted: %s", mime)
		}
	}
	for _, mime := range []string{"image/jpeg", "image/png", "video/mp4", "video/webm"} {
		if !allowedMedia(mime) {
			t.Fatal(mime)
		}
	}
}
