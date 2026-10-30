package recipes

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/ATE826/Famigo/backend/internal/auth"
	"github.com/ATE826/Famigo/backend/internal/families"
	"github.com/ATE826/Famigo/backend/internal/httpx"
)

type Handler struct {
	service *Service
	// limiter — запросов к нейросети на одного пользователя. Каждый запрос — это минута работы
	// локальной модели или деньги за облачную, поэтому лимит строгий.
	limiter *httpx.RateLimiter
}

// 20 запросов в час в среднем, не больше 5 подряд.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service, limiter: httpx.NewRateLimiter(20.0/60, 5)}
}

func (h *Handler) RegisterRoutes(family *gin.RouterGroup) {
	family.POST("/homes/:homeID/recipes/suggest", h.suggest)
}

var languages = []string{"ru", "en", "es", "zh", "ja", "de"}

type suggestRequest struct {
	Servings   int      `json:"servings"`
	MemberIDs  []string `json:"memberIds"`
	AllMembers *bool    `json:"allMembers"`
	Language   string   `json:"language"`
	Category   string   `json:"category"`
}

func (r suggestRequest) validate() (suggestInput, error) {
	v := httpx.NewValidator()
	in := suggestInput{Servings: r.Servings, Language: r.Language, Category: r.Category}
	// Совместимость со старым API: без флага пустой список означает всю семью.
	in.AllMembers = len(r.MemberIDs) == 0
	if r.AllMembers != nil {
		in.AllMembers = *r.AllMembers
	}
	if in.Language == "" {
		in.Language = "ru"
	}
	if in.Category == "" {
		in.Category = "any"
	}
	v.OneOf("category", in.Category, "any", "snack", "hot", "cold", "soup", "salad", "bakery", "dessert", "drink")
	v.OneOf("language", in.Language, languages...)
	v.Check(in.Servings >= 1 && in.Servings <= 12, "servings", "От 1 до 12 порций")
	v.Check(len(r.MemberIDs) <= 50, "memberIds", "Слишком много участников")
	seen := map[uuid.UUID]bool{}
	for _, raw := range r.MemberIDs {
		id, err := uuid.Parse(raw)
		if err != nil {
			v.Fail("memberIds", "Неверный id участника")
			break
		}
		if !seen[id] {
			seen[id] = true
			in.MemberIDs = append(in.MemberIDs, id)
		}
	}
	return in, v.Err()
}

func (h *Handler) suggest(c *gin.Context) {
	homeID, err := httpx.ParamUUID(c, "homeID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	var req suggestRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	in, err := req.validate()
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	if !h.limiter.Allow("recipes:" + auth.UserID(c).String()) {
		c.Header("Retry-After", strconv.Itoa(180))
		httpx.Respond(c, httpx.TooManyRequests())
		return
	}

	// Локальная модель думает дольше общих таймаутов сервера (30 с). Продлеваем их только
	// для этого запроса, иначе сервер оборвал бы соединение раньше, чем придёт ответ.
	if timeout := h.service.Timeout(); timeout > 0 {
		deadline := time.Now().Add(timeout + 10*time.Second)
		rc := http.NewResponseController(c.Writer)
		_ = rc.SetReadDeadline(deadline)
		_ = rc.SetWriteDeadline(deadline)
	}

	result, err := h.service.Suggest(c.Request.Context(), families.FamilyID(c), homeID, in)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, result)
}
