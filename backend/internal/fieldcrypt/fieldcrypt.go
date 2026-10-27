// Пакет fieldcrypt — шифрование отдельных полей в базе (сейчас: текст сообщений чата).
//
// Зачем: если у кого-то окажется дамп базы или резервная копия, сообщения в нём будут
// нечитаемыми. Ключ хранится не в базе, а в secrets.env (MESSAGE_KEYS).
//
// Чего это НЕ даёт: это не сквозное шифрование. Сервер знает ключ и видит текст, поэтому
// взлом самого сервера (или доступ к ключу) раскрывает переписку. Длина текста тоже видна
// (по длине шифртекста). Защита от чтения базы и бэкапов, не от сервера.
//
// Как устроено:
//   - AES-256-GCM: шифрует и одновременно проверяет, что данные не подменены;
//   - у каждой записи свой случайный nonce, поэтому одинаковые сообщения дают разный шифртекст;
//   - в запись входит номер ключа: ключи можно менять, старые записи остаются читаемыми;
//   - AAD (дополнительные данные: чат и номер сообщения) привязывают шифртекст к своему месту:
//     перенести зашифрованный текст в другое сообщение или другой чат нельзя, он не расшифруется.
//
// Формат в базе: enc:v1:<номер ключа>:<nonce и шифртекст в base64url>.
// Текст без префикса «enc:v1:» считается старым незашифрованным и читается как есть
// (так работают старые сообщения до миграции и режим разработки без ключа).
//
// Ограничение: nonce случайный, 96 бит. NIST советует не больше 2^32 (около 4 миллиардов)
// сообщений на один ключ. На таком объёме ключ нужно менять: номер ключа в записи это позволяет.
package fieldcrypt

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
)

const (
	// Prefix — признак зашифрованной записи.
	Prefix = "enc:v1:"
	// KeySize — длина ключа AES-256 в байтах.
	KeySize = 32
)

var (
	ErrUnknownKey = errors.New("fieldcrypt: запись зашифрована ключом, которого нет в MESSAGE_KEYS")
	ErrDecrypt    = errors.New("fieldcrypt: не удалось расшифровать (неверный ключ или данные изменены)")
)

// Key — ключ шифрования с номером.
type Key struct {
	ID     uint16
	Secret []byte
}

// Cipher шифрует и расшифровывает. Пустой набор ключей даёт «выключенный» Cipher:
// он ничего не шифрует (нужно для режима разработки без ключа).
type Cipher struct {
	active uint16
	aead   map[uint16]cipher.AEAD
}

// New создаёт Cipher. Первый ключ в списке — активный: им шифруются новые записи.
// Остальные нужны только для расшифровки старых.
func New(keys []Key) (*Cipher, error) {
	c := &Cipher{aead: map[uint16]cipher.AEAD{}}
	for i, key := range keys {
		if len(key.Secret) != KeySize {
			return nil, fmt.Errorf("fieldcrypt: ключ %d должен быть длиной %d байт", key.ID, KeySize)
		}
		if _, dup := c.aead[key.ID]; dup {
			return nil, fmt.Errorf("fieldcrypt: номер ключа %d повторяется", key.ID)
		}
		block, err := aes.NewCipher(key.Secret)
		if err != nil {
			return nil, err
		}
		gcm, err := cipher.NewGCM(block)
		if err != nil {
			return nil, err
		}
		c.aead[key.ID] = gcm
		if i == 0 {
			c.active = key.ID
		}
	}
	return c, nil
}

// ParseKeys разбирает MESSAGE_KEYS: «номер:ключ_в_base64», через запятую.
// Первый — активный. Пример: 2:abc...=,1:def...=
// В текстах ошибок самих ключей нет: они попали бы в логи.
func ParseKeys(value string) ([]Key, error) {
	var keys []Key
	for i, item := range strings.Split(value, ",") {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		idText, secretText, ok := strings.Cut(item, ":")
		if !ok {
			return nil, fmt.Errorf("MESSAGE_KEYS: запись %d: ожидается номер:ключ", i+1)
		}
		id, err := strconv.ParseUint(strings.TrimSpace(idText), 10, 16)
		if err != nil || id == 0 {
			return nil, fmt.Errorf("MESSAGE_KEYS: запись %d: номер ключа должен быть числом от 1 до 65535", i+1)
		}
		secret, err := decodeBase64(strings.TrimSpace(secretText))
		if err != nil || len(secret) != KeySize {
			return nil, fmt.Errorf("MESSAGE_KEYS: запись %d: ключ должен быть %d байтами в base64 (openssl rand -base64 32)", i+1, KeySize)
		}
		keys = append(keys, Key{ID: uint16(id), Secret: secret})
	}
	return keys, nil
}

func decodeBase64(s string) ([]byte, error) {
	if b, err := base64.StdEncoding.DecodeString(s); err == nil {
		return b, nil
	}
	return base64.RawStdEncoding.DecodeString(s)
}

// Enabled — есть ли хотя бы один ключ (иначе записи не шифруются).
func (c *Cipher) Enabled() bool { return len(c.aead) > 0 }

// ActivePrefix — начало записей, зашифрованных текущим ключом: «enc:v1:2:».
// По нему находят записи, которые ещё не переведены на активный ключ.
func (c *Cipher) ActivePrefix() string {
	return Prefix + strconv.Itoa(int(c.active)) + ":"
}

// Encrypt шифрует текст активным ключом. aad привязывает запись к месту хранения.
func (c *Cipher) Encrypt(plaintext, aad string) (string, error) {
	if !c.Enabled() {
		return plaintext, nil
	}
	gcm := c.aead[c.active]
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	// Seal дописывает шифртекст к nonce: в базе nonce лежит прямо перед ним.
	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), []byte(aad))
	return c.ActivePrefix() + base64.RawURLEncoding.EncodeToString(sealed), nil
}

// Decrypt расшифровывает запись. Текст без префикса считается незашифрованным и возвращается как есть.
func (c *Cipher) Decrypt(stored, aad string) (string, error) {
	rest, encrypted := strings.CutPrefix(stored, Prefix)
	if !encrypted {
		return stored, nil
	}
	idText, data, ok := strings.Cut(rest, ":")
	if !ok {
		return "", ErrDecrypt
	}
	id, err := strconv.ParseUint(idText, 10, 16)
	if err != nil {
		return "", ErrDecrypt
	}
	gcm, ok := c.aead[uint16(id)]
	if !ok {
		return "", ErrUnknownKey
	}
	raw, err := base64.RawURLEncoding.DecodeString(data)
	if err != nil || len(raw) < gcm.NonceSize() {
		return "", ErrDecrypt
	}
	plain, err := gcm.Open(nil, raw[:gcm.NonceSize()], raw[gcm.NonceSize():], []byte(aad))
	if err != nil {
		return "", ErrDecrypt
	}
	return string(plain), nil
}
