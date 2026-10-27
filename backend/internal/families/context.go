package families

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/auth"
	"github.com/ATE826/Famigo/backend/internal/database"
	"github.com/ATE826/Famigo/backend/internal/httpx"
)

const (
	familyIDKey = "family_id"
	roleKey     = "family_role"
)

// RequireMember стоит перед всеми адресами вида /api/families/:familyID/...
// Он пускает дальше, только если вошедший пользователь состоит в этой семье,
// и запоминает его роль. Если не состоит — 404 (а не 403): чужой человек не узнает
// даже того, что такая семья существует.
//
// Дальше каждый запрос к базе фильтруется по family_id из этой проверки,
// поэтому подставить в адрес id чужого дома или чата бесполезно (защита от IDOR).
func RequireMember(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		familyID, err := httpx.ParamUUID(c, "familyID")
		if err != nil {
			httpx.Respond(c, err)
			return
		}
		role, err := memberRole(db.WithContext(c.Request.Context()), familyID, auth.UserID(c))
		if database.IsNotFound(err) {
			httpx.Respond(c, httpx.NotFound("Семья не найдена"))
			return
		}
		if err != nil {
			httpx.Respond(c, err)
			return
		}
		c.Set(familyIDKey, familyID)
		c.Set(roleKey, role)
		c.Next()
	}
}

// FamilyID — id семьи, членство в которой уже проверено.
func FamilyID(c *gin.Context) uuid.UUID {
	id, _ := c.Get(familyIDKey)
	familyID, _ := id.(uuid.UUID)
	return familyID
}

// Role — роль вошедшего пользователя в этой семье.
func Role(c *gin.Context) string { return c.GetString(roleKey) }

// CanManage — владелец и администраторы могут управлять домами, подпиской и участниками.
func CanManage(role string) bool { return role == RoleOwner || role == RoleAdmin }

// RequireManager — ошибка, если у пользователя нет прав управления.
func RequireManager(role string) error {
	if !CanManage(role) {
		return httpx.Forbidden("Это могут сделать только владелец и администраторы")
	}
	return nil
}
