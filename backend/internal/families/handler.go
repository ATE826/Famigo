package families

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/ATE826/Famigo/backend/internal/auth"
	"github.com/ATE826/Famigo/backend/internal/httpx"
)

type Handler struct {
	service *Service
	// Защита от подбора кодов приглашения: 32^5 ≈ 33 млн вариантов, при 10 попытках
	// в минуту перебор займёт годы.
	joinLimiter *httpx.RateLimiter
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service, joinLimiter: httpx.NewRateLimiter(10, 5)}
}

// RegisterRoutes: authed — для вошедших, family — для участников конкретной семьи
// (/api/families/:familyID, перед ним стоит RequireMember).
func (h *Handler) RegisterRoutes(authed, family *gin.RouterGroup) {
	authed.GET("/families", h.list)
	authed.POST("/families", h.create)
	authed.POST("/families/join", h.join)

	family.GET("", h.details)
	family.PATCH("", h.rename)
	family.POST("/invite", h.invite)
	family.POST("/leave", h.leave)
	family.POST("/owner", h.transferOwnership)
	family.PATCH("/members/:userID", h.changeRole)
	family.DELETE("/members/:userID", h.removeMember)
	family.PUT("/members/:userID/home", h.setHome)
}

func (h *Handler) list(c *gin.Context) {
	items, err := h.service.List(c.Request.Context(), auth.UserID(c))
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, gin.H{"items": items})
}

type nameRequest struct {
	Name string `json:"name"`
}

func (h *Handler) create(c *gin.Context) {
	var req nameRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	v := httpx.NewValidator()
	name := v.Text("name", req.Name, 1, 40)
	if err := v.Err(); err != nil {
		httpx.Respond(c, err)
		return
	}
	details, err := h.service.Create(c.Request.Context(), auth.UserID(c), name)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.Created(c, details)
}

func (h *Handler) details(c *gin.Context) {
	details, err := h.service.Details(c.Request.Context(), FamilyID(c), auth.UserID(c))
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, details)
}

func (h *Handler) rename(c *gin.Context) {
	var req nameRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	v := httpx.NewValidator()
	name := v.Text("name", req.Name, 1, 40)
	if err := v.Err(); err != nil {
		httpx.Respond(c, err)
		return
	}
	if err := h.service.Rename(c.Request.Context(), FamilyID(c), Role(c), name); err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.NoContent(c)
}

func (h *Handler) invite(c *gin.Context) {
	inv, err := h.service.Invite(c.Request.Context(), FamilyID(c), auth.UserID(c))
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, inv)
}

type joinRequest struct {
	Code string `json:"code"`
}

func (h *Handler) join(c *gin.Context) {
	userID := auth.UserID(c)
	if !h.joinLimiter.Allow(userID.String()) || !h.joinLimiter.Allow("ip:"+httpx.ClientKey(c)) {
		httpx.Respond(c, httpx.TooManyRequests())
		return
	}
	var req joinRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	details, err := h.service.Join(c.Request.Context(), userID, req.Code)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, details)
}

func (h *Handler) leave(c *gin.Context) {
	if err := h.service.Leave(c.Request.Context(), FamilyID(c), auth.UserID(c)); err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.NoContent(c)
}

type userRequest struct {
	UserID uuid.UUID `json:"userId"`
}

func (h *Handler) transferOwnership(c *gin.Context) {
	var req userRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	if err := h.service.TransferOwnership(c.Request.Context(), FamilyID(c), auth.UserID(c), req.UserID); err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.NoContent(c)
}

type roleRequest struct {
	Role string `json:"role"`
}

func (h *Handler) changeRole(c *gin.Context) {
	targetID, err := httpx.ParamUUID(c, "userID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	var req roleRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	v := httpx.NewValidator()
	v.OneOf("role", req.Role, RoleAdmin, RoleMember)
	if err := v.Err(); err != nil {
		httpx.Respond(c, err)
		return
	}
	if err := h.service.ChangeRole(c.Request.Context(), FamilyID(c), auth.UserID(c), targetID, req.Role); err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.NoContent(c)
}

func (h *Handler) removeMember(c *gin.Context) {
	targetID, err := httpx.ParamUUID(c, "userID")
	if err == nil {
		err = h.service.RemoveMember(c.Request.Context(), FamilyID(c), auth.UserID(c), targetID)
	}
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.NoContent(c)
}

type homeRequest struct {
	HomeID *uuid.UUID `json:"homeId"`
}

func (h *Handler) setHome(c *gin.Context) {
	targetID, err := httpx.ParamUUID(c, "userID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	var req homeRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	if err := h.service.SetHome(c.Request.Context(), FamilyID(c), Role(c), targetID, req.HomeID); err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.NoContent(c)
}
