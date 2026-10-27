package auth

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/database"
	"github.com/ATE826/Famigo/backend/internal/httpx"
	"github.com/ATE826/Famigo/backend/internal/models"
)

// reuseGrace — сколько секунд после обмена старый refresh-токен ещё принимается.
// Браузер мог не получить ответ с новым токеном (перезагрузили страницу во время запроса)
// или две вкладки обновили сессию одновременно — это не кража.
const reuseGrace = 30 * time.Second

type Service struct {
	db           *gorm.DB
	tokens       *TokenManager
	refreshTTL   time.Duration
	legalVersion string
	// passwordChecks — сколько раз можно проверить текущий пароль (смена пароля, удаление
	// аккаунта). Без лимита злоумышленник с украденным access-токеном подбирал бы пароль,
	// а каждая проверка bcrypt ещё и заметно нагружает процессор.
	passwordChecks *httpx.RateLimiter
}

func NewService(db *gorm.DB, tokens *TokenManager, refreshTTL time.Duration, legalVersion string) *Service {
	return &Service{
		db: db, tokens: tokens, refreshTTL: refreshTTL, legalVersion: legalVersion,
		passwordChecks: httpx.NewRateLimiter(10, 5),
	}
}

// Session — то, что получает клиент после входа.
type Session struct {
	UserID         uuid.UUID
	AccessToken    string
	AccessExpires  time.Time
	RefreshToken   string
	RefreshExpires time.Time
}

// Одна и та же ошибка для «нет такой почты» и «неверный пароль»: по ответу нельзя
// перебором узнать, кто зарегистрирован в сервисе.
var errBadCredentials = httpx.Unauthorized("Неверная почта или пароль")

type RegisterInput struct {
	Name     string
	Email    string
	Password string
	Birthday time.Time
}

// Register создаёт аккаунт, настройки и согласия одной транзакцией и сразу выполняет вход.
func (s *Service) Register(ctx context.Context, in RegisterInput, userAgent string) (Session, error) {
	hash, err := HashPassword(in.Password)
	if err != nil {
		return Session{}, err
	}

	user := models.User{Email: in.Email, PasswordHash: hash, Name: in.Name, Birthday: &in.Birthday, AvatarTone: "green"}
	var session Session
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		err := insertUser(tx, &user)
		if database.IsUniqueViolation(err) {
			return httpx.Conflict("email_taken", "Эта почта уже зарегистрирована")
		}
		if err != nil {
			return err
		}
		if err := insertSettings(tx, user.ID); err != nil {
			return err
		}
		// Галочки на экране регистрации: условия и политика — одна, согласие на данные — вторая.
		if err := insertConsents(tx, user.ID, s.legalVersion, "terms", "privacy", "data"); err != nil {
			return err
		}
		session, err = s.startSession(tx, user.ID, uuid.New(), userAgent)
		return err
	})
	return session, err
}

func (s *Service) Login(ctx context.Context, email, password, userAgent string) (Session, error) {
	db := s.db.WithContext(ctx)
	user, err := findByEmail(db, email)
	if database.IsNotFound(err) {
		equalizeTiming(password)
		return Session{}, errBadCredentials
	}
	if err != nil {
		return Session{}, err
	}
	if !CheckPassword(user.PasswordHash, password) {
		return Session{}, errBadCredentials
	}
	return s.startSession(db, user.ID, uuid.New(), userAgent)
}

// Refresh меняет refresh-токен на новый (ротация) и выдаёт новый access-токен.
// Если пришёл давно обменянный токен, значит его кто-то украл и пользуется копией:
// на всякий случай завершаем все сессии пользователя.
func (s *Service) Refresh(ctx context.Context, refreshToken, userAgent string) (Session, error) {
	invalid := httpx.Unauthorized("Сессия истекла, войдите снова")
	if refreshToken == "" {
		return Session{}, invalid
	}

	var session Session
	var stolen bool
	var stolenUser uuid.UUID
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		row, err := lockRefreshToken(tx, hashToken(refreshToken))
		if database.IsNotFound(err) {
			return invalid
		}
		if err != nil {
			return err
		}
		now := time.Now()
		if row.RevokedAt != nil || now.After(row.ExpiresAt) {
			return invalid
		}
		if row.ReplacedAt != nil && now.Sub(*row.ReplacedAt) > reuseGrace {
			stolen, stolenUser = true, row.UserID
			return invalid
		}
		// Токен обменивается впервые — отмечаем. Повтор в пределах reuseGrace
		// получает ещё одну новую сессию, а время первого обмена не сдвигается.
		if row.ReplacedAt == nil {
			if err := markReplaced(tx, row.ID, now); err != nil {
				return err
			}
		}
		// Сессия та же, меняется только refresh-токен: access-токены этой сессии остаются действительными.
		session, err = s.startSession(tx, row.UserID, row.SessionID, userAgent)
		return err
	})
	if stolen {
		// Отдельно от транзакции выше: её откатила ошибка invalid, а отзыв должен сохраниться.
		if revokeErr := revokeAllRefreshTokens(s.db.WithContext(ctx), stolenUser); revokeErr != nil {
			return Session{}, revokeErr
		}
	}
	return session, err
}

// Logout завершает текущую сессию (ту, чья кука пришла).
func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	if refreshToken == "" {
		return nil
	}
	return revokeSessionByHash(s.db.WithContext(ctx), hashToken(refreshToken))
}

// LogoutAll завершает все сессии пользователя на всех устройствах.
func (s *Service) LogoutAll(ctx context.Context, userID uuid.UUID) error {
	return revokeAllRefreshTokens(s.db.WithContext(ctx), userID)
}

// ChangePassword проверяет текущий пароль, ставит новый и завершает все остальные сессии:
// если пароль меняют из-за взлома, злоумышленника выкинет отовсюду.
func (s *Service) ChangePassword(ctx context.Context, userID uuid.UUID, current, next, userAgent string) (Session, error) {
	if err := s.VerifyPassword(ctx, userID, current); err != nil {
		return Session{}, err
	}
	hash, err := HashPassword(next)
	if err != nil {
		return Session{}, err
	}
	var session Session
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := updatePassword(tx, userID, hash); err != nil {
			return err
		}
		if err := revokeAllRefreshTokens(tx, userID); err != nil {
			return err
		}
		// Все прежние сессии уже завершены выше; текущая получает новую.
		session, err = s.startSession(tx, userID, uuid.New(), userAgent)
		return err
	})
	return session, err
}

// VerifyPassword нужна для опасных действий (смена пароля, удаление аккаунта):
// даже с украденным токеном их не сделать без пароля.
func (s *Service) VerifyPassword(ctx context.Context, userID uuid.UUID, password string) error {
	if !s.passwordChecks.Allow(userID.String()) {
		return httpx.TooManyRequests()
	}
	hash, err := passwordHash(s.db.WithContext(ctx), userID)
	if database.IsNotFound(err) {
		return httpx.Unauthorized("Войдите снова")
	}
	if err != nil {
		return err
	}
	if !CheckPassword(hash, password) {
		return &httpx.Error{Status: http.StatusForbidden, Code: "wrong_password", Message: "Неверный пароль", Fields: map[string]string{"password": "Неверный пароль"}}
	}
	return nil
}

// startSession выдаёт пару токенов в рамках сессии sessionID.
// db — пул или транзакция, в которой идёт вход.
func (s *Service) startSession(db *gorm.DB, userID, sessionID uuid.UUID, userAgent string) (Session, error) {
	if sessionID == uuid.Nil {
		return Session{}, errors.New("пустой номер сессии")
	}
	access, accessExpires, err := s.tokens.Issue(userID, sessionID)
	if err != nil {
		return Session{}, err
	}
	refresh := newRefreshToken()
	refreshExpires := time.Now().Add(s.refreshTTL)
	token := models.RefreshToken{UserID: userID, SessionID: sessionID, TokenHash: hashToken(refresh), UserAgent: truncate(userAgent, 200), ExpiresAt: refreshExpires}
	if err := insertRefreshToken(db, &token); err != nil {
		return Session{}, err
	}
	return Session{
		UserID:         userID,
		AccessToken:    access,
		AccessExpires:  accessExpires,
		RefreshToken:   refresh,
		RefreshExpires: refreshExpires,
	}, nil
}

func truncate(s string, max int) string {
	runes := []rune(s)
	if len(runes) > max {
		return string(runes[:max])
	}
	return s
}
