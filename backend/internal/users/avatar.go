package users

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"image"
	"image/color"
	"image/draw"
	_ "image/gif" // регистрируем декодеры форматов, которые принимаем
	"image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"

	"github.com/ATE826/Famigo/backend/internal/httpx"
)

// Загрузка аватара — самое опасное место API: сюда приходит произвольный файл.
// Защита:
//  1. Размер не больше 5 МБ (как на фронтенде).
//  2. Тип определяем по содержимому, а не по имени файла и не по заголовку Content-Type
//     (их подделать легко). Принимаем только JPEG, PNG, GIF и WebP. SVG — нет:
//     внутри SVG может быть JavaScript.
//  3. До полной распаковки проверяем ширину и высоту: картинка 100 000 × 100 000
//     весит пару килобайт, но при распаковке заняла бы десятки гигабайт памяти
//     («декомпрессионная бомба»).
//  4. Картинку перекодируем в новый JPEG 512 × 512. Из файла пропадают метаданные
//     (EXIF с GPS-координатами, где снято фото) и любые «прицепленные» к картинке данные
//     (файлы-полиглоты, которые одновременно картинка и HTML/скрипт).
//  5. Имя файла — 32 случайных шестнадцатеричных символа. Имя от пользователя не используется
//     вообще, поэтому подсунуть путь вида ../../etc/passwd невозможно.

const (
	maxAvatarBytes  = 5 << 20
	maxSourceSide   = 8000
	maxSourcePixels = 40_000_000
	avatarSide      = 512
)

var (
	allowedFormats    = map[string]bool{"jpeg": true, "png": true, "gif": true, "webp": true}
	avatarNamePattern = regexp.MustCompile(`^[0-9a-f]{32}\.jpg$`)
	errBadImage       = httpx.BadRequest("invalid_image", "Нужна картинка JPEG, PNG, GIF или WebP")
)

const avatarURLPrefix = "/api/uploads/avatars/"

// Распаковка большой фотографии занимает до сотни мегабайт памяти.
// Одновременно обрабатываем не больше двух картинок: иначе сотня параллельных
// загрузок съела бы всю память сервера.
var decodeSlots = make(chan struct{}, 2)

// processAvatar проверяет картинку и возвращает готовый JPEG.
func processAvatar(r io.Reader) ([]byte, error) {
	decodeSlots <- struct{}{}
	defer func() { <-decodeSlots }()

	data, err := io.ReadAll(io.LimitReader(r, maxAvatarBytes+1))
	if err != nil {
		return nil, err
	}
	if len(data) > maxAvatarBytes {
		return nil, &httpx.Error{Status: http.StatusRequestEntityTooLarge, Code: "too_large", Message: "Файл больше 5 МБ"}
	}

	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || !allowedFormats[format] {
		return nil, errBadImage
	}
	if cfg.Width <= 0 || cfg.Height <= 0 || cfg.Width > maxSourceSide || cfg.Height > maxSourceSide ||
		cfg.Width*cfg.Height > maxSourcePixels {
		return nil, httpx.BadRequest("image_too_big", "Слишком большое разрешение картинки")
	}

	src, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, errBadImage
	}

	// Обрезаем до квадрата по центру и уменьшаем до 512 × 512.
	b := src.Bounds()
	side := min(b.Dx(), b.Dy())
	cropMin := image.Pt(b.Min.X+(b.Dx()-side)/2, b.Min.Y+(b.Dy()-side)/2)
	crop := image.Rectangle{Min: cropMin, Max: cropMin.Add(image.Pt(side, side))}
	size := min(side, avatarSide)

	dst := image.NewRGBA(image.Rect(0, 0, size, size))
	// У JPEG нет прозрачности: прозрачные места PNG делаем белыми, а не чёрными.
	draw.Draw(dst, dst.Bounds(), &image.Uniform{C: color.White}, image.Point{}, draw.Src)
	xdraw.CatmullRom.Scale(dst, dst.Bounds(), src, crop, draw.Over, nil)

	var out bytes.Buffer
	if err := jpeg.Encode(&out, dst, &jpeg.Options{Quality: 85}); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

// avatarStore хранит файлы аватаров в папке на диске.
type avatarStore struct {
	dir string
}

func newAvatarStore(uploadDir string) (*avatarStore, error) {
	dir := filepath.Join(uploadDir, "avatars")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &avatarStore{dir: dir}, nil
}

// save записывает файл под случайным именем и возвращает его адрес для фронтенда.
// Сначала пишем во временный файл и переименовываем: недописанный файл никто не увидит.
func (s *avatarStore) save(data []byte) (string, error) {
	random := make([]byte, 16)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	name := hex.EncodeToString(random) + ".jpg"

	tmp, err := os.CreateTemp(s.dir, "upload-*.tmp")
	if err != nil {
		return "", err
	}
	defer os.Remove(tmp.Name())
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return "", err
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}
	if err := os.Rename(tmp.Name(), filepath.Join(s.dir, name)); err != nil {
		return "", err
	}
	return avatarURLPrefix + name, nil
}

// remove удаляет файл по адресу. Адрес проверяется по шаблону: удалить файл
// за пределами папки аватаров невозможно.
func (s *avatarStore) remove(url *string) {
	if url == nil {
		return
	}
	name, ok := strings.CutPrefix(*url, avatarURLPrefix)
	if !ok || !avatarNamePattern.MatchString(name) {
		return
	}
	if err := os.Remove(filepath.Join(s.dir, name)); err != nil && !errors.Is(err, os.ErrNotExist) {
		return
	}
}

// path возвращает путь к файлу по имени из адреса или false, если имя подозрительное.
func (s *avatarStore) path(name string) (string, bool) {
	if !avatarNamePattern.MatchString(name) {
		return "", false
	}
	return filepath.Join(s.dir, name), true
}
