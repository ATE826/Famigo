// Пакет httpx — общие помощники для HTTP: ошибки, чтение запросов, проверка ввода, middleware.
package httpx

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Error — ошибка, которую можно показать клиенту. Всё, что не Error, считается внутренней
// ошибкой: клиент увидит только «Внутренняя ошибка сервера», а подробности уйдут в лог.
// Так наружу не утекают тексты ошибок базы, пути к файлам и прочие детали устройства сервера.
type Error struct {
	Status  int
	Code    string
	Message string
	// Fields — ошибки по конкретным полям формы: {"email": "Неверный формат"}.
	Fields map[string]string
}

func (e *Error) Error() string { return fmt.Sprintf("%d %s: %s", e.Status, e.Code, e.Message) }

func newError(status int, code, message string) *Error {
	return &Error{Status: status, Code: code, Message: message}
}

func BadRequest(code, message string) *Error { return newError(http.StatusBadRequest, code, message) }
func Unauthorized(message string) *Error {
	return newError(http.StatusUnauthorized, "unauthorized", message)
}
func Forbidden(message string) *Error { return newError(http.StatusForbidden, "forbidden", message) }

// NotFound используется и тогда, когда запись есть, но принадлежит чужой семье:
// по ответу нельзя понять, существует ли чужой дом или чат.
func NotFound(message string) *Error       { return newError(http.StatusNotFound, "not_found", message) }
func Conflict(code, message string) *Error { return newError(http.StatusConflict, code, message) }
func TooManyRequests() *Error {
	return newError(http.StatusTooManyRequests, "too_many_requests", "Слишком много запросов. Попробуйте чуть позже")
}

func Validation(fields map[string]string) *Error {
	return &Error{Status: http.StatusUnprocessableEntity, Code: "validation", Message: "Проверьте введённые данные", Fields: fields}
}

// statusClientClosed — «клиент закрыл соединение», нестандартный код из nginx.
const statusClientClosed = 499

type errorBody struct {
	Error errorDetail `json:"error"`
}

type errorDetail struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

// Respond отправляет ошибку клиенту в едином формате и прерывает обработку запроса:
//
//	{"error": {"code": "not_found", "message": "Дом не найден"}}
func Respond(c *gin.Context, err error) {
	// Клиент сам оборвал запрос (закрыл вкладку, перешёл на другую страницу) — это не сбой
	// сервера. Отвечать уже некому; код 499 (как в nginx) нужен только для журнала.
	if errors.Is(err, context.Canceled) && c.Request.Context().Err() != nil {
		c.AbortWithStatus(statusClientClosed)
		return
	}
	var appErr *Error
	if !errors.As(err, &appErr) {
		slog.Error("внутренняя ошибка", "err", err, "path", c.FullPath(), "request_id", RequestID(c))
		appErr = newError(http.StatusInternalServerError, "internal", "Внутренняя ошибка сервера")
	}
	c.AbortWithStatusJSON(appErr.Status, errorBody{Error: errorDetail{
		Code:    appErr.Code,
		Message: appErr.Message,
		Fields:  appErr.Fields,
	}})
}
