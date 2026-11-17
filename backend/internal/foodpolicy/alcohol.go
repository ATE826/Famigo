package foodpolicy

import (
	"github.com/ATE826/Famigo/backend/internal/httpx"
	"github.com/ATE826/Famigo/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"regexp"
	"strings"
	"time"
)

var ErrAdultOnly = &httpx.Error{Status: 403, Code: "adult_only", Message: "Алкоголь доступен только пользователям от 18 лет"}
var location = time.FixedZone("MSK", 3*60*60)

func Adult(birthday *time.Time, now time.Time) bool {
	if birthday == nil {
		return false
	}
	now = now.In(location)
	y, m, d := now.Date()
	by, bm, bd := birthday.Date()
	age := y - by
	if m < bm || (m == bm && d < bd) {
		age--
	}
	return age >= 18
}
func CanUse(db *gorm.DB, userID uuid.UUID) (bool, error) {
	var user models.User
	if err := db.Select("id", "birthday").Where("id = ?", userID).Take(&user).Error; err != nil {
		return false, err
	}
	return Adult(user.Birthday, time.Now()), nil
}

var words = regexp.MustCompile(`[\p{L}\p{N}]+`)

func ContainsAlcohol(text string) bool {
	for _, term := range []string{"葡萄酒", "啤酒", "伏特加", "威士忌", "白兰地", "朗姆酒", "清酒", "日本酒", "ビール", "ウォッカ", "ウイスキー", "ラム酒", "ジン", "テキーラ"} {
		if strings.Contains(text, term) {
			return true
		}
	}
	for _, word := range words.FindAllString(strings.ToLower(strings.ReplaceAll(text, "ё", "е")), -1) {
		switch word {
		case "wine", "wines", "beer", "beers", "vodka", "rum", "gin", "brandy", "cognac", "tequila", "whisky", "whiskey", "bourbon", "vermouth", "liqueur", "champagne", "prosecco", "ethanol", "alcohol", "wein", "bier", "likör", "alkohol", "vino", "cerveza", "ron", "ginebra", "вино", "вина", "вине", "вином", "вину", "ром", "рома", "ромом", "джин", "джина", "джином", "сидр", "сидра", "сидром", "саке", "бренди", "херес", "портвейн", "кагор", "мартини", "абсент":
			return true
		}
		for _, prefix := range []string{"водк", "пивн", "пиво", "пива", "коньяк", "виск", "ликер", "шампанск", "текил", "вермут", "бурбон", "спирт", "алкогол", "винн"} {
			if strings.HasPrefix(word, prefix) {
				return true
			}
		}
	}
	return false
}
