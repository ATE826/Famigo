package users

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/ATE826/Famigo/backend/internal/models"
)

// Каждый запрос здесь — по user_id из проверенного токена: свой профиль, и только свой.

func getProfile(db *gorm.DB, userID uuid.UUID) (Profile, error) {
	var u models.User
	err := db.
		Preload("FoodPrefs", func(db *gorm.DB) *gorm.DB { return db.Order("value") }).
		Preload("Settings").
		Where("id = ?", userID).
		Take(&u).Error
	if err != nil {
		return Profile{}, err
	}
	return toProfile(u), nil
}

func toProfile(u models.User) Profile {
	settings := models.DefaultSettings(u.ID)
	if u.Settings != nil {
		settings = *u.Settings
	}
	prefs := make([]string, len(u.FoodPrefs))
	for i, p := range u.FoodPrefs {
		prefs[i] = p.Value
	}
	return Profile{
		ID:            u.ID,
		Email:         u.Email,
		EmailVerified: u.EmailVerifiedAt != nil,
		Name:          u.Name,
		Birthday:      models.FormatDate(u.Birthday),
		Phone:         u.Phone,
		PhoneVerified: u.PhoneVerifiedAt != nil,
		AvatarURL:     u.AvatarURL,
		AvatarTone:    u.AvatarTone,
		FoodPrefs:     prefs,
		FoodNote:      u.FoodNote,
		Settings: Settings{
			NotifyBudget:   settings.NotifyBudget,
			NotifyCalendar: settings.NotifyCalendar,
			NotifyFridge:   settings.NotifyFridge,
			NotifyChat:     settings.NotifyChat,
			NotifyFamily:   settings.NotifyFamily,
			Language:       settings.Language,
		},
		CreatedAt: u.CreatedAt,
	}
}

// updateProfile меняет только присланные поля. Обновление через map, а не через структуру:
// GORM пропускает нулевые поля структуры, и стереть телефон (записать NULL) было бы нельзя.
func updateProfile(tx *gorm.DB, userID uuid.UUID, p profilePatch) error {
	var current models.User
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Select("phone").Where("id = ?", userID).Take(&current).Error; err != nil {
		return err
	}

	updates := map[string]any{}
	if p.Name != nil {
		updates["name"] = *p.Name
	}
	if p.ClearBirthday {
		updates["birthday"] = nil
	} else if p.Birthday != nil {
		updates["birthday"] = *p.Birthday
	}
	switch {
	case p.ClearPhone:
		updates["phone"] = nil
		updates["phone_verified_at"] = nil
	case p.Phone != nil && (current.Phone == nil || *current.Phone != *p.Phone):
		// Новый номер ещё не подтверждён: сбрасываем отметку подтверждения.
		updates["phone"] = *p.Phone
		updates["phone_verified_at"] = nil
	}
	if p.AvatarTone != nil {
		updates["avatar_tone"] = *p.AvatarTone
	}
	if len(updates) == 0 {
		return nil
	}
	return tx.Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error
}

func replaceFoodPrefs(tx *gorm.DB, userID uuid.UUID, prefs []string, note *string) error {
	if err := tx.Where("user_id = ?", userID).Delete(&models.UserFoodPref{}).Error; err != nil {
		return err
	}
	if len(prefs) > 0 {
		rows := make([]models.UserFoodPref, len(prefs))
		for i, value := range prefs {
			rows[i] = models.UserFoodPref{UserID: userID, Value: value}
		}
		if err := tx.Create(&rows).Error; err != nil {
			return err
		}
	}
	return tx.Model(&models.User{}).Where("id = ?", userID).Update("food_note", note).Error
}

func hasActiveConsent(db *gorm.DB, userID uuid.UUID, document string) (bool, error) {
	var count int64
	err := db.Model(&models.Consent{}).
		Where("user_id = ? AND document = ? AND revoked_at IS NULL", userID, document).
		Count(&count).Error
	return count > 0, err
}

func giveConsent(db *gorm.DB, userID uuid.UUID, document, version string) error {
	return db.Create(&models.Consent{UserID: userID, Document: document, Version: version}).Error
}

func revokeConsent(db *gorm.DB, userID uuid.UUID, document string) error {
	return db.Model(&models.Consent{}).
		Where("user_id = ? AND document = ? AND revoked_at IS NULL", userID, document).
		Update("revoked_at", gorm.Expr("now()")).Error
}

// upsertSettings — INSERT ... ON CONFLICT (user_id) DO UPDATE: строки настроек может ещё не быть.
func upsertSettings(db *gorm.DB, userID uuid.UUID, s Settings) error {
	row := models.UserSettings{
		UserID:         userID,
		NotifyBudget:   s.NotifyBudget,
		NotifyCalendar: s.NotifyCalendar,
		NotifyFridge:   s.NotifyFridge,
		NotifyChat:     s.NotifyChat,
		NotifyFamily:   s.NotifyFamily,
		Language:       s.Language,
	}
	return db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}},
		UpdateAll: true,
	}).Create(&row).Error
}

// swapAvatar ставит новый адрес аватара и возвращает старый, чтобы удалить старый файл.
// Строка блокируется (FOR UPDATE): две одновременные загрузки не потеряют чужой файл.
func swapAvatar(tx *gorm.DB, userID uuid.UUID, url *string) (*string, error) {
	var u models.User
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Select("avatar_url").Where("id = ?", userID).Take(&u).Error; err != nil {
		return nil, err
	}
	err := tx.Model(&models.User{}).Where("id = ?", userID).Update("avatar_url", url).Error
	return u.AvatarURL, err
}

func avatarURL(db *gorm.DB, userID uuid.UUID) (*string, error) {
	var u models.User
	err := db.Select("avatar_url").Where("id = ?", userID).Take(&u).Error
	return u.AvatarURL, err
}

// deleteUser удаляет аккаунт. Остальное убирает сама база: ON DELETE CASCADE
// удалит сессии, согласия, членство в семьях; триггер передаст права владельца.
func deleteUser(db *gorm.DB, userID uuid.UUID) error {
	return db.Where("id = ?", userID).Delete(&models.User{}).Error
}
