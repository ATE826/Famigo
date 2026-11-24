package subscriptions

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/families"
	"github.com/ATE826/Famigo/backend/internal/httpx"
)

// AccessibleHomeIDs returns the oldest homes within the family's effective plan.
// IDs break timestamp ties consistently; no records are deleted on downgrade.
func (s *Service) AccessibleHomeIDs(db *gorm.DB, familyID uuid.UUID) ([]uuid.UUID, error) {
	sub, err := s.Current(db, familyID)
	if err != nil {
		return nil, err
	}
	query := db.Table("homes").Where("family_id = ?", familyID).Order("created_at, id")
	if sub.Plan.MaxHomes > 0 {
		query = query.Limit(sub.Plan.MaxHomes)
	}
	var ids []uuid.UUID
	err = query.Pluck("id", &ids).Error
	return ids, err
}

// RequireHomeAccess protects every home endpoint, including products and AI.
func (s *Service) RequireHomeAccess() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Param("homeID") == "" {
			c.Next()
			return
		}
		homeID, err := httpx.ParamUUID(c, "homeID")
		if err != nil {
			httpx.Respond(c, err)
			c.Abort()
			return
		}
		db := s.db.WithContext(c.Request.Context())
		familyID := families.FamilyID(c)
		var count int64
		if err = db.Table("homes").Where("family_id=? AND id=?", familyID, homeID).Count(&count).Error; err == nil && count == 0 {
			err = httpx.NotFound("Дом не найден")
		}
		if err == nil {
			var ids []uuid.UUID
			ids, err = s.AccessibleHomeIDs(db, familyID)
			if err == nil {
				allowed := false
				for _, id := range ids {
					if id == homeID {
						allowed = true
						break
					}
				}
				if !allowed {
					err = &httpx.Error{Status: http.StatusForbidden, Code: "home_plan_locked", Message: "Дом недоступен на текущем тарифе. Данные сохранены"}
				}
			}
		}
		if err != nil {
			httpx.Respond(c, err)
			c.Abort()
			return
		}
		c.Next()
	}
}
