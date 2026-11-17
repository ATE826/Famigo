package recipes

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"github.com/ATE826/Famigo/backend/internal/auth"
	"github.com/ATE826/Famigo/backend/internal/httpx"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"strings"
	"time"
)

type favoriteRow struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"-"`
	Recipe      string    `json:"-" gorm:"type:jsonb"`
	Fingerprint string    `json:"-"`
	CreatedAt   time.Time `json:"createdAt"`
}

func (favoriteRow) TableName() string { return "recipe_favorites" }
func RegisterFavorites(group *gin.RouterGroup, db *gorm.DB) {
	group.GET("/me/recipes", func(c *gin.Context) {
		var rows []favoriteRow
		if err := db.WithContext(c.Request.Context()).Where("user_id = ?", auth.UserID(c)).Order("created_at DESC").Limit(500).Find(&rows).Error; err != nil {
			httpx.Respond(c, err)
			return
		}
		items := make([]gin.H, 0, len(rows))
		for _, r := range rows {
			items = append(items, gin.H{"id": r.ID, "recipe": json.RawMessage(r.Recipe), "createdAt": r.CreatedAt})
		}
		httpx.OK(c, gin.H{"items": items})
	})
	group.POST("/me/recipes", func(c *gin.Context) {
		var recipe Dish
		if err := httpx.DecodeJSON(c, &recipe); err != nil {
			httpx.Respond(c, err)
			return
		}
		if !validSavedDish(recipe) {
			httpx.Respond(c, httpx.BadRequest("invalid_recipe", "Неверный рецепт"))
			return
		}
		raw, _ := json.Marshal(recipe)
		sum := sha256.Sum256(raw)
		row := favoriteRow{ID: uuid.New(), UserID: auth.UserID(c), Recipe: string(raw), Fingerprint: hex.EncodeToString(sum[:])}
		if err := db.WithContext(c.Request.Context()).Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "user_id"}, {Name: "fingerprint"}}, DoUpdates: clause.AssignmentColumns([]string{"recipe"})}, clause.Returning{}).Create(&row).Error; err != nil {
			httpx.Respond(c, err)
			return
		}
		httpx.OK(c, gin.H{"id": row.ID, "recipe": recipe})
	})
	group.DELETE("/me/recipes/:favoriteID", func(c *gin.Context) {
		id, err := httpx.ParamUUID(c, "favoriteID")
		if err == nil {
			err = db.WithContext(c.Request.Context()).Where("id = ? AND user_id = ?", id, auth.UserID(c)).Delete(&favoriteRow{}).Error
		}
		if err != nil {
			httpx.Respond(c, err)
			return
		}
		httpx.NoContent(c)
	})
}
func validSavedDish(d Dish) bool {
	if strings.TrimSpace(d.Title) == "" || len(d.Title) > 500 || len(d.Ingredients) == 0 || len(d.Ingredients) > 50 || len(d.Steps) == 0 || len(d.Steps) > 50 {
		return false
	}
	raw, _ := json.Marshal(d)
	return len(raw) <= 60000
}
