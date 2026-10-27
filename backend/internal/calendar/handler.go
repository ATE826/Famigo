package calendar

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/ATE826/Famigo/backend/internal/auth"
	"github.com/ATE826/Famigo/backend/internal/families"
	"github.com/ATE826/Famigo/backend/internal/httpx"
)

// Самый длинный период за один запрос — год с запасом. Без ограничения
// можно было бы запросить события за тысячу лет и нагрузить базу.
const maxRange = 400 * 24 * time.Hour

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler { return &Handler{service: service} }

func (h *Handler) RegisterRoutes(family *gin.RouterGroup) {
	family.GET("/events", h.list)
	family.POST("/events", h.create)
	family.DELETE("/events/:eventID", h.delete)
}

// list: ?from=2026-10-01&to=2026-11-01 (to не включается).
func (h *Handler) list(c *gin.Context) {
	from, okFrom, err := httpx.QueryDate(c, "from")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	to, okTo, err := httpx.QueryDate(c, "to")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	if !okFrom || !okTo || !to.After(from) || to.Sub(from) > maxRange {
		httpx.Respond(c, httpx.BadRequest("invalid_query", "Укажите период from и to не длиннее года"))
		return
	}
	items, err := h.service.List(c.Request.Context(), families.FamilyID(c), from, to)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, gin.H{"items": items})
}

type eventRequest struct {
	Title       string      `json:"title"`
	Description *string     `json:"description"`
	StartsAt    time.Time   `json:"startsAt"`
	EndsAt      *time.Time  `json:"endsAt"`
	Place       *string     `json:"place"`
	MemberIDs   []uuid.UUID `json:"memberIds"`
}

func (r eventRequest) validate() (eventInput, error) {
	v := httpx.NewValidator()
	in := eventInput{
		Title:       v.Text("title", r.Title, 1, 60),
		Description: v.OptionalText("description", r.Description, 200, true),
		StartsAt:    r.StartsAt,
		EndsAt:      r.EndsAt,
		Place:       r.Place,
		MemberIDs:   unique(r.MemberIDs),
	}
	v.Check(!r.StartsAt.IsZero(), "startsAt", "Укажите дату и время")
	v.Check(r.StartsAt.IsZero() || (r.StartsAt.Year() >= 2000 && r.StartsAt.Year() <= 2100), "startsAt", "Неверная дата")
	v.Check(r.EndsAt == nil || r.EndsAt.After(r.StartsAt), "endsAt", "Событие должно закончиться позже начала")
	if r.Place != nil {
		v.OneOf("place", *r.Place, places...)
	}
	v.Check(len(in.MemberIDs) >= 1 && len(in.MemberIDs) <= 100, "memberIds", "Выберите участников")
	return in, v.Err()
}

func unique(ids []uuid.UUID) []uuid.UUID {
	seen := map[uuid.UUID]bool{}
	result := make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		if !seen[id] {
			seen[id] = true
			result = append(result, id)
		}
	}
	return result
}

func (h *Handler) create(c *gin.Context) {
	var req eventRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	in, err := req.validate()
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	event, err := h.service.Create(c.Request.Context(), families.FamilyID(c), auth.UserID(c), in)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.Created(c, event)
}

func (h *Handler) delete(c *gin.Context) {
	id, err := httpx.ParamUUID(c, "eventID")
	if err == nil {
		err = h.service.Delete(c.Request.Context(), families.FamilyID(c), auth.UserID(c), families.Role(c), id)
	}
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.NoContent(c)
}
