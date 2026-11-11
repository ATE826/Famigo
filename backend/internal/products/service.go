package products

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/database"
	"github.com/ATE826/Famigo/backend/internal/httpx"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

var (
	errHomeNotFound    = httpx.NotFound("Дом не найден")
	errProductNotFound = httpx.NotFound("Продукт не найден")
)

// requireHome: если дом не из этой семьи — 404. По ответу нельзя понять,
// что дом с таким id вообще существует.
func requireHome(db *gorm.DB, familyID, homeID uuid.UUID) error {
	ok, err := homeInFamily(db, familyID, homeID)
	if err != nil {
		return err
	}
	if !ok {
		return errHomeNotFound
	}
	return nil
}

func (s *Service) List(ctx context.Context, familyID, homeID uuid.UUID) ([]Product, error) {
	db := s.db.WithContext(ctx)
	if err := requireHome(db, familyID, homeID); err != nil {
		return nil, err
	}
	return list(db, homeID)
}

func (s *Service) Add(ctx context.Context, familyID, homeID, userID uuid.UUID, in productInput) (Product, error) {
	db := s.db.WithContext(ctx)
	if err := requireHome(db, familyID, homeID); err != nil {
		return Product{}, err
	}
	p, err := insert(db, homeID, userID, in)
	if database.IsForeignKeyViolation(err) {
		return Product{}, errHomeNotFound // дом удалили, пока шёл запрос
	}
	return p, err
}

func (s *Service) Update(ctx context.Context, familyID, homeID, productID uuid.UUID, in productInput) (Product, error) {
	db := s.db.WithContext(ctx)
	if err := requireHome(db, familyID, homeID); err != nil {
		return Product{}, err
	}
	p, err := update(db, homeID, productID, in)
	if database.IsNotFound(err) {
		return Product{}, errProductNotFound
	}
	return p, err
}

func (s *Service) Delete(ctx context.Context, familyID, homeID, productID uuid.UUID) error {
	db := s.db.WithContext(ctx)
	if err := requireHome(db, familyID, homeID); err != nil {
		return err
	}
	ok, err := remove(db, homeID, productID)
	if err == nil && !ok {
		return errProductNotFound
	}
	return err
}
