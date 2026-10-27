package subscriptions

import (
	"github.com/gin-gonic/gin"

	"github.com/ATE826/Famigo/backend/internal/auth"
	"github.com/ATE826/Famigo/backend/internal/families"
	"github.com/ATE826/Famigo/backend/internal/httpx"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler { return &Handler{service: service} }

func (h *Handler) RegisterRoutes(family *gin.RouterGroup) {
	family.GET("/subscription", h.current)
	family.POST("/subscription", h.subscribe)
	family.POST("/subscription/cancel", h.cancel)
	family.POST("/subscription/resume", h.resume)
}

func (h *Handler) current(c *gin.Context) {
	sub, err := h.service.Get(c.Request.Context(), families.FamilyID(c))
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, sub)
}

type subscribeRequest struct {
	Plan   string `json:"plan"`
	Period string `json:"period"`
}

func (h *Handler) subscribe(c *gin.Context) {
	var req subscribeRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	v := httpx.NewValidator()
	v.OneOf("plan", req.Plan, PlanPremium, PlanPremiumPlus)
	v.OneOf("period", req.Period, "month", "year")
	if err := v.Err(); err != nil {
		httpx.Respond(c, err)
		return
	}
	sub, err := h.service.Subscribe(c.Request.Context(), families.FamilyID(c), auth.UserID(c), families.Role(c), req.Plan, req.Period)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, sub)
}

func (h *Handler) cancel(c *gin.Context) { h.setAutoRenew(c, false) }
func (h *Handler) resume(c *gin.Context) { h.setAutoRenew(c, true) }

func (h *Handler) setAutoRenew(c *gin.Context, on bool) {
	sub, err := h.service.SetAutoRenew(c.Request.Context(), families.FamilyID(c), auth.UserID(c), families.Role(c), on)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, sub)
}
