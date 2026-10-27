package budget

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/ATE826/Famigo/backend/internal/auth"
	"github.com/ATE826/Famigo/backend/internal/families"
	"github.com/ATE826/Famigo/backend/internal/httpx"
)

// Самая большая сумма одной операции — 10 млрд ₽ в копейках. Защищает от переполнения
// при суммировании и от «шуточных» сумм, которые ломают графики.
const maxAmount = 1_000_000_000_000

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler { return &Handler{service: service} }

func (h *Handler) RegisterRoutes(family *gin.RouterGroup) {
	family.GET("/transactions", h.list)
	family.POST("/transactions", h.add)
	family.DELETE("/transactions/:transactionID", h.delete)
	family.GET("/budget/summary", h.summary)
}

// queryMonth читает ?month=2026-10; без параметра — текущий месяц.
func queryMonth(c *gin.Context) (time.Time, error) {
	value := c.Query("month")
	if value == "" {
		return time.Now(), nil
	}
	month, err := time.Parse("2006-01", value)
	if err != nil {
		return time.Time{}, httpx.BadRequest("invalid_query", "Месяц в формате 2026-10")
	}
	return month, nil
}

// Самый длинный период истории за один запрос — 3 года.
const maxMonths = 36

// list: ?month=2026-10 — один месяц; ?from=2026-01&to=2026-10 — период (оба месяца включительно).
func (h *Handler) list(c *gin.Context) {
	from, err := queryMonth(c)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	to := from
	if c.Query("from") != "" || c.Query("to") != "" {
		var errFrom, errTo error
		from, errFrom = time.Parse("2006-01", c.Query("from"))
		to, errTo = time.Parse("2006-01", c.Query("to"))
		months := (to.Year()-from.Year())*12 + int(to.Month()-from.Month())
		if errFrom != nil || errTo != nil || months < 0 || months >= maxMonths {
			httpx.Respond(c, httpx.BadRequest("invalid_query", "Период from–to в формате 2026-01, не длиннее 3 лет"))
			return
		}
	}
	items, err := h.service.List(c.Request.Context(), families.FamilyID(c), from, to, httpx.QueryLimit(c, 1000, 3000))
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, gin.H{"items": items})
}

func (h *Handler) summary(c *gin.Context) {
	month, err := queryMonth(c)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	sum, err := h.service.Summary(c.Request.Context(), families.FamilyID(c), month)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, sum)
}

type transactionRequest struct {
	Type        string     `json:"type"`
	Category    string     `json:"category"`
	Title       *string    `json:"title"`
	Description *string    `json:"description"`
	Amount      int64      `json:"amount"`
	OccurredOn  string     `json:"occurredOn"`
	HomeID      *uuid.UUID `json:"homeId"`
}

func (r transactionRequest) validate() (transactionInput, error) {
	v := httpx.NewValidator()
	in := transactionInput{
		Type:        r.Type,
		Category:    r.Category,
		Title:       v.OptionalText("title", r.Title, 20, false),
		Description: v.OptionalText("description", r.Description, 100, false),
		Amount:      r.Amount,
		OccurredOn:  v.Date("occurredOn", r.OccurredOn),
		HomeID:      r.HomeID,
	}
	v.OneOf("type", r.Type, "income", "expense")
	if r.Type == "income" {
		v.OneOf("category", r.Category, incomeCategories...)
	} else {
		v.OneOf("category", r.Category, expenseCategories...)
	}
	v.Check(r.Category != "other" || in.Title != nil, "title", "Укажите название")
	v.Check(r.Amount > 0 && r.Amount <= maxAmount, "amount", "Сумма должна быть больше нуля")
	v.Check(in.OccurredOn.IsZero() || in.OccurredOn.Year() >= 2000 && in.OccurredOn.Before(time.Now().AddDate(1, 0, 0)), "occurredOn", "Неверная дата")
	return in, v.Err()
}

func (h *Handler) add(c *gin.Context) {
	var req transactionRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	in, err := req.validate()
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	t, err := h.service.Add(c.Request.Context(), families.FamilyID(c), auth.UserID(c), in)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.Created(c, t)
}

func (h *Handler) delete(c *gin.Context) {
	id, err := httpx.ParamUUID(c, "transactionID")
	if err == nil {
		err = h.service.Delete(c.Request.Context(), families.FamilyID(c), auth.UserID(c), families.Role(c), id)
	}
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.NoContent(c)
}
