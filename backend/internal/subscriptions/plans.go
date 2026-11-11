// Пакет subscriptions — тарифы и подписка семьи. Один платит — пользуется вся семья.
package subscriptions

const (
	PlanFree        = "free"
	PlanPremium     = "premium"
	PlanPremiumPlus = "premium_plus"
)

const gb = int64(1024 * 1024 * 1024)

// Plan — лимиты тарифа. Те же числа, что на фронтенде (frontend/src/utils/plans.js).
// Лимиты живут в коде, а не в базе: они одинаковы для всех семей и меняются вместе с релизом.
type Plan struct {
	ID           string `json:"id"`
	MaxHomes     int    `json:"maxHomes"` // 0 — без ограничения
	StorageBytes int64  `json:"storageBytes"`
	Geo          bool   `json:"geo"`
	// Recipes — подбор блюд нейросетью.
	Recipes bool `json:"recipes"`
	// Цены в копейках.
	PriceMonth int64 `json:"priceMonth"`
	PriceYear  int64 `json:"priceYear"`
}

var Plans = map[string]Plan{
	PlanFree:        {ID: PlanFree, MaxHomes: 2, StorageBytes: 2 * gb},
	PlanPremium:     {ID: PlanPremium, MaxHomes: 3, StorageBytes: 10 * gb, Geo: true, PriceMonth: 24900, PriceYear: 249000},
	PlanPremiumPlus: {ID: PlanPremiumPlus, MaxHomes: 0, StorageBytes: 100 * gb, Geo: true, Recipes: true, PriceMonth: 49900, PriceYear: 499000},
}

// AllowsHomes — можно ли иметь столько домов на этом тарифе.
func (p Plan) AllowsHomes(count int) bool { return p.MaxHomes == 0 || count <= p.MaxHomes }
