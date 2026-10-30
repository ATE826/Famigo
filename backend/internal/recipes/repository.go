package recipes

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/models"
)

// maxFridgeItems — столько продуктов (с самым близким сроком) уходит нейросети.
// Больше не нужно: длинный список только замедляет ответ локальной модели.
const maxFridgeItems = 60

// homeInFamily — дом из этой семьи (как в products: чужой дом — 404).
func homeInFamily(db *gorm.DB, familyID, homeID uuid.UUID) (bool, error) {
	var count int64
	err := db.Model(&models.Home{}).Where("family_id = ? AND id = ?", familyID, homeID).Count(&count).Error
	return count > 0, err
}

// fridge — продукты дома, которые ещё можно есть: количество больше нуля и срок не вышел.
func fridge(db *gorm.DB, homeID uuid.UUID, today time.Time) ([]fridgeItem, error) {
	var rows []models.Product
	err := db.Where("home_id = ? AND quantity > 0 AND expires_on >= ?", homeID, today.Format(models.DateLayout)).
		Order("expires_on, name").
		Limit(maxFridgeItems).
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	items := make([]fridgeItem, len(rows))
	for i, p := range rows {
		items[i] = fridgeItem{
			Name: p.Name, Quantity: p.Quantity, Unit: p.Unit,
			DaysLeft: int(p.ExpiresOn.Sub(today).Hours() / 24),
		}
	}
	return items, nil
}

// eaters — пищевые ограничения тех, кто будет есть. memberIDs пусто — вся семья.
// ok=false — кто-то из memberIDs не состоит в семье.
func eaters(db *gorm.DB, familyID uuid.UUID, memberIDs []uuid.UUID) (list []eater, ok bool, err error) {
	query := db.
		Preload("User", func(db *gorm.DB) *gorm.DB { return db.Select("id", "food_note") }).
		Preload("User.FoodPrefs").
		Where("family_id = ?", familyID)
	if len(memberIDs) > 0 {
		query = query.Where("user_id IN ?", memberIDs)
	}
	var rows []models.FamilyMember
	if err := query.Find(&rows).Error; err != nil {
		return nil, false, err
	}
	if len(memberIDs) > 0 && len(rows) != len(memberIDs) {
		return nil, false, nil
	}
	list = make([]eater, len(rows))
	for i, m := range rows {
		prefs := make([]string, len(m.User.FoodPrefs))
		for j, p := range m.User.FoodPrefs {
			prefs[j] = p.Value
		}
		list[i] = eater{Prefs: prefs}
		if m.User.FoodNote != nil {
			list[i].Note = *m.User.FoodNote
		}
	}
	return list, true, nil
}
