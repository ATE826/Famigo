package homes

import (
	"context"
	"fmt"
	"net/http"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/database"
	"github.com/ATE826/Famigo/backend/internal/families"
	"github.com/ATE826/Famigo/backend/internal/httpx"
	"github.com/ATE826/Famigo/backend/internal/subscriptions"
)

type Service struct {
	db   *gorm.DB
	subs *subscriptions.Service
}

func NewService(db *gorm.DB, subs *subscriptions.Service) *Service {
	return &Service{db: db, subs: subs}
}

var (
	errHomeNotFound = httpx.NotFound("Дом не найден")
	errTaskNotFound = httpx.NotFound("Задача не найдена")
)

func (s *Service) List(ctx context.Context, familyID uuid.UUID) ([]Home, error) {
	return listHomes(s.db.WithContext(ctx), familyID)
}

func (s *Service) Get(ctx context.Context, familyID, homeID uuid.UUID) (HomeDetails, error) {
	db := s.db.WithContext(ctx)
	home, err := getHome(db, familyID, homeID)
	if database.IsNotFound(err) {
		return HomeDetails{}, errHomeNotFound
	}
	if err != nil {
		return HomeDetails{}, err
	}
	tasks, err := listTasks(db, homeID)
	return HomeDetails{Home: home, Tasks: tasks}, err
}

// Create добавляет дом, если позволяют права и тариф. Проверка лимита и вставка
// идут в одной транзакции с блокировкой семьи — иначе два быстрых запроса подряд
// обошли бы лимит.
func (s *Service) Create(ctx context.Context, familyID uuid.UUID, role string, in homeInput) (HomeDetails, error) {
	if err := families.RequireManager(role); err != nil {
		return HomeDetails{}, err
	}
	var homeID uuid.UUID
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockFamily(tx, familyID); err != nil {
			return err
		}
		sub, err := s.subs.Current(tx, familyID)
		if err != nil {
			return err
		}
		count, err := countHomes(tx, familyID)
		if err != nil {
			return err
		}
		if !sub.Plan.AllowsHomes(count + 1) {
			return &httpx.Error{
				Status:  http.StatusForbidden,
				Code:    "plan_limit",
				Message: fmt.Sprintf("На вашем тарифе можно до %d домов", sub.Plan.MaxHomes),
			}
		}
		homeID, err = insertHome(tx, familyID, in)
		return err
	})
	if err != nil {
		return HomeDetails{}, err
	}
	return s.Get(ctx, familyID, homeID)
}

// Update — менять данные дома может любой участник (как на фронтенде).
func (s *Service) Update(ctx context.Context, familyID, homeID uuid.UUID, in homeInput) (HomeDetails, error) {
	ok, err := updateHome(s.db.WithContext(ctx), familyID, homeID, in)
	if err != nil {
		return HomeDetails{}, err
	}
	if !ok {
		return HomeDetails{}, errHomeNotFound
	}
	return s.Get(ctx, familyID, homeID)
}

// Delete — только владелец и админы, и последний дом удалить нельзя (как на фронтенде).
func (s *Service) Delete(ctx context.Context, familyID uuid.UUID, role string, homeID uuid.UUID) error {
	if err := families.RequireManager(role); err != nil {
		return err
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockFamily(tx, familyID); err != nil {
			return err
		}
		// Сначала — «а дом вообще из этой семьи?». Иначе по ответу «нельзя удалить
		// единственный дом» можно было бы делать выводы о чужих данных.
		if ok, err := homeInFamily(tx, familyID, homeID); err != nil {
			return err
		} else if !ok {
			return errHomeNotFound
		}
		count, err := countHomes(tx, familyID)
		if err != nil {
			return err
		}
		if count <= 1 {
			return httpx.Conflict("last_home", "Нельзя удалить единственный дом")
		}
		ok, err := deleteHome(tx, familyID, homeID)
		if err == nil && !ok {
			return errHomeNotFound
		}
		return err
	})
}

// requireHome — 404, если дом не из этой семьи. Стоит перед каждым действием с делами.
func (s *Service) requireHome(db *gorm.DB, familyID, homeID uuid.UUID) error {
	ok, err := homeInFamily(db, familyID, homeID)
	if err != nil {
		return err
	}
	if !ok {
		return errHomeNotFound
	}
	return nil
}

func (s *Service) AddTask(ctx context.Context, familyID, homeID, userID uuid.UUID, text string, description *string) (Task, error) {
	db := s.db.WithContext(ctx)
	if err := s.requireHome(db, familyID, homeID); err != nil {
		return Task{}, err
	}
	task, err := insertTask(db, homeID, userID, text, description)
	if database.IsForeignKeyViolation(err) {
		return Task{}, errHomeNotFound // дом удалили, пока шёл запрос
	}
	return task, err
}

func (s *Service) UpdateTask(ctx context.Context, familyID, homeID, taskID uuid.UUID, p taskPatch) (Task, error) {
	db := s.db.WithContext(ctx)
	if err := s.requireHome(db, familyID, homeID); err != nil {
		return Task{}, err
	}
	task, err := updateTask(db, homeID, taskID, p)
	if database.IsNotFound(err) {
		return Task{}, errTaskNotFound
	}
	return task, err
}

func (s *Service) DeleteTask(ctx context.Context, familyID, homeID, taskID uuid.UUID) error {
	db := s.db.WithContext(ctx)
	if err := s.requireHome(db, familyID, homeID); err != nil {
		return err
	}
	ok, err := deleteTask(db, homeID, taskID)
	if err == nil && !ok {
		return errTaskNotFound
	}
	return err
}
