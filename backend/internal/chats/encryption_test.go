package chats

import (
	"bytes"
	"testing"

	"github.com/ATE826/Famigo/backend/internal/fieldcrypt"
	"github.com/ATE826/Famigo/backend/internal/models"
	"github.com/google/uuid"
)

func TestRichContentBoundToMessage(t *testing.T) {
	c, _ := fieldcrypt.New([]fieldcrypt.Key{{ID: 1, Secret: bytes.Repeat([]byte{42}, 32)}})
	m := models.Message{ID: uuid.New(), ChatID: uuid.New()}
	plain := `{"reply":{"text":"secret quote"},"recipe":{"title":"secret recipe"}}`
	sealed, err := encryptDetails(c, m, plain)
	if err != nil || bytes.Contains([]byte(sealed), []byte("secret")) {
		t.Fatal("details stored openly")
	}
	m.Details = sealed
	got, err := decryptDetails(c, m)
	if err != nil || got != plain {
		t.Fatal("details round trip failed")
	}
	m.ID = uuid.New()
	if _, err = decryptDetails(c, m); err == nil {
		t.Fatal("details relocation accepted")
	}
	mid := uuid.New()
	r := mediaRow{ID: uuid.New(), ChatID: uuid.New(), MessageID: &mid, Data: []byte{0, 255, 127}, Name: "private.png", Mime: "image/png"}
	if err = encryptMedia(c, &r); err != nil {
		t.Fatal(err)
	}
	if r.Name == "private.png" || r.Mime == "image/png" || bytes.Equal(r.Data, []byte{0, 255, 127}) {
		t.Fatal("media not fully encrypted")
	}
	relocated := r
	relocated.ChatID = uuid.New()
	if err = decryptMedia(c, &relocated); err == nil {
		t.Fatal("media relocation accepted")
	}
	if err = decryptMedia(c, &r); err != nil || r.Name != "private.png" || !bytes.Equal(r.Data, []byte{0, 255, 127}) {
		t.Fatal("media round trip failed")
	}
}
