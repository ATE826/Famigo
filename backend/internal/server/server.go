// Пакет server собирает приложение: gin, общие middleware и все маршруты API.
package server

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/config"
	"github.com/ATE826/Famigo/backend/internal/httpx"
)

// Максимальный размер тела: обычные запросы — 1 МБ, загрузка аватара — 6 МБ
// (5 МБ файла плюс служебные части multipart).
const (
	jsonBodyLimit   = 1 << 20
	uploadBodyLimit = 6 << 20
)

func New(cfg config.Config, db *gorm.DB, log *slog.Logger) (http.Handler, error) {
	if cfg.Production {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	// Кому верить в X-Forwarded-For. Пустой список — никому: иначе любой клиент
	// подделает свой IP и обойдёт ограничение частоты запросов.
	if err := r.SetTrustedProxies(cfg.TrustedProxies); err != nil {
		return nil, err
	}
	r.RemoveExtraSlash = true
	r.HandleMethodNotAllowed = true
	r.MaxMultipartMemory = uploadBodyLimit

	// Общее ограничение на один IP (RATE_LIMIT, по умолчанию 600 в минуту).
	// Открытие приложения — около 15 запросов, так что семье за одним роутером хватает
	// с запасом, а простую DoS-атаку лимит отрезает.
	limit := max(cfg.RateLimit, 60)
	global := httpx.NewRateLimiter(float64(limit), limit/3)

	r.Use(
		httpx.RequestIDMiddleware(),
		httpx.Recover(log),
		httpx.Logger(log),
		httpx.SecurityHeaders(cfg.Production),
		httpx.CORS(cfg.AllowedOrigins),
		global.ByIP("all:"),
	)

	r.NoRoute(func(c *gin.Context) {
		httpx.Respond(c, httpx.NotFound("Такого адреса в API нет"))
	})
	r.NoMethod(func(c *gin.Context) {
		httpx.Respond(c, &httpx.Error{Status: http.StatusMethodNotAllowed, Code: "method_not_allowed", Message: "Метод не поддерживается"})
	})

	if err := registerRoutes(r, cfg, db, log); err != nil {
		return nil, err
	}
	return r, nil
}
