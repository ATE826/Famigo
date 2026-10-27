package homes

import (
	"github.com/gin-gonic/gin"

	"github.com/ATE826/Famigo/backend/internal/auth"
	"github.com/ATE826/Famigo/backend/internal/families"
	"github.com/ATE826/Famigo/backend/internal/httpx"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler { return &Handler{service: service} }

func (h *Handler) RegisterRoutes(family *gin.RouterGroup) {
	family.GET("/homes", h.list)
	family.POST("/homes", h.create)
	family.GET("/homes/:homeID", h.get)
	family.PUT("/homes/:homeID", h.update)
	family.DELETE("/homes/:homeID", h.delete)

	family.POST("/homes/:homeID/tasks", h.addTask)
	family.PATCH("/homes/:homeID/tasks/:taskID", h.updateTask)
	family.DELETE("/homes/:homeID/tasks/:taskID", h.deleteTask)
}

type homeRequest struct {
	Name        string  `json:"name"`
	Kind        string  `json:"kind"`
	Place       *string `json:"place"`
	Rooms       int     `json:"rooms"`
	PeopleCount int     `json:"peopleCount"`
}

func (r homeRequest) validate() (homeInput, error) {
	v := httpx.NewValidator()
	in := homeInput{
		Name:        v.Text("name", r.Name, 1, 20),
		Kind:        r.Kind,
		Place:       v.OptionalText("place", r.Place, 80, false),
		Rooms:       r.Rooms,
		PeopleCount: r.PeopleCount,
	}
	v.OneOf("kind", r.Kind, kinds...)
	v.Check(r.Rooms >= 1 && r.Rooms <= 99, "rooms", "От 1 до 99")
	v.Check(r.PeopleCount >= 0 && r.PeopleCount <= 30, "peopleCount", "От 0 до 30")
	return in, v.Err()
}

func (h *Handler) list(c *gin.Context) {
	items, err := h.service.List(c.Request.Context(), families.FamilyID(c))
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, gin.H{"items": items})
}

func (h *Handler) get(c *gin.Context) {
	homeID, err := httpx.ParamUUID(c, "homeID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	home, err := h.service.Get(c.Request.Context(), families.FamilyID(c), homeID)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, home)
}

func (h *Handler) create(c *gin.Context) {
	var req homeRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	in, err := req.validate()
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	home, err := h.service.Create(c.Request.Context(), families.FamilyID(c), families.Role(c), in)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.Created(c, home)
}

func (h *Handler) update(c *gin.Context) {
	homeID, err := httpx.ParamUUID(c, "homeID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	var req homeRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	in, err := req.validate()
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	home, err := h.service.Update(c.Request.Context(), families.FamilyID(c), homeID, in)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, home)
}

func (h *Handler) delete(c *gin.Context) {
	homeID, err := httpx.ParamUUID(c, "homeID")
	if err == nil {
		err = h.service.Delete(c.Request.Context(), families.FamilyID(c), families.Role(c), homeID)
	}
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.NoContent(c)
}

type taskRequest struct {
	Text        string  `json:"text"`
	Description *string `json:"description"`
}

func (h *Handler) addTask(c *gin.Context) {
	homeID, err := httpx.ParamUUID(c, "homeID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	var req taskRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	v := httpx.NewValidator()
	text := v.Text("text", req.Text, 1, 60)
	description := v.OptionalText("description", req.Description, 300, true)
	if err := v.Err(); err != nil {
		httpx.Respond(c, err)
		return
	}
	task, err := h.service.AddTask(c.Request.Context(), families.FamilyID(c), homeID, auth.UserID(c), text, description)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.Created(c, task)
}

// taskPatchRequest — меняются только присланные поля: {"done": true} отмечает задачу выполненной.
type taskPatchRequest struct {
	Text        *string `json:"text"`
	Description *string `json:"description"`
	Done        *bool   `json:"done"`
}

func (h *Handler) updateTask(c *gin.Context) {
	homeID, err := httpx.ParamUUID(c, "homeID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	taskID, err := httpx.ParamUUID(c, "taskID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	var req taskPatchRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	v := httpx.NewValidator()
	patch := taskPatch{Done: req.Done}
	if req.Text != nil {
		text := v.Text("text", *req.Text, 1, 60)
		patch.Text = &text
	}
	if req.Description != nil {
		patch.Description = v.OptionalText("description", req.Description, 300, true)
		patch.ClearDesc = patch.Description == nil
	}
	if err := v.Err(); err != nil {
		httpx.Respond(c, err)
		return
	}
	task, err := h.service.UpdateTask(c.Request.Context(), families.FamilyID(c), homeID, taskID, patch)
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.OK(c, task)
}

func (h *Handler) deleteTask(c *gin.Context) {
	homeID, err := httpx.ParamUUID(c, "homeID")
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	taskID, err := httpx.ParamUUID(c, "taskID")
	if err == nil {
		err = h.service.DeleteTask(c.Request.Context(), families.FamilyID(c), homeID, taskID)
	}
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	httpx.NoContent(c)
}
