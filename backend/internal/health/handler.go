// Пакет health — проверка, что сервер и база живы. Её использует Docker,
// чтобы понять, что сервер готов принимать запросы.
package health

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Pinger — всё, что нужно проверке от базы (его умеет *sql.DB). Интерфейс вместо
// конкретного пула позволяет подставить заглушку в тестах.
type Pinger interface {
	PingContext(ctx context.Context) error
}

type Handler struct {
	db Pinger
}

func NewHandler(db Pinger) *Handler { return &Handler{db: db} }

type response struct {
	Status   string `json:"status"`
	Database string `json:"database"`
}

// Check отвечает 200, если база доступна, и 503, если нет.
// Подробности ошибки наружу не отдаются — только «доступна/недоступна».
func (h *Handler) Check(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	defer cancel()

	if err := h.db.PingContext(ctx); err != nil {
		c.JSON(http.StatusServiceUnavailable, response{Status: "degraded", Database: "unavailable"})
		return
	}
	c.JSON(http.StatusOK, response{Status: "ok", Database: "ok"})
}
