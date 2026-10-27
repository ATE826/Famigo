package products

import (
	"math"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/ATE826/Famigo/backend/internal/auth"
	"github.com/ATE826/Famigo/backend/internal/families"
	"github.com/ATE826/Famigo/backend/internal/httpx"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler { return &Handler{service: service} }

func (h *Handler) RegisterRoutes(family *gin.RouterGroup) {
	family.GET("/homes/:homeID/products", h.list)
	family.POST("/homes/:homeID/products", h.add)
	family.PUT("/homes/:homeID/products/:productID", h.update)
	family.DELETE("/homes/:homeID/products/:productID", h.delete)
}

type productRequest struct {
	Name      string  `json:"name"`
	Category  string  `json:"category"`
	Quantity  float64 `json:"quantity"`
	Unit      string  `json:"unit"`
	ExpiresOn string  `json:"expiresOn"`
}

func (r productRequest) validate() (productInput, error) {
	v := httpx.NewValidator()
	in := productInput{
		Name:      v.Text("name", r.Name, 1, 20),
		Category:  r.Category,
		Unit:      r.Unit,
		ExpiresOn: v.Date("expiresOn", r.ExpiresOn),
		// Округляем до тысячных — столько знаков хранит NUMERIC(10, 3).
		Quantity: math.Round(r.Quantity*1000) / 1000,
	}
	v.OneOf("category", r.Category, categories...)
	v.OneOf("unit", r.Unit, units...)
	v.Check(in.Quantity > 0 && in.Quantity < 1_000_000, "quantity", "Количество должно быть больше нуля")
	return in, v.Err()
}

func ids(c *gin.Context, names ...string) ([]uuid.UUID, error) {
	result := make([]uuid.UUID, len(names))
	for i, name := range names {
		id, err := httpx.ParamUUID(c, name)
		if err != nil {
			return nil, err
		}
		result[i] = id
	}
	return result, nil
}

func (h *Handler) list(c *gin.Context) {
	id, err := ids(c, "homeID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	items, err := h.service.List(c.Request.Context(), families.FamilyID(c), id[0])
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, gin.H{"items": items})
}

func (h *Handler) add(c *gin.Context) {
	id, err := ids(c, "homeID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	var req productRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	in, err := req.validate()
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	product, err := h.service.Add(c.Request.Context(), families.FamilyID(c), id[0], auth.UserID(c), in)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.Created(c, product)
}

func (h *Handler) update(c *gin.Context) {
	id, err := ids(c, "homeID", "productID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	var req productRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	in, err := req.validate()
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	product, err := h.service.Update(c.Request.Context(), families.FamilyID(c), id[0], id[1], in)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, product)
}

func (h *Handler) delete(c *gin.Context) {
	id, err := ids(c, "homeID", "productID")
	if err == nil {
		err = h.service.Delete(c.Request.Context(), families.FamilyID(c), id[0], id[1])
	}
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.NoContent(c)
}
