// Пакет products — продукты в холодильнике дома.
package products

import (
	"time"

	"github.com/google/uuid"
)

var (
	categories = []string{"dairy", "vegetables", "meat", "drinks", "other"}
	units      = []string{"pcs", "ml", "l", "g", "kg"}
)

type Product struct {
	ID        uuid.UUID  `json:"id"`
	HomeID    uuid.UUID  `json:"homeId"`
	Name      string     `json:"name"`
	Category  string     `json:"category"`
	Quantity  float64    `json:"quantity"`
	Unit      string     `json:"unit"`
	ExpiresOn string     `json:"expiresOn"`
	AddedBy   *uuid.UUID `json:"addedBy"`
	CreatedAt time.Time  `json:"createdAt"`
}

type productInput struct {
	Name      string
	Category  string
	Quantity  float64
	Unit      string
	ExpiresOn time.Time
}
