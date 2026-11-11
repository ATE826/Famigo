package users

import (
	"errors"
	"mime/multipart"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/ATE826/Famigo/backend/internal/auth"
	"github.com/ATE826/Famigo/backend/internal/httpx"
)

var phonePattern = regexp.MustCompile(`^\+[0-9]{10,15}$`)

const maxFoodPrefs = 60

type Handler struct {
	service *Service
	// Перекодирование картинки нагружает процессор: не больше 10 загрузок в минуту.
	uploadLimiter *httpx.RateLimiter
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service, uploadLimiter: httpx.NewRateLimiter(10, 5)}
}

// RegisterRoutes: authed — JSON-запросы вошедших; upload — то же, но с лимитом тела 6 МБ;
// public — отдача файлов аватаров.
func (h *Handler) RegisterRoutes(authed, upload, public *gin.RouterGroup) {
	authed.GET("/me", h.get)
	authed.PATCH("/me", h.update)
	authed.DELETE("/me", h.deleteAccount)
	authed.PUT("/me/food", h.updateFood)
	authed.PUT("/me/settings", h.updateSettings)
	authed.DELETE("/me/avatar", h.deleteAvatar)
	upload.PUT("/me/avatar", h.uploadAvatar)
	public.GET("/uploads/avatars/:name", h.serveAvatar)
}

func (h *Handler) get(c *gin.Context) {
	p, err := h.service.Get(c.Request.Context(), auth.UserID(c))
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, p)
}

type updateRequest struct {
	Name       *string `json:"name"`
	Birthday   *string `json:"birthday"`
	Phone      *string `json:"phone"`
	AvatarTone *string `json:"avatarTone"`
}

func (h *Handler) update(c *gin.Context) {
	var req updateRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	v := httpx.NewValidator()
	var patch profilePatch
	if req.Name != nil {
		name := v.Text("name", *req.Name, 1, 30)
		patch.Name = &name
	}
	if req.Birthday != nil {
		if strings.TrimSpace(*req.Birthday) == "" {
			patch.ClearBirthday = true
		} else {
			date := v.Birthday("birthday", *req.Birthday)
			patch.Birthday = &date
		}
	}
	if req.Phone != nil {
		phone := strings.ReplaceAll(strings.TrimSpace(*req.Phone), " ", "")
		if phone == "" {
			patch.ClearPhone = true
		} else {
			v.Check(phonePattern.MatchString(phone), "phone", "Номер в формате +79991234567")
			patch.Phone = &phone
		}
	}
	if req.AvatarTone != nil {
		v.OneOf("avatarTone", *req.AvatarTone, tones...)
		patch.AvatarTone = req.AvatarTone
	}
	if err := v.Err(); err != nil {
		httpx.Respond(c, err)
		return
	}
	p, err := h.service.Update(c.Request.Context(), auth.UserID(c), patch)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, p)
}

type foodRequest struct {
	Prefs   []string `json:"prefs"`
	Note    *string  `json:"note"`
	Consent bool     `json:"consent"`
}

func (h *Handler) updateFood(c *gin.Context) {
	var req foodRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	v := httpx.NewValidator()
	v.Check(len(req.Prefs) <= maxFoodPrefs, "prefs", "Слишком много пунктов")
	seen := map[string]bool{}
	prefs := make([]string, 0, len(req.Prefs))
	for _, raw := range req.Prefs {
		pref := v.Text("prefs", raw, 1, 40)
		key := strings.ToLower(pref)
		if pref != "" && !seen[key] {
			seen[key] = true
			prefs = append(prefs, pref)
		}
	}
	note := v.OptionalText("note", req.Note, 60, false)
	if err := v.Err(); err != nil {
		httpx.Respond(c, err)
		return
	}
	p, err := h.service.UpdateFood(c.Request.Context(), auth.UserID(c), prefs, note, req.Consent)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, p)
}

func (h *Handler) updateSettings(c *gin.Context) {
	var req Settings
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	v := httpx.NewValidator()
	v.OneOf("language", req.Language, languages...)
	if err := v.Err(); err != nil {
		httpx.Respond(c, err)
		return
	}
	p, err := h.service.UpdateSettings(c.Request.Context(), auth.UserID(c), req)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, p)
}

// uploadAvatar принимает multipart/form-data с полем "avatar".
func (h *Handler) uploadAvatar(c *gin.Context) {
	userID := auth.UserID(c)
	if !h.uploadLimiter.Allow(userID.String()) {
		httpx.Respond(c, httpx.TooManyRequests())
		return
	}
	header, err := c.FormFile("avatar")
	var file multipart.File
	if err == nil {
		file, err = header.Open()
	}
	if err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			httpx.Respond(c, &httpx.Error{Status: http.StatusRequestEntityTooLarge, Code: "too_large", Message: "Файл больше 5 МБ"})
			return
		}
		httpx.Respond(c, httpx.BadRequest("no_file", "Прикрепите картинку в поле avatar"))
		return
	}
	defer file.Close()

	p, err := h.service.UploadAvatar(c.Request.Context(), userID, file)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, p)
}

func (h *Handler) deleteAvatar(c *gin.Context) {
	p, err := h.service.DeleteAvatar(c.Request.Context(), auth.UserID(c))
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, p)
}

// serveAvatar отдаёт файл аватара. Имя — 128 случайных бит, угадать его нельзя,
// поэтому ссылку можно вставлять в <img> без токена (браузер не умеет добавлять
// заголовок Authorization к картинкам).
func (h *Handler) serveAvatar(c *gin.Context) {
	path, ok := h.service.AvatarPath(c.Param("name"))
	if !ok {
		httpx.Respond(c, httpx.NotFound("Файл не найден"))
		return
	}
	c.Header("Content-Type", "image/jpeg")
	c.Header("Cache-Control", "private, max-age=86400")
	c.Header("Content-Disposition", "inline")
	c.File(path)
}

type deleteAccountRequest struct {
	Password string `json:"password"`
}

func (h *Handler) deleteAccount(c *gin.Context) {
	var req deleteAccountRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	if req.Password == "" || len(req.Password) > 72 {
		httpx.Respond(c, httpx.Validation(map[string]string{"password": "Введите пароль"}))
		return
	}
	if err := h.service.DeleteAccount(c.Request.Context(), auth.UserID(c), req.Password); err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.NoContent(c)
}
