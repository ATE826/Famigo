package users

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ATE826/Famigo/backend/internal/httpx"
)

func pngBytes(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for x := 0; x < w; x++ {
		img.Set(x, 0, color.RGBA{R: 200, A: 255})
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func status(err error) int {
	var appErr *httpx.Error
	if errors.As(err, &appErr) {
		return appErr.Status
	}
	return 0
}

func TestProcessAvatarReencodesToSquareJPEG(t *testing.T) {
	out, err := processAvatar(bytes.NewReader(pngBytes(t, 1200, 800)))
	if err != nil {
		t.Fatal(err)
	}
	img, format, err := image.Decode(bytes.NewReader(out))
	if err != nil || format != "jpeg" {
		t.Fatalf("на выходе должен быть JPEG: %v %s", err, format)
	}
	if b := img.Bounds(); b.Dx() != avatarSide || b.Dy() != avatarSide {
		t.Fatalf("размер %dx%d, want %dx%d", b.Dx(), b.Dy(), avatarSide, avatarSide)
	}
}

func TestProcessAvatarKeepsSmallImagesSmall(t *testing.T) {
	out, err := processAvatar(bytes.NewReader(pngBytes(t, 100, 60)))
	if err != nil {
		t.Fatal(err)
	}
	cfg, err := jpeg.DecodeConfig(bytes.NewReader(out))
	if err != nil || cfg.Width != 60 || cfg.Height != 60 {
		t.Fatalf("маленькая картинка: %+v %v", cfg, err)
	}
}

func TestProcessAvatarRejectsNonImages(t *testing.T) {
	cases := map[string][]byte{
		"HTML":       []byte("<html><script>alert(1)</script></html>"),
		"SVG":        []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`),
		"пустой":     {},
		"обрезанный": pngBytes(t, 50, 50)[:40],
	}
	for name, data := range cases {
		if _, err := processAvatar(bytes.NewReader(data)); status(err) != http.StatusBadRequest {
			t.Errorf("%s: должен быть отклонён с 400, got %v", name, err)
		}
	}
}

// Файл-полиглот: настоящая картинка, к которой в конец дописан HTML.
// После перекодирования от «хвоста» не должно остаться и следа.
func TestProcessAvatarStripsAppendedPayload(t *testing.T) {
	payload := "<script>alert('xss')</script>"
	data := append(pngBytes(t, 64, 64), []byte(payload)...)
	out, err := processAvatar(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(out, []byte(payload)) {
		t.Fatal("в перекодированном файле остался посторонний код")
	}
}

func TestProcessAvatarRejectsHugeResolution(t *testing.T) {
	if _, err := processAvatar(bytes.NewReader(pngBytes(t, maxSourceSide+1, 2))); status(err) != http.StatusBadRequest {
		t.Fatalf("слишком широкая картинка должна отклоняться: %v", err)
	}
}

func TestProcessAvatarRejectsLargeFiles(t *testing.T) {
	data := append(pngBytes(t, 10, 10), bytes.Repeat([]byte{0}, maxAvatarBytes)...)
	if _, err := processAvatar(bytes.NewReader(data)); status(err) != http.StatusRequestEntityTooLarge {
		t.Fatalf("файл больше 5 МБ должен отклоняться с 413: %v", err)
	}
}

func TestAvatarStorePaths(t *testing.T) {
	dir := t.TempDir()
	store, err := newAvatarStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	url, err := store.save([]byte("jpeg"))
	if err != nil {
		t.Fatal(err)
	}
	name := strings.TrimPrefix(url, avatarURLPrefix)
	if _, ok := store.path(name); !ok {
		t.Fatalf("сохранённый файл должен находиться: %s", url)
	}

	for _, bad := range []string{"../../etc/passwd", "..%2F..%2Fsecret", "avatar.jpg", "AAAA.jpg", name + "/x", ""} {
		if _, ok := store.path(bad); ok {
			t.Errorf("имя %q должно отклоняться", bad)
		}
	}

	// Файл вне папки аватаров удалить нельзя, даже если подсунуть такой адрес.
	victim := filepath.Join(dir, "important.txt")
	os.WriteFile(victim, []byte("x"), 0o600)
	evil := avatarURLPrefix + "../important.txt"
	store.remove(&evil)
	if _, err := os.Stat(victim); err != nil {
		t.Fatal("remove удалил файл за пределами папки аватаров")
	}

	store.remove(&url)
	if _, err := os.Stat(filepath.Join(dir, "avatars", name)); !os.IsNotExist(err) {
		t.Fatal("свой аватар должен удаляться")
	}
}
