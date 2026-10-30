package server

import (
	"context"
	"log/slog"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/ai"
	"github.com/ATE826/Famigo/backend/internal/auth"
	"github.com/ATE826/Famigo/backend/internal/budget"
	"github.com/ATE826/Famigo/backend/internal/calendar"
	"github.com/ATE826/Famigo/backend/internal/chats"
	"github.com/ATE826/Famigo/backend/internal/config"
	"github.com/ATE826/Famigo/backend/internal/families"
	"github.com/ATE826/Famigo/backend/internal/fieldcrypt"
	"github.com/ATE826/Famigo/backend/internal/health"
	"github.com/ATE826/Famigo/backend/internal/homes"
	"github.com/ATE826/Famigo/backend/internal/httpx"
	"github.com/ATE826/Famigo/backend/internal/notifications"
	"github.com/ATE826/Famigo/backend/internal/products"
	"github.com/ATE826/Famigo/backend/internal/recipes"
	"github.com/ATE826/Famigo/backend/internal/subscriptions"
	"github.com/ATE826/Famigo/backend/internal/users"
)

// registerRoutes создаёт сервисы и подключает маршруты. Группы — это «уровни доступа»:
//
//	public  — без входа (регистрация, вход), с жёстким лимитом попыток;
//	cookie  — авторизуются кукой refresh-токена, защищены от CSRF;
//	authed  — только с действующим access-токеном;
//	family  — /api/families/:familyID/..., только для участников этой семьи.
func registerRoutes(r *gin.Engine, cfg config.Config, db *gorm.DB, log *slog.Logger) error {
	// Шифрование сообщений в базе. Старые открытые сообщения (и записанные прежним ключом)
	// переводятся на активный ключ при запуске, до приёма запросов.
	messageCipher, err := fieldcrypt.New(cfg.MessageKeys)
	if err != nil {
		return err
	}
	if done, failed, err := chats.Reencrypt(context.Background(), db, messageCipher, log); err != nil {
		return err
	} else if done > 0 || failed > 0 {
		log.Info("сообщения переведены на актуальный ключ шифрования", "переведено", done, "не удалось", failed)
	}

	tokens := auth.NewTokenManager(cfg.JWTSecret, cfg.AccessTokenTTL)
	notifyService := notifications.NewService(db)
	authService := auth.NewService(db, tokens, cfg.RefreshTokenTTL, cfg.LegalVersion)
	subsService := subscriptions.NewService(db, cfg.DemoPayments)
	usersService, err := users.NewService(db, authService, cfg.UploadDir, cfg.LegalVersion)
	if err != nil {
		return err
	}

	// Вход и регистрация: по умолчанию 20 попыток в минуту с одного IP (AUTH_RATE_LIMIT).
	// Обновление токена — втрое мягче: его вызывает каждая открытая вкладка раз в 15 минут.
	authLimit := float64(max(cfg.AuthRateLimit, 1))
	authLimiter := httpx.NewRateLimiter(authLimit, max(int(authLimit/2), 5))
	refreshLimiter := httpx.NewRateLimiter(authLimit*3, max(int(authLimit), 10))
	// Регистрация — вчетверо строже входа (по умолчанию 5 в минуту с адреса).
	registerLimiter := httpx.NewRateLimiter(max(authLimit/4, 1), max(int(authLimit/4), 3))

	api := r.Group("/api")
	jsonAPI := api.Group("", httpx.BodyLimit(jsonBodyLimit))
	uploadAPI := api.Group("", httpx.BodyLimit(uploadBodyLimit))

	public := jsonAPI.Group("", authLimiter.ByIP("auth:"))
	cookie := jsonAPI.Group("", refreshLimiter.ByIP("refresh:"), httpx.SameOrigin(cfg.AllowedOrigins))
	authed := jsonAPI.Group("", auth.RequireAuth(tokens, db))
	authedUpload := uploadAPI.Group("", auth.RequireAuth(tokens, db))
	family := authed.Group("/families/:familyID", families.RequireMember(db))

	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	api.GET("/health", health.NewHandler(sqlDB).Check)

	auth.NewHandler(authService, auth.CookieOptions{Secure: cfg.CookieSecure, SameSite: cfg.CookieSameSite}, registerLimiter).
		RegisterRoutes(public, cookie, authed)
	users.NewHandler(usersService).RegisterRoutes(authed, authedUpload, api)
	notifications.NewHandler(notifyService).RegisterRoutes(authed)
	families.NewHandler(families.NewService(db, notifyService)).RegisterRoutes(authed, family)
	subscriptions.NewHandler(subsService).RegisterRoutes(family)
	homes.NewHandler(homes.NewService(db, subsService)).RegisterRoutes(family)
	products.NewHandler(products.NewService(db)).RegisterRoutes(family)
	recipes.NewHandler(recipes.NewService(db, subsService, ai.New(cfg.AI, log))).RegisterRoutes(family)
	budget.NewHandler(budget.NewService(db, notifyService)).RegisterRoutes(family)
	calendar.NewHandler(calendar.NewService(db, notifyService)).RegisterRoutes(family)
	hub := chats.NewHub(log)
	chats.NewHandler(chats.NewService(db, hub, log, messageCipher), hub, cfg.AllowedOrigins).RegisterRoutes(authed, family, api)
	return nil
}
