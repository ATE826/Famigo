package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// DecodeJSON читает тело запроса в dst строго:
//   - только Content-Type: application/json;
//   - неизвестные поля — ошибка. Это защита от mass assignment: клиент не сможет
//     прислать {"role": "owner"} и тихо поменять то, что менять нельзя;
//   - ровно один JSON-объект, без «хвоста» после него;
//   - размер ограничен middleware BodyLimit.
func DecodeJSON(c *gin.Context, dst any) error {
	mediaType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return &Error{Status: http.StatusUnsupportedMediaType, Code: "unsupported_media_type", Message: "Ожидается JSON"}
	}

	dec := json.NewDecoder(c.Request.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			return &Error{Status: http.StatusRequestEntityTooLarge, Code: "too_large", Message: "Слишком большой запрос"}
		}
		return BadRequest("invalid_json", "Неверный формат запроса")
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return BadRequest("invalid_json", "Неверный формат запроса")
	}
	return nil
}

// ParamUUID достаёт UUID из пути (/homes/:homeID). Неверный UUID — это 404, а не 500:
// такого адреса просто нет. Заодно в SQL никогда не попадёт «мусор» вместо id.
func ParamUUID(c *gin.Context, name string) (uuid.UUID, error) {
	id, err := uuid.Parse(c.Param(name))
	if err != nil {
		return uuid.Nil, NotFound("Не найдено")
	}
	return id, nil
}

// QueryDate читает дату вида 2026-10-27 из строки запроса.
func QueryDate(c *gin.Context, name string) (time.Time, bool, error) {
	value := c.Query(name)
	if value == "" {
		return time.Time{}, false, nil
	}
	date, err := time.Parse(time.DateOnly, value)
	if err != nil {
		return time.Time{}, false, BadRequest("invalid_query", "Неверная дата: "+name)
	}
	return date, true, nil
}

// QueryLimit читает размер страницы и не даёт запросить больше max.
// Без ограничения можно одним запросом вытащить всю таблицу и нагрузить базу.
func QueryLimit(c *gin.Context, fallback, max int) int {
	limit, err := strconv.Atoi(c.Query("limit"))
	if err != nil || limit <= 0 {
		return fallback
	}
	return min(limit, max)
}
