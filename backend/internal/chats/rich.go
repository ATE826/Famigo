package chats

import (
	"encoding/json"
	"github.com/ATE826/Famigo/backend/internal/auth"
	"github.com/ATE826/Famigo/backend/internal/families"
	"github.com/ATE826/Famigo/backend/internal/httpx"
	"github.com/ATE826/Famigo/backend/internal/models"
	"github.com/ATE826/Famigo/backend/internal/recipes"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
)

type mediaRow struct {
	ID        uuid.UUID
	ChatID    uuid.UUID
	MessageID *uuid.UUID
	Mime      string
	Name      string
	Data      []byte
}

func (mediaRow) TableName() string { return "chat_media" }

type mediaInfo struct {
	Kind     string    `json:"kind,omitempty"`
	Duration float64   `json:"duration,omitempty"`
	ID       uuid.UUID `json:"id"`
	Mime     string    `json:"mime"`
	Name     string    `json:"name"`
}
type quote struct {
	ID   uuid.UUID `json:"id"`
	Text string    `json:"text"`
}
type richDetails struct {
	Reply      *quote        `json:"reply,omitempty"`
	Forwarded  bool          `json:"forwarded,omitempty"`
	Media      *mediaInfo    `json:"media,omitempty"`
	MediaItems []mediaInfo   `json:"mediaItems,omitempty"`
	Caption    string        `json:"caption,omitempty"`
	Recipe     *recipes.Dish `json:"recipe,omitempty"`
}
type richRequest struct {
	Text         string        `json:"text"`
	ReplyID      *uuid.UUID    `json:"replyId"`
	SourceChatID *uuid.UUID    `json:"sourceChatId"`
	ForwardID    *uuid.UUID    `json:"forwardId"`
	Recipe       *recipes.Dish `json:"recipe"`
}

func (h *Handler) RegisterRichRoutes(family, uploads *gin.RouterGroup) {
	family.POST("/chats/:chatID/rich", h.richSend)
	uploads.POST("/chats/:chatID/media", h.uploadMedia)
	family.GET("/chats/:chatID/media/:mediaID", h.getMedia)
}
func (h *Handler) source(c *gin.Context, chatID, id uuid.UUID) (Message, error) {
	if err := h.service.access(c.Request.Context(), families.FamilyID(c), chatID, auth.UserID(c)); err != nil {
		return Message{}, err
	}
	var row models.Message
	if err := h.service.db.WithContext(c.Request.Context()).Where("id = ? AND chat_id = ? AND deleted_at IS NULL", id, chatID).Take(&row).Error; err != nil {
		return Message{}, errChatNotFound
	}
	return toMessage(h.service.cipher, row), nil
}
func (h *Handler) richSend(c *gin.Context) {
	chatID, err := httpx.ParamUUID(c, "chatID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	if err = h.service.access(c.Request.Context(), families.FamilyID(c), chatID, auth.UserID(c)); err != nil {
		httpx.Respond(c, err)
		return
	}
	var req richRequest
	if err = httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	req.Text = strings.TrimSpace(req.Text)
	if len([]rune(req.Text)) > 2000 {
		httpx.Respond(c, httpx.BadRequest("invalid_message", "Сообщение слишком длинное"))
		return
	}
	details := richDetails{Recipe: req.Recipe}
	var media []mediaRow
	if req.Recipe != nil {
		raw, _ := json.Marshal(req.Recipe)
		if len(raw) > 60000 || req.Recipe.Title == "" || len(req.Recipe.Steps) == 0 {
			httpx.Respond(c, httpx.BadRequest("invalid_recipe", "Неверный рецепт"))
			return
		}
		req.Text = "Рецепт: " + req.Recipe.Title
	}
	if req.ReplyID != nil {
		m, e := h.source(c, chatID, *req.ReplyID)
		if e != nil {
			httpx.Respond(c, e)
			return
		}
		runes := []rune(m.Text)
		if len(runes) > 300 {
			runes = runes[:300]
		}
		details.Reply = &quote{ID: m.ID, Text: string(runes)}
	}
	if req.ForwardID != nil {
		if req.SourceChatID == nil {
			httpx.Respond(c, httpx.BadRequest("invalid_forward", "Не указан исходный чат"))
			return
		}
		m, e := h.source(c, *req.SourceChatID, *req.ForwardID)
		if e != nil {
			httpx.Respond(c, e)
			return
		}
		req.Text = m.Text
		if len(m.Details) > 0 {
			json.Unmarshal(m.Details, &details)
		}
		details.Reply = nil
		details.Forwarded = true
		infos := details.MediaItems
		if details.Media != nil {
			infos = []mediaInfo{*details.Media}
		}
		for i := range infos {
			var row mediaRow
			if h.service.db.WithContext(c.Request.Context()).Where("id = ? AND chat_id = ? AND message_id = ?", infos[i].ID, *req.SourceChatID, m.ID).Take(&row).Error != nil {
				httpx.Respond(c, errChatNotFound)
				return
			}
			if err := decryptMedia(h.service.cipher, &row); err != nil {
				httpx.Respond(c, err)
				return
			}
			row.ID = uuid.New()
			row.ChatID = chatID
			row.MessageID = nil
			media = append(media, row)
			infos[i].ID = row.ID
		}
		if details.Media != nil {
			details.Media = &infos[0]
		} else {
			details.MediaItems = infos
		}
	}
	if req.Text == "" {
		httpx.Respond(c, httpx.BadRequest("empty_message", "Введите сообщение"))
		return
	}
	h.saveRich(c, chatID, req.Text, details, media...)
}
func (h *Handler) saveRich(c *gin.Context, chatID uuid.UUID, text string, details richDetails, media ...mediaRow) {
	if !h.service.sendLimiter.Allow(auth.UserID(c).String()) {
		httpx.Respond(c, httpx.TooManyRequests())
		return
	}
	raw, _ := json.Marshal(details)
	var msg Message
	err := h.service.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var err error
		msg, err = insertMessage(tx, h.service.cipher, chatID, auth.UserID(c), text, string(raw))
		if err != nil {
			return err
		}
		for i := range media {
			row := &media[i]
			row.MessageID = &msg.ID
			if err = encryptMedia(h.service.cipher, row); err != nil {
				return err
			}
			if err = tx.Create(row).Error; err != nil {
				return err
			}
		}
		return err
	})
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	h.service.broadcast(c.Request.Context(), chatID, messageEvent{Type: "message", FamilyID: families.FamilyID(c), ChatID: chatID, Message: msg})
	httpx.Created(c, msg)
}

func (h *Handler) uploadMedia(c *gin.Context) {
	chatID, err := httpx.ParamUUID(c, "chatID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	if err = h.service.access(c.Request.Context(), families.FamilyID(c), chatID, auth.UserID(c)); err != nil {
		httpx.Respond(c, err)
		return
	}
	if err = c.Request.ParseMultipartForm(1 << 20); err != nil {
		httpx.Respond(c, httpx.BadRequest("invalid_file", "Не удалось прочитать файл"))
		return
	}
	defer c.Request.MultipartForm.RemoveAll()
	headers := c.Request.MultipartForm.File["file"]
	if len(headers) == 0 || len(headers) > 10 {
		httpx.Respond(c, httpx.BadRequest("invalid_album", "Выберите от 1 до 10 файлов"))
		return
	}
	caption := strings.TrimSpace(c.PostForm("text"))
	if len([]rune(caption)) > 2000 {
		httpx.Respond(c, httpx.BadRequest("invalid_message", "Подпись слишком длинная"))
		return
	}
	kind := c.PostForm("kind")
	duration := 0.0
	if kind != "" {
		var parseErr error
		duration, parseErr = strconv.ParseFloat(c.PostForm("duration"), 64)
		if len(headers) != 1 || (kind != "voice" && kind != "round") || parseErr != nil || !(duration > 0 && duration <= 86400) || (kind == "round" && duration > 60) {
			httpx.Respond(c, httpx.BadRequest("invalid_recording", "Некорректная запись"))
			return
		}
	}
	details := richDetails{Caption: caption}
	if reply := c.PostForm("replyId"); reply != "" {
		replyID, parseErr := uuid.Parse(reply)
		if parseErr != nil {
			httpx.Respond(c, httpx.BadRequest("invalid_reply", "Некорректный ответ"))
			return
		}
		m, sourceErr := h.source(c, chatID, replyID)
		if sourceErr != nil {
			httpx.Respond(c, sourceErr)
			return
		}
		runes := []rune(m.Text)
		if len(runes) > 300 {
			runes = runes[:300]
		}
		details.Reply = &quote{ID: m.ID, Text: string(runes)}
	}
	var rows []mediaRow
	var infos []mediaInfo
	var names []string
	var total int64
	for _, header := range headers {
		if header.Size <= 0 || header.Size > 25<<20 || total+header.Size > 100<<20 {
			httpx.Respond(c, httpx.BadRequest("invalid_file", "До 25 МБ на файл и до 100 МБ на сообщение"))
			return
		}
		total += header.Size
		file, openErr := header.Open()
		if openErr != nil {
			httpx.Respond(c, httpx.BadRequest("invalid_file", "Не удалось прочитать файл"))
			return
		}
		data, readErr := io.ReadAll(io.LimitReader(file, 25<<20+1))
		file.Close()
		if readErr != nil || len(data) == 0 || len(data) > 25<<20 {
			httpx.Respond(c, httpx.BadRequest("invalid_file", "Фото или видео до 25 МБ"))
			return
		}
		mime := http.DetectContentType(data)
		if len(data) >= 12 && string(data[4:8]) == "ftyp" && string(data[8:12]) == "qt  " {
			mime = "video/quicktime"
		}
		if kind == "voice" {
			if mime == "video/webm" {
				mime = "audio/webm"
			}
			if mime == "video/mp4" {
				mime = "audio/mp4"
			}
			if !strings.HasPrefix(mime, "audio/") && mime != "application/ogg" {
				httpx.Respond(c, httpx.BadRequest("invalid_recording", "Неверный аудиоформат"))
				return
			}
		}
		if kind == "round" && !strings.HasPrefix(mime, "video/") {
			httpx.Respond(c, httpx.BadRequest("invalid_recording", "Неверный видеоформат"))
			return
		}
		if !allowedMedia(mime) || (len(headers) > 1 && !strings.HasPrefix(mime, "image/") && !strings.HasPrefix(mime, "video/")) {
			httpx.Respond(c, httpx.BadRequest("invalid_file", "Поддерживаются JPEG, PNG, GIF, WebP, MP4 и WebM"))
			return
		}
		name := filepath.Base(header.Filename)
		if len(name) > 200 {
			name = "media"
		}
		row := mediaRow{ID: uuid.New(), ChatID: chatID, Mime: mime, Name: name, Data: data}
		rows = append(rows, row)
		infos = append(infos, mediaInfo{ID: row.ID, Mime: mime, Name: name, Kind: kind, Duration: duration})
		names = append(names, name)
	}
	if len(infos) == 1 {
		details.Media = &infos[0]
	} else {
		details.MediaItems = infos
	}
	text := caption
	if text == "" {
		text = strings.Join(names, ", ")
	}
	h.saveRich(c, chatID, text, details, rows...)
}

func allowedMedia(mime string) bool {
	switch mime {
	case "image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm", "video/quicktime", "audio/webm", "audio/mp4", "audio/ogg", "application/ogg", "audio/mpeg", "audio/wave", "audio/wav":
		return true
	}
	return false
}
func (h *Handler) getMedia(c *gin.Context) {
	chatID, err := httpx.ParamUUID(c, "chatID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	id, err := httpx.ParamUUID(c, "mediaID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	if err = h.service.access(c.Request.Context(), families.FamilyID(c), chatID, auth.UserID(c)); err != nil {
		httpx.Respond(c, err)
		return
	}
	var row mediaRow
	if h.service.db.WithContext(c.Request.Context()).Table("chat_media AS a").Select("a.*").Joins("JOIN messages m ON m.id = a.message_id AND m.deleted_at IS NULL").Where("a.id = ? AND a.chat_id = ?", id, chatID).Take(&row).Error != nil {
		httpx.Respond(c, errChatNotFound)
		return
	}
	c.Header("X-Content-Type-Options", "nosniff")
	if err := decryptMedia(h.service.cipher, &row); err != nil {
		httpx.Respond(c, err)
		return
	}
	c.Header("Cache-Control", "no-store")
	c.Data(http.StatusOK, row.Mime, row.Data)
}
