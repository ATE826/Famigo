package httpx

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// OK отправляет 200 с данными. gin кодирует JSON с экранированием <, > и &,
// поэтому текст пользователя не превратится в HTML, даже если ответ откроют в браузере.
func OK(c *gin.Context, value any) { c.JSON(http.StatusOK, value) }

// Created отправляет 201 — «создано».
func Created(c *gin.Context, value any) { c.JSON(http.StatusCreated, value) }

// NoContent отправляет 204 — «готово, тела ответа нет».
func NoContent(c *gin.Context) { c.Status(http.StatusNoContent) }
