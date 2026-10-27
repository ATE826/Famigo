package notifications

import (
	"time"

	"github.com/gin-gonic/gin"

	"github.com/ATE826/Famigo/backend/internal/auth"
	"github.com/ATE826/Famigo/backend/internal/httpx"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler { return &Handler{service: service} }

func (h *Handler) RegisterRoutes(authed *gin.RouterGroup) {
	authed.GET("/notifications", h.list)
	authed.GET("/notifications/unread-count", h.unreadCount)
	authed.POST("/notifications/read-all", h.readAll)
	authed.POST("/notifications/:notificationID/read", h.read)
}

// list — лента от новых к старым. Следующая страница: ?before=<createdAt последнего>.
func (h *Handler) list(c *gin.Context) {
	var before *time.Time
	if value := c.Query("before"); value != "" {
		t, err := time.Parse(time.RFC3339Nano, value)
		if err != nil {
			httpx.Respond(c, httpx.BadRequest("invalid_query", "Неверный параметр before"))
			return
		}
		before = &t
	}
	items, err := h.service.List(c.Request.Context(), auth.UserID(c), before, httpx.QueryLimit(c, 30, 100))
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, gin.H{"items": items})
}

func (h *Handler) unreadCount(c *gin.Context) {
	n, err := h.service.UnreadCount(c.Request.Context(), auth.UserID(c))
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, gin.H{"count": n})
}

func (h *Handler) read(c *gin.Context) {
	id, err := httpx.ParamUUID(c, "notificationID")
	if err == nil {
		err = h.service.MarkRead(c.Request.Context(), auth.UserID(c), id)
	}
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.NoContent(c)
}

func (h *Handler) readAll(c *gin.Context) {
	if err := h.service.MarkAllRead(c.Request.Context(), auth.UserID(c)); err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.NoContent(c)
}
