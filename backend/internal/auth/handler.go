package auth

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/ATE826/Famigo/backend/internal/httpx"
)

const refreshCookie = "famigo_refresh"

// Кука видна только запросам к /api/auth: остальной API её даже не получает.
const refreshCookiePath = "/api/auth"

type CookieOptions struct {
	Secure   bool
	SameSite http.SameSite
}

type Handler struct {
	service *Service
	cookies CookieOptions
	// Ограничение попыток входа на одну почту: защита от подбора пароля
	// с множества разных IP (лимит по IP такую атаку не остановит).
	loginByEmail *httpx.RateLimiter
	// registerByIP — регистрации с одного адреса. Ответ «почта уже занята» нужен человеку,
	// но им можно пользоваться для перебора чужих почт; строгий лимит делает перебор долгим.
	registerByIP *httpx.RateLimiter
}

func NewHandler(service *Service, cookies CookieOptions, registerByIP *httpx.RateLimiter) *Handler {
	return &Handler{service: service, cookies: cookies, loginByEmail: httpx.NewRateLimiter(10, 5), registerByIP: registerByIP}
}

// RegisterRoutes подключает маршруты. public — без входа, cookie — авторизуются кукой
// (защищены от CSRF), authed — только для вошедших.
func (h *Handler) RegisterRoutes(public, cookie, authed *gin.RouterGroup) {
	public.POST("/auth/register", h.registerByIP.ByIP("register:"), h.register)
	public.POST("/auth/login", h.login)
	cookie.POST("/auth/refresh", h.refresh)
	cookie.POST("/auth/logout", h.logout)
	authed.POST("/auth/logout-all", h.logoutAll)
	authed.PUT("/me/password", h.changePassword)
}

type sessionResponse struct {
	UserID      string    `json:"userId"`
	AccessToken string    `json:"accessToken"`
	ExpiresAt   time.Time `json:"expiresAt"`
}

func (h *Handler) respondSession(c *gin.Context, status int, s Session) {
	h.setRefreshCookie(c, s.RefreshToken, int(time.Until(s.RefreshExpires).Seconds()))
	c.JSON(status, sessionResponse{UserID: s.UserID.String(), AccessToken: s.AccessToken, ExpiresAt: s.AccessExpires})
}

// httpOnly — кука недоступна JavaScript (XSS её не украдёт).
// Secure — только по HTTPS. SameSite=Strict — браузер не пошлёт её с чужого сайта (CSRF).
func (h *Handler) setRefreshCookie(c *gin.Context, value string, maxAge int) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     refreshCookie,
		Value:    value,
		Path:     refreshCookiePath,
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   h.cookies.Secure,
		SameSite: h.cookies.SameSite,
	})
}

func (h *Handler) clearRefreshCookie(c *gin.Context) { h.setRefreshCookie(c, "", -1) }

type registerRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Birthday string `json:"birthday"`
	// Две галочки на экране регистрации. Без них аккаунт не создаётся (152-ФЗ).
	AcceptTerms bool `json:"acceptTerms"`
	AcceptData  bool `json:"acceptData"`
}

func (h *Handler) register(c *gin.Context) {
	var req registerRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	v := httpx.NewValidator()
	in := RegisterInput{
		Name:     v.Text("name", req.Name, 1, 30),
		Email:    v.Email("email", req.Email),
		Birthday: v.Birthday("birthday", req.Birthday),
		Password: req.Password,
	}
	v.Password("password", req.Password)
	v.Check(req.AcceptTerms, "acceptTerms", "Нужно принять условия")
	v.Check(req.AcceptData, "acceptData", "Нужно согласие на обработку данных")
	if err := v.Err(); err != nil {
		httpx.Respond(c, err)
		return
	}

	session, err := h.service.Register(c.Request.Context(), in, c.Request.UserAgent())
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	h.respondSession(c, http.StatusCreated, session)
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) login(c *gin.Context) {
	var req loginRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	v := httpx.NewValidator()
	email := v.Email("email", req.Email)
	v.Check(req.Password != "" && len(req.Password) <= 72, "password", "Введите пароль")
	if err := v.Err(); err != nil {
		httpx.Respond(c, err)
		return
	}
	if !h.loginByEmail.Allow(email) {
		httpx.Respond(c, httpx.TooManyRequests())
		return
	}

	session, err := h.service.Login(c.Request.Context(), email, req.Password, c.Request.UserAgent())
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	h.respondSession(c, http.StatusOK, session)
}

func (h *Handler) refresh(c *gin.Context) {
	token, _ := c.Cookie(refreshCookie)
	session, err := h.service.Refresh(c.Request.Context(), token, c.Request.UserAgent())
	if err != nil {
		// Куку стираем, только если сессия недействительна (401). При сбое базы или
		// оборванном запросе токен ещё рабочий — стерев его, мы выкинули бы человека из аккаунта.
		var appErr *httpx.Error
		if errors.As(err, &appErr) && appErr.Status == http.StatusUnauthorized {
			h.clearRefreshCookie(c)
		}
		httpx.Respond(c, err)
		return
	}
	h.respondSession(c, http.StatusOK, session)
}

func (h *Handler) logout(c *gin.Context) {
	token, _ := c.Cookie(refreshCookie)
	if err := h.service.Logout(c.Request.Context(), token); err != nil {
		httpx.Respond(c, err)
		return
	}
	h.clearRefreshCookie(c)
	httpx.NoContent(c)
}

func (h *Handler) logoutAll(c *gin.Context) {
	if err := h.service.LogoutAll(c.Request.Context(), UserID(c)); err != nil {
		httpx.Respond(c, err)
		return
	}
	h.clearRefreshCookie(c)
	httpx.NoContent(c)
}

type changePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

func (h *Handler) changePassword(c *gin.Context) {
	var req changePasswordRequest
	if err := httpx.DecodeJSON(c, &req); err != nil {
		httpx.Respond(c, err)
		return
	}
	v := httpx.NewValidator()
	v.Check(req.CurrentPassword != "" && len(req.CurrentPassword) <= 72, "currentPassword", "Введите текущий пароль")
	v.Password("newPassword", req.NewPassword)
	v.Check(req.NewPassword != req.CurrentPassword, "newPassword", "Новый пароль совпадает с текущим")
	if err := v.Err(); err != nil {
		httpx.Respond(c, err)
		return
	}

	session, err := h.service.ChangePassword(c.Request.Context(), UserID(c), req.CurrentPassword, req.NewPassword, c.Request.UserAgent())
	if err != nil {
		httpx.Respond(c, err)
		return
	}
	h.respondSession(c, http.StatusOK, session)
}
