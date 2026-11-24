package chats

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/fieldcrypt"
	"github.com/ATE826/Famigo/backend/internal/models"
)

// Текст сообщений хранится в базе зашифрованным (см. пакет fieldcrypt).
// Шифруем на границе «сервис ↔ база»: наружу (API, WebSocket) всегда уходит расшифрованный текст.

// undecryptable — что видит человек вместо сообщения, которое не удалось расшифровать
// (например, из конфигурации убрали старый ключ). Один испорченный ключ не должен ронять весь чат.
const undecryptable = "[сообщение не удалось расшифровать]"

// messageAAD привязывает шифртекст к конкретному сообщению: id чата и id сообщения.
// Переставить зашифрованный текст в другое сообщение или другой чат нельзя — он не расшифруется.
// Автора в AAD нет намеренно: user_id становится NULL при удалении аккаунта, и сообщение
// после этого стало бы нечитаемым.
func messageAAD(chatID, messageID uuid.UUID) string {
	return "message|" + chatID.String() + "|" + messageID.String()
}

// decryptText возвращает открытый текст сообщения из строки базы.
func decryptText(c *fieldcrypt.Cipher, m models.Message) string {
	text, err := c.Decrypt(m.Text, messageAAD(m.ChatID, m.ID))
	if err != nil {
		slog.Error("не удалось расшифровать сообщение", "message_id", m.ID, "chat_id", m.ChatID, "err", err)
		return undecryptable
	}
	return text
}

func encryptDetails(c *fieldcrypt.Cipher, m models.Message, plain string) (string, error) {
	if plain == "" || plain == "{}" || !c.Enabled() {
		return plain, nil
	}
	sealed, err := c.Encrypt(plain, messageAAD(m.ChatID, m.ID)+"|details")
	if err != nil {
		return "", err
	}
	raw, err := json.Marshal(sealed)
	return string(raw), err
}
func decryptDetails(c *fieldcrypt.Cipher, m models.Message, legacy ...bool) (string, error) {
	if m.Details == "" || m.Details == "{}" {
		return "{}", nil
	}
	var sealed string
	if json.Unmarshal([]byte(m.Details), &sealed) != nil {
		if c.Enabled() && len(legacy) == 0 {
			return "", fieldcrypt.ErrDecrypt
		}
		return m.Details, nil
	}
	if c.Enabled() && !strings.HasPrefix(sealed, fieldcrypt.Prefix) {
		return "", fieldcrypt.ErrDecrypt
	}
	plain, err := c.Decrypt(sealed, messageAAD(m.ChatID, m.ID)+"|details")
	if err != nil {
		return "", err
	}
	if !json.Valid([]byte(plain)) {
		return "", errors.New("invalid message details")
	}
	return plain, nil
}
func mediaAAD(m mediaRow, field string) string {
	messageID := ""
	if m.MessageID != nil {
		messageID = m.MessageID.String()
	}
	return "media|" + m.ChatID.String() + "|" + messageID + "|" + m.ID.String() + "|" + field
}
func encryptMedia(c *fieldcrypt.Cipher, m *mediaRow) error {
	var err error
	if m.Data, err = c.EncryptBytes(m.Data, mediaAAD(*m, "data")); err != nil {
		return err
	}
	if m.Name, err = c.Encrypt(m.Name, mediaAAD(*m, "name")); err != nil {
		return err
	}
	m.Mime, err = c.Encrypt(m.Mime, mediaAAD(*m, "mime"))
	return err
}
func decryptMedia(c *fieldcrypt.Cipher, m *mediaRow, legacy ...bool) error {
	if c.Enabled() && len(legacy) == 0 && (!bytes.HasPrefix(m.Data, []byte(fieldcrypt.BinaryPrefix)) || !strings.HasPrefix(m.Name, fieldcrypt.Prefix) || !strings.HasPrefix(m.Mime, fieldcrypt.Prefix)) {
		return fieldcrypt.ErrDecrypt
	}
	var err error
	if m.Data, err = c.DecryptBytes(m.Data, mediaAAD(*m, "data")); err != nil {
		return err
	}
	if m.Name, err = c.Decrypt(m.Name, mediaAAD(*m, "name")); err != nil {
		return err
	}
	m.Mime, err = c.Decrypt(m.Mime, mediaAAD(*m, "mime"))
	return err
}

// Reencrypt migrates legacy and old-key content before the server accepts requests.
// Deleted messages can still have legacy details/media; those are covered as well.
func Reencrypt(ctx context.Context, db *gorm.DB, c *fieldcrypt.Cipher, log *slog.Logger) (done, failed int, err error) {
	if !c.Enabled() {
		return 0, 0, nil
	}
	var cursor uuid.UUID
	for {
		var rows []models.Message
		q := db.WithContext(ctx).Order("id").Limit(100)
		if cursor != uuid.Nil {
			q = q.Where("id > ?", cursor)
		}
		if err = q.Find(&rows).Error; err != nil {
			return
		}
		if len(rows) == 0 {
			break
		}
		for _, m := range rows {
			cursor = m.ID
			var updates = map[string]any{}
			if m.Text != "" && !strings.HasPrefix(m.Text, c.ActivePrefix()) {
				plain, e := c.Decrypt(m.Text, messageAAD(m.ChatID, m.ID))
				if e != nil {
					failed++
					continue
				}
				sealed, e := c.Encrypt(plain, messageAAD(m.ChatID, m.ID))
				if e != nil {
					return done, failed, e
				}
				updates["text"] = sealed
			}
			var envelope string
			active := json.Unmarshal([]byte(m.Details), &envelope) == nil && strings.HasPrefix(envelope, c.ActivePrefix())
			if m.Details != "" && m.Details != "{}" && !active {
				plain, e := decryptDetails(c, m, true)
				if e != nil {
					failed++
					continue
				}
				sealed, e := encryptDetails(c, m, plain)
				if e != nil {
					return done, failed, e
				}
				updates["details"] = sealed
			}
			if len(updates) == 0 {
				continue
			}
			res := db.WithContext(ctx).Model(&models.Message{}).Where("id=? AND text=? AND details=?::jsonb", m.ID, m.Text, m.Details).Updates(updates)
			if res.Error != nil {
				return done, failed, res.Error
			}
			done += int(res.RowsAffected)
		}
	}
	cursor = uuid.Nil
	for {
		// One attachment at a time: videos are up to 25 MiB each.
		var rows []mediaRow
		q := db.WithContext(ctx).Order("id").Limit(1)
		if cursor != uuid.Nil {
			q = q.Where("id > ?", cursor)
		}
		prefix := c.ActiveBinaryPrefix()
		q = q.Where("substring(data from 1 for ?) <> ? OR name NOT LIKE ? OR mime NOT LIKE ?", len(prefix), prefix, c.ActivePrefix()+"%", c.ActivePrefix()+"%")
		if err = q.Find(&rows).Error; err != nil {
			return
		}
		if len(rows) == 0 {
			break
		}
		m := rows[0]
		cursor = m.ID
		old := m
		if e := decryptMedia(c, &m, true); e != nil {
			failed++
			continue
		}
		if e := encryptMedia(c, &m); e != nil {
			return done, failed, e
		}
		res := db.WithContext(ctx).Model(&mediaRow{}).Where("id=? AND data=? AND name=? AND mime=?", m.ID, old.Data, old.Name, old.Mime).Updates(map[string]any{"data": m.Data, "name": m.Name, "mime": m.Mime})
		if res.Error != nil {
			return done, failed, res.Error
		}
		done += int(res.RowsAffected)
	}
	if failed > 0 {
		log.Error("chat content encryption failed", "records", failed)
		return done, failed, errors.New("chat content could not be re-encrypted: restore missing keys or damaged data")
	}
	return
}
