package chats

import (
	"context"
	"log/slog"

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

// Reencrypt переводит сообщения на активный ключ: шифрует старые открытые (появились до
// включения шифрования) и перешифровывает записанные старым ключом (после смены ключа).
// Вызывается при запуске сервера. Возвращает, сколько сообщений обработано и сколько
// не удалось (их ключа нет в MESSAGE_KEYS — они остаются как есть, это видно в логе).
//
// Работает пачками по 500 в транзакции. Запись обновляется только если за это время её
// никто не изменил (условие по прежнему значению), поэтому параллельная работа безопасна.
func Reencrypt(ctx context.Context, db *gorm.DB, c *fieldcrypt.Cipher, log *slog.Logger) (done, failed int, err error) {
	if !c.Enabled() {
		return 0, 0, nil
	}
	skip := []uuid.UUID{}
	for {
		q := db.WithContext(ctx).
			Where("deleted_at IS NULL AND text <> '' AND text NOT LIKE ?", c.ActivePrefix()+"%")
		if len(skip) > 0 {
			q = q.Where("id NOT IN ?", skip)
		}
		var rows []models.Message
		if err := q.Order("created_at, id").Limit(500).Find(&rows).Error; err != nil {
			return done, failed, err
		}
		if len(rows) == 0 {
			return done, failed, nil
		}

		err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			for _, m := range rows {
				aad := messageAAD(m.ChatID, m.ID)
				plain, err := c.Decrypt(m.Text, aad)
				if err != nil {
					log.Error("сообщение не переведено на новый ключ", "message_id", m.ID, "err", err)
					skip = append(skip, m.ID)
					failed++
					continue
				}
				sealed, err := c.Encrypt(plain, aad)
				if err != nil {
					return err
				}
				res := tx.Model(&models.Message{}).
					Where("id = ? AND text = ?", m.ID, m.Text).
					Update("text", sealed)
				if res.Error != nil {
					return res.Error
				}
				if res.RowsAffected == 0 {
					skip = append(skip, m.ID) // изменилось параллельно: вернёмся к нему при следующем запуске
					continue
				}
				done++
			}
			return nil
		})
		if err != nil {
			return done, failed, err
		}
	}
}
