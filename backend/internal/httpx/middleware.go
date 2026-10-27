package httpx

import (
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/gin-gonic/gin"
)

const requestIDKey = "request_id"

// RequestID даёт каждому запросу случайный номер. Он попадает в лог и в заголовок ответа:
// по номеру из жалобы пользователя легко найти нужную строку лога.
// Номер от клиента не принимаем — его можно подделать и засорить логи.
func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		buf := make([]byte, 8)
		rand.Read(buf)
		id := hex.EncodeToString(buf)
		c.Set(requestIDKey, id)
		c.Header("X-Request-ID", id)
		c.Next()
	}
}

func RequestID(c *gin.Context) string { return c.GetString(requestIDKey) }

// Logger пишет в лог метод, путь, статус и время. Тела запросов и заголовок Authorization
// не пишутся: там пароли и токены.
func Logger(log *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		log.Info("запрос",
			"method", c.Request.Method,
			"path", c.FullPath(),
			"status", c.Writer.Status(),
			"duration", time.Since(start).Round(time.Microsecond),
			"ip", c.ClientIP(),
			"request_id", RequestID(c),
		)
	}
}

// Recover ловит панику в обработчике: сервер не падает, клиент получает 500 без подробностей.
func Recover(log *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				log.Error("паника в обработчике", "err", err, "path", c.FullPath(), "request_id", RequestID(c))
				Respond(c, &Error{Status: http.StatusInternalServerError, Code: "internal", Message: "Внутренняя ошибка сервера"})
			}
		}()
		c.Next()
	}
}

// SecurityHeaders добавляет заголовки, которые включают защиту в браузере:
//   - nosniff — браузер не будет «угадывать» тип файла (защита от загрузки HTML под видом картинки);
//   - запрет показа API во фрейме (clickjacking);
//   - CSP «ничего не загружать» — ответ API никогда не исполнится как страница;
//   - no-store — ответы с личными данными не оседают в кэше браузера и прокси;
//   - CORP same-site — аватары и другие ответы нельзя встроить на чужой сайт;
//   - HSTS — только HTTPS (включается в production).
func SecurityHeaders(hsts bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.Writer.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		h.Set("Cache-Control", "no-store")
		h.Set("Cross-Origin-Resource-Policy", "same-site")
		if hsts {
			h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		c.Next()
	}
}

// BodyLimit ограничивает размер тела запроса. Без этого можно прислать гигабайт
// и занять память сервера.
func BodyLimit(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		c.Next()
	}
}

// CORS разрешает браузеру ходить к API только с адресов фронтенда из списка.
// Allow-Credentials нужен, чтобы браузер отправлял куку с refresh-токеном.
func CORS(allowed []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && slices.Contains(allowed, origin) {
			h := c.Writer.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Allow-Credentials", "true")
			h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			h.Set("Access-Control-Max-Age", "600")
			h.Add("Vary", "Origin")
		}
		// Предварительный запрос браузера: отвечаем сразу. Если адрес не из списка,
		// заголовков разрешения нет, и браузер сам заблокирует настоящий запрос.
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// SameOrigin защищает запросы, которые авторизуются кукой (обновление токена, выход),
// от CSRF: чужой сайт не может заставить браузер пользователя их отправить.
// SameSite у куки уже защищает, это второй рубеж — проверка заголовка Origin.
func SameOrigin(allowed []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" || slices.Contains(allowed, origin) || origin == "http://"+c.Request.Host || origin == "https://"+c.Request.Host {
			c.Next()
			return
		}
		Respond(c, Forbidden("Запрос с чужого сайта"))
	}
}
