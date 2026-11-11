package products

import (
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/models"
)

// Продукт принадлежит дому, дом — семье. Перед любым действием сервис проверяет
// homeInFamily, поэтому продукт из холодильника чужой семьи недоступен.

func toProduct(p models.Product) Product {
	return Product{
		ID: p.ID, HomeID: p.HomeID, Name: p.Name, Category: p.Category, Quantity: p.Quantity, Unit: p.Unit,
		ExpiresOn: p.ExpiresOn.Format(models.DateLayout), AddedBy: p.AddedBy, CreatedAt: p.CreatedAt,
	}
}

// homeInFamily — дом из этой семьи. family_id у дома никогда не меняется,
// поэтому после проверки дальше достаточно условия home_id.
func homeInFamily(db *gorm.DB, familyID, homeID uuid.UUID) (bool, error) {
	var count int64
	err := db.Model(&models.Home{}).Where("family_id = ? AND id = ?", familyID, homeID).Count(&count).Error
	return count > 0, err
}

func list(db *gorm.DB, homeID uuid.UUID) ([]Product, error) {
	var rows []models.Product
	if err := db.Where("home_id = ?", homeID).Order("expires_on, name").Find(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]Product, len(rows))
	for i, p := range rows {
		items[i] = toProduct(p)
	}
	return items, nil
}

func insert(db *gorm.DB, homeID, userID uuid.UUID, in productInput) (Product, error) {
	p := models.Product{
		HomeID: homeID, Name: in.Name, Category: in.Category, Quantity: in.Quantity,
		Unit: in.Unit, ExpiresOn: in.ExpiresOn, AddedBy: &userID,
	}
	err := db.Create(&p).Error
	return toProduct(p), err
}

func update(db *gorm.DB, homeID, productID uuid.UUID, in productInput) (Product, error) {
	res := db.Model(&models.Product{}).Where("home_id = ? AND id = ?", homeID, productID).Updates(map[string]any{
		"name": in.Name, "category": in.Category, "quantity": in.Quantity, "unit": in.Unit, "expires_on": in.ExpiresOn,
	})
	if res.Error != nil {
		return Product{}, res.Error
	}
	if res.RowsAffected == 0 {
		return Product{}, gorm.ErrRecordNotFound
	}
	var p models.Product
	err := db.Where("home_id = ? AND id = ?", homeID, productID).Take(&p).Error
	return toProduct(p), err
}

func remove(db *gorm.DB, homeID, productID uuid.UUID) (bool, error) {
	res := db.Where("home_id = ? AND id = ?", homeID, productID).Delete(&models.Product{})
	return res.RowsAffected > 0, res.Error
}
