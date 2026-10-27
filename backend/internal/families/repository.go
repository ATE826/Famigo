package families

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/ATE826/Famigo/backend/internal/models"
)

func memberRole(db *gorm.DB, familyID, userID uuid.UUID) (string, error) {
	var m models.FamilyMember
	err := db.Select("role").Where("family_id = ? AND user_id = ?", familyID, userID).Take(&m).Error
	return m.Role, err
}

// lockRoles читает роли двух участников и блокирует их строки до конца транзакции:
// пока мы проверяем права и меняем роль, никто другой не поменяет их параллельно.
func lockRoles(tx *gorm.DB, familyID, actorID, targetID uuid.UUID) (actorRole, targetRole string, err error) {
	var rows []models.FamilyMember
	err = tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("family_id = ? AND user_id IN ?", familyID, []uuid.UUID{actorID, targetID}).
		Find(&rows).Error
	if err != nil {
		return "", "", err
	}
	for _, m := range rows {
		if m.UserID == actorID {
			actorRole = m.Role
		}
		if m.UserID == targetID {
			targetRole = m.Role
		}
	}
	if actorRole == "" || targetRole == "" {
		return "", "", gorm.ErrRecordNotFound
	}
	return actorRole, targetRole, nil
}

// createFamily создаёт семью, делает создателя владельцем и заводит общий чат.
func createFamily(tx *gorm.DB, name string, ownerID uuid.UUID) (uuid.UUID, error) {
	family := models.Family{Name: name, CreatedBy: &ownerID}
	if err := tx.Create(&family).Error; err != nil {
		return uuid.Nil, err
	}
	if err := tx.Create(&models.Chat{FamilyID: family.ID, Kind: "family"}).Error; err != nil {
		return uuid.Nil, err
	}
	return family.ID, addMember(tx, family.ID, ownerID, RoleOwner)
}

// addMember добавляет участника в семью и в общий семейный чат.
func addMember(tx *gorm.DB, familyID, userID uuid.UUID, role string) error {
	if err := tx.Create(&models.FamilyMember{FamilyID: familyID, UserID: userID, Role: role}).Error; err != nil {
		return err
	}
	var chat models.Chat
	if err := tx.Select("id").Where("family_id = ? AND kind = ?", familyID, "family").Take(&chat).Error; err != nil {
		return err
	}
	// Общий чат закреплён сверху списка по умолчанию (открепить можно в настройках чата).
	return tx.Clauses(clause.OnConflict{DoNothing: true}).
		Create(&models.ChatMember{ChatID: chat.ID, UserID: userID, Pinned: true}).Error
}

// removeMember убирает участника из семьи и из всех её чатов, иначе он продолжил бы
// читать семейную переписку. Если уходит владелец, права передаст триггер в базе.
func removeMember(tx *gorm.DB, familyID, userID uuid.UUID) error {
	familyChats := tx.Model(&models.Chat{}).Select("id").Where("family_id = ?", familyID)
	if err := tx.Where("user_id = ? AND chat_id IN (?)", userID, familyChats).Delete(&models.ChatMember{}).Error; err != nil {
		return err
	}
	res := tx.Where("family_id = ? AND user_id = ?", familyID, userID).Delete(&models.FamilyMember{})
	if res.Error == nil && res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return res.Error
}

// membersCount — сколько людей в каждой из семей.
func membersCount(db *gorm.DB, familyIDs []uuid.UUID) (map[uuid.UUID]int, error) {
	var rows []struct {
		FamilyID uuid.UUID
		Count    int
	}
	err := db.Model(&models.FamilyMember{}).
		Select("family_id, count(*) AS count").
		Where("family_id IN ?", familyIDs).
		Group("family_id").
		Scan(&rows).Error
	counts := make(map[uuid.UUID]int, len(rows))
	for _, r := range rows {
		counts[r.FamilyID] = r.Count
	}
	return counts, err
}

func listFamilies(db *gorm.DB, userID uuid.UUID) ([]Family, error) {
	var memberships []models.FamilyMember
	if err := db.Preload("Family").Where("user_id = ?", userID).Order("joined_at").Find(&memberships).Error; err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, len(memberships))
	for i, m := range memberships {
		ids[i] = m.FamilyID
	}
	counts, err := membersCount(db, ids)
	if err != nil {
		return nil, err
	}
	result := make([]Family, len(memberships))
	for i, m := range memberships {
		result[i] = Family{ID: m.Family.ID, Name: m.Family.Name, Role: m.Role, MembersCount: counts[m.FamilyID], CreatedAt: m.Family.CreatedAt}
	}
	return result, nil
}

func getDetails(db *gorm.DB, familyID, userID uuid.UUID) (Details, error) {
	var me models.FamilyMember
	if err := db.Preload("Family").Where("family_id = ? AND user_id = ?", familyID, userID).Take(&me).Error; err != nil {
		return Details{}, err
	}
	members, err := listMembers(db, familyID)
	if err != nil {
		return Details{}, err
	}
	return Details{
		Family: Family{
			ID: me.Family.ID, Name: me.Family.Name, Role: me.Role,
			MembersCount: len(members), CreatedAt: me.Family.CreatedAt,
		},
		OpeningBalance: me.Family.OpeningBalance,
		Members:        members,
	}, nil
}

// listMembers — участники с данными, которые видит семья. Почту, телефон и хеш пароля
// специально не загружаем (Select): их видит только сам человек в своём профиле.
func listMembers(db *gorm.DB, familyID uuid.UUID) ([]Member, error) {
	var rows []models.FamilyMember
	err := db.
		Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id", "name", "avatar_url", "avatar_tone", "birthday", "food_note")
		}).
		Preload("User.FoodPrefs", func(db *gorm.DB) *gorm.DB { return db.Order("value") }).
		Where("family_id = ?", familyID).
		Order("joined_at, user_id").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	members := make([]Member, len(rows))
	for i, m := range rows {
		prefs := make([]string, len(m.User.FoodPrefs))
		for j, p := range m.User.FoodPrefs {
			prefs[j] = p.Value
		}
		members[i] = Member{
			UserID:     m.UserID,
			Name:       m.User.Name,
			AvatarURL:  m.User.AvatarURL,
			AvatarTone: m.User.AvatarTone,
			Role:       m.Role,
			HomeID:     m.HomeID,
			JoinedAt:   m.JoinedAt,
			Birthday:   models.FormatDate(m.User.Birthday),
			FoodPrefs:  prefs,
			FoodNote:   m.User.FoodNote,
		}
	}
	return members, nil
}

func renameFamily(db *gorm.DB, familyID uuid.UUID, name string) error {
	return db.Model(&models.Family{}).Where("id = ?", familyID).Update("name", name).Error
}

func setRole(db *gorm.DB, familyID, userID uuid.UUID, role string) error {
	return db.Model(&models.FamilyMember{}).
		Where("family_id = ? AND user_id = ?", familyID, userID).
		Update("role", role).Error
}

// setHome — «где живёт участник». Чужой дом отсечёт составной внешний ключ в базе.
func setHome(db *gorm.DB, familyID, userID uuid.UUID, homeID *uuid.UUID) (bool, error) {
	res := db.Model(&models.FamilyMember{}).
		Where("family_id = ? AND user_id = ?", familyID, userID).
		Update("home_id", homeID)
	return res.RowsAffected > 0, res.Error
}

func currentInvite(db *gorm.DB, familyID uuid.UUID) (Invite, error) {
	var inv models.FamilyInvite
	err := db.Where("family_id = ? AND expires_at > now()", familyID).
		Order("expires_at DESC").
		Take(&inv).Error
	return Invite{Code: inv.Code, ExpiresAt: inv.ExpiresAt}, err
}

func insertInvite(db *gorm.DB, familyID, userID uuid.UUID, inv Invite) error {
	if err := db.Where("family_id = ? AND expires_at <= now()", familyID).Delete(&models.FamilyInvite{}).Error; err != nil {
		return err
	}
	return db.Create(&models.FamilyInvite{Code: inv.Code, FamilyID: familyID, CreatedBy: &userID, ExpiresAt: inv.ExpiresAt}).Error
}

func findInvite(db *gorm.DB, code string) (uuid.UUID, time.Time, error) {
	var inv models.FamilyInvite
	err := db.Where("code = ?", code).Take(&inv).Error
	return inv.FamilyID, inv.ExpiresAt, err
}

func userName(db *gorm.DB, userID uuid.UUID) (string, error) {
	var u models.User
	err := db.Select("name").Where("id = ?", userID).Take(&u).Error
	return u.Name, err
}
