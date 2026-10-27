package users

import (
	"context"
	"io"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/auth"
	"github.com/ATE826/Famigo/backend/internal/database"
	"github.com/ATE826/Famigo/backend/internal/httpx"
)

type Service struct {
	db           *gorm.DB
	auth         *auth.Service
	avatars      *avatarStore
	legalVersion string
}

func NewService(db *gorm.DB, authService *auth.Service, uploadDir, legalVersion string) (*Service, error) {
	avatars, err := newAvatarStore(uploadDir)
	if err != nil {
		return nil, err
	}
	return &Service{db: db, auth: authService, avatars: avatars, legalVersion: legalVersion}, nil
}

var errUserNotFound = httpx.Unauthorized("Войдите снова")

func (s *Service) Get(ctx context.Context, userID uuid.UUID) (Profile, error) {
	p, err := getProfile(s.db.WithContext(ctx), userID)
	if database.IsNotFound(err) {
		return Profile{}, errUserNotFound
	}
	return p, err
}

func (s *Service) Update(ctx context.Context, userID uuid.UUID, patch profilePatch) (Profile, error) {
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return updateProfile(tx, userID, patch)
	})
	if database.IsNotFound(err) {
		return Profile{}, errUserNotFound
	}
	if err != nil {
		return Profile{}, err
	}
	return s.Get(ctx, userID)
}

// UpdateFood сохраняет предпочтения в еде. Это данные, которые могут говорить о здоровье
// и убеждениях, поэтому по 152-ФЗ нужно отдельное согласие: без него не сохраняем.
// Если человек всё стёр — согласие отзывается.
func (s *Service) UpdateFood(ctx context.Context, userID uuid.UUID, prefs []string, note *string, consent bool) (Profile, error) {
	hasData := len(prefs) > 0 || note != nil
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if hasData {
			active, err := hasActiveConsent(tx, userID, "food")
			if err != nil {
				return err
			}
			if !active && !consent {
				return httpx.Validation(map[string]string{"consent": "Подтвердите согласие, чтобы сохранить"})
			}
			if !active {
				if err := giveConsent(tx, userID, "food", s.legalVersion); err != nil {
					return err
				}
			}
		} else if err := revokeConsent(tx, userID, "food"); err != nil {
			return err
		}
		return replaceFoodPrefs(tx, userID, prefs, note)
	})
	if err != nil {
		return Profile{}, err
	}
	return s.Get(ctx, userID)
}

func (s *Service) UpdateSettings(ctx context.Context, userID uuid.UUID, settings Settings) (Profile, error) {
	if err := upsertSettings(s.db.WithContext(ctx), userID, settings); err != nil {
		return Profile{}, err
	}
	return s.Get(ctx, userID)
}

// UploadAvatar проверяет и перекодирует картинку, сохраняет файл и удаляет прежний.
func (s *Service) UploadAvatar(ctx context.Context, userID uuid.UUID, file io.Reader) (Profile, error) {
	data, err := processAvatar(file)
	if err != nil {
		return Profile{}, err
	}
	url, err := s.avatars.save(data)
	if err != nil {
		return Profile{}, err
	}
	old, err := s.setAvatar(ctx, userID, &url)
	if err != nil {
		s.avatars.remove(&url) // в базу не записали — файл не нужен
		if database.IsNotFound(err) {
			return Profile{}, errUserNotFound
		}
		return Profile{}, err
	}
	s.avatars.remove(old)
	return s.Get(ctx, userID)
}

func (s *Service) setAvatar(ctx context.Context, userID uuid.UUID, url *string) (*string, error) {
	var old *string
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var err error
		old, err = swapAvatar(tx, userID, url)
		return err
	})
	return old, err
}

func (s *Service) DeleteAvatar(ctx context.Context, userID uuid.UUID) (Profile, error) {
	old, err := s.setAvatar(ctx, userID, nil)
	if database.IsNotFound(err) {
		return Profile{}, errUserNotFound
	}
	if err != nil {
		return Profile{}, err
	}
	s.avatars.remove(old)
	return s.Get(ctx, userID)
}

// AvatarPath — путь к файлу аватара для отдачи клиенту.
func (s *Service) AvatarPath(name string) (string, bool) { return s.avatars.path(name) }

// DeleteAccount требует пароль: с украденным токеном аккаунт не удалить.
func (s *Service) DeleteAccount(ctx context.Context, userID uuid.UUID, password string) error {
	if err := s.auth.VerifyPassword(ctx, userID, password); err != nil {
		return err
	}
	db := s.db.WithContext(ctx)
	avatar, err := avatarURL(db, userID)
	if err != nil && !database.IsNotFound(err) {
		return err
	}
	if err := deleteUser(db, userID); err != nil {
		return err
	}
	s.avatars.remove(avatar)
	return nil
}
