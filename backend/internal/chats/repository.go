package chats

import (
	"sort"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/ATE826/Famigo/backend/internal/fieldcrypt"
	"github.com/ATE826/Famigo/backend/internal/models"
)

// isChatMember — главная проверка доступа: чат принадлежит этой семье
// И пользователь является его участником. Чужой личный чат внутри своей же семьи
// тоже недоступен.
func isChatMember(db *gorm.DB, familyID, chatID, userID uuid.UUID) (bool, error) {
	var n int64
	err := db.Model(&models.ChatMember{}).
		Joins("JOIN chats ON chats.id = chat_members.chat_id").
		Where("chats.family_id = ? AND chats.id = ? AND chat_members.user_id = ?", familyID, chatID, userID).
		Count(&n).Error
	return n > 0, err
}

// listChats собирает список чатов из четырёх простых запросов: мои чаты, их участники,
// непрочитанные и последние сообщения. Чатов в семье немного, так что это быстро.
func listChats(db *gorm.DB, c *fieldcrypt.Cipher, familyID, userID uuid.UUID) ([]Chat, error) {
	// 1. Чаты этой семьи, в которых состоит пользователь, с его настройками.
	familyChats := db.Model(&models.Chat{}).Select("id").Where("family_id = ?", familyID)
	var mine []models.ChatMember
	if err := db.Preload("Chat").Where("user_id = ? AND chat_id IN (?)", userID, familyChats).Find(&mine).Error; err != nil {
		return nil, err
	}
	if len(mine) == 0 {
		return []Chat{}, nil
	}
	ids := make([]uuid.UUID, len(mine))
	for i, m := range mine {
		ids[i] = m.ChatID
	}

	// 2. Остальные участники: собеседник личного чата и «когда они последний раз читали».
	var others []models.ChatMember
	if err := db.Where("chat_id IN ? AND user_id <> ?", ids, userID).Find(&others).Error; err != nil {
		return nil, err
	}
	peers := map[uuid.UUID]uuid.UUID{}
	readAt := map[uuid.UUID]time.Time{}
	for _, o := range others {
		peers[o.ChatID] = o.UserID
		if o.LastReadAt.After(readAt[o.ChatID]) {
			readAt[o.ChatID] = o.LastReadAt
		}
	}

	// 3. Непрочитанные: чужие неудалённые сообщения новее моего last_read_at.
	var unread []struct {
		ChatID uuid.UUID
		Count  int
	}
	err := db.Model(&models.Message{}).
		Select("messages.chat_id, count(*) AS count").
		Joins("JOIN chat_members cm ON cm.chat_id = messages.chat_id AND cm.user_id = ?", userID).
		Where("messages.chat_id IN ? AND messages.created_at > cm.last_read_at AND messages.deleted_at IS NULL", ids).
		Where("messages.user_id IS DISTINCT FROM ?", userID).
		Group("messages.chat_id").
		Scan(&unread).Error
	if err != nil {
		return nil, err
	}
	unreadBy := make(map[uuid.UUID]int, len(unread))
	for _, u := range unread {
		unreadBy[u.ChatID] = u.Count
	}

	// 4. Последнее сообщение каждого чата: DISTINCT ON оставляет по одной строке на чат.
	var last []models.Message
	err = db.Select("DISTINCT ON (chat_id) *").
		Where("chat_id IN ?", ids).
		Order("chat_id, created_at DESC, id DESC").
		Find(&last).Error
	if err != nil {
		return nil, err
	}
	lastBy := make(map[uuid.UUID]models.Message, len(last))
	for _, m := range last {
		lastBy[m.ChatID] = m
	}

	chats := make([]Chat, len(mine))
	activity := make(map[uuid.UUID]time.Time, len(mine))
	for i, m := range mine {
		ch := Chat{ID: m.ChatID, Kind: m.Chat.Kind, Muted: m.Muted, Pinned: m.Pinned, Unread: unreadBy[m.ChatID]}
		if peer, ok := peers[m.ChatID]; ok && m.Chat.Kind == "direct" {
			ch.PeerID = &peer
		}
		if at, ok := readAt[m.ChatID]; ok {
			ch.OthersReadAt = &at
		}
		activity[m.ChatID] = m.Chat.CreatedAt
		if msg, ok := lastBy[m.ChatID]; ok {
			view := toMessage(c, msg)
			ch.LastMessage = &view
			activity[m.ChatID] = msg.CreatedAt
		}
		chats[i] = ch
	}
	// Сверху закреплённые, дальше — где недавно писали.
	sort.SliceStable(chats, func(i, j int) bool {
		if chats[i].Pinned != chats[j].Pinned {
			return chats[i].Pinned
		}
		return activity[chats[i].ID].After(activity[chats[j].ID])
	})
	return chats, nil
}

// toMessage — сообщение для ответа API: текст расшифрован, у удалённых его нет.
func toMessage(c *fieldcrypt.Cipher, m models.Message) Message {
	msg := Message{ID: m.ID, UserID: m.UserID, CreatedAt: m.CreatedAt, Deleted: m.DeletedAt != nil}
	if !msg.Deleted {
		msg.Text = decryptText(c, m)
	}
	return msg
}

// getOrCreateDirect — личный чат двух участников семьи. Ключ «меньший:больший id»
// и уникальный индекс в базе гарантируют, что такой чат у пары один.
// ON CONFLICT ... DO UPDATE нужен, чтобы RETURNING вернул id уже существующего чата.
func getOrCreateDirect(tx *gorm.DB, familyID, a, b uuid.UUID) (uuid.UUID, error) {
	key := directKey(a, b)
	chat := models.Chat{FamilyID: familyID, Kind: "direct", DirectKey: &key}
	err := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "family_id"}, {Name: "direct_key"}},
		DoUpdates: clause.AssignmentColumns([]string{"direct_key"}),
	}).Create(&chat).Error
	if err != nil {
		return uuid.Nil, err
	}
	members := []models.ChatMember{{ChatID: chat.ID, UserID: a}, {ChatID: chat.ID, UserID: b}}
	err = tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&members).Error
	return chat.ID, err
}

func directKey(a, b uuid.UUID) string {
	x, y := a.String(), b.String()
	if x > y {
		x, y = y, x
	}
	return x + ":" + y
}

func bothInFamily(db *gorm.DB, familyID, a, b uuid.UUID) (bool, error) {
	var n int64
	err := db.Model(&models.FamilyMember{}).
		Where("family_id = ? AND user_id IN ?", familyID, []uuid.UUID{a, b}).
		Count(&n).Error
	return n == 2, err
}

// listMessages — страница сообщений от новых к старым.
func listMessages(db *gorm.DB, c *fieldcrypt.Cipher, chatID uuid.UUID, before *time.Time, limit int) ([]Message, error) {
	q := db.Where("chat_id = ?", chatID)
	if before != nil {
		q = q.Where("created_at < ?", *before)
	}
	var rows []models.Message
	if err := q.Order("created_at DESC, id DESC").Limit(limit).Find(&rows).Error; err != nil {
		return nil, err
	}
	messages := make([]Message, len(rows))
	for i, m := range rows {
		messages[i] = toMessage(c, m)
	}
	return messages, nil
}

// insertMessage шифрует текст и сохраняет сообщение. Id создаётся здесь, а не в базе:
// он нужен до записи, чтобы привязать к нему шифртекст (messageAAD).
func insertMessage(db *gorm.DB, c *fieldcrypt.Cipher, chatID, userID uuid.UUID, text string) (Message, error) {
	m := models.Message{ID: uuid.New(), ChatID: chatID, UserID: &userID}
	sealed, err := c.Encrypt(text, messageAAD(chatID, m.ID))
	if err != nil {
		return Message{}, err
	}
	m.Text = sealed
	if err := db.Create(&m).Error; err != nil {
		return Message{}, err
	}
	// Автору и участникам отдаём открытый текст, который мы только что получили.
	return Message{ID: m.ID, UserID: &userID, Text: text, CreatedAt: m.CreatedAt}, nil
}

// deleteMessage — удалить можно только своё сообщение (условие user_id = ?).
// Текст стирается, чтобы удалённое сообщение нигде не хранилось.
func deleteMessage(db *gorm.DB, chatID, messageID, userID uuid.UUID) (bool, error) {
	res := db.Model(&models.Message{}).
		Where("chat_id = ? AND id = ? AND user_id = ? AND deleted_at IS NULL", chatID, messageID, userID).
		Updates(map[string]any{"deleted_at": gorm.Expr("now()"), "text": ""})
	return res.RowsAffected > 0, res.Error
}

// markRead ставит last_read_at = now() по часам базы (по ним же стоит created_at сообщений)
// и через RETURNING возвращает это время, чтобы разослать его остальным.
func markRead(db *gorm.DB, chatID, userID uuid.UUID) (time.Time, error) {
	var m models.ChatMember
	err := db.Model(&m).
		Clauses(clause.Returning{Columns: []clause.Column{{Name: "last_read_at"}}}).
		Where("chat_id = ? AND user_id = ?", chatID, userID).
		Update("last_read_at", gorm.Expr("now()")).Error
	return m.LastReadAt, err
}

// memberIDs — кому рассылать события чата: только его участникам.
func memberIDs(db *gorm.DB, chatID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := db.Model(&models.ChatMember{}).Where("chat_id = ?", chatID).Pluck("user_id", &ids).Error
	return ids, err
}

func updateSettings(db *gorm.DB, chatID, userID uuid.UUID, muted, pinned *bool) error {
	updates := map[string]any{}
	if muted != nil {
		updates["muted"] = *muted
	}
	if pinned != nil {
		updates["pinned"] = *pinned
	}
	if len(updates) == 0 {
		return nil
	}
	return db.Model(&models.ChatMember{}).Where("chat_id = ? AND user_id = ?", chatID, userID).Updates(updates).Error
}
