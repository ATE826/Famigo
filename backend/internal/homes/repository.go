package homes

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/ATE826/Famigo/backend/internal/models"
)

// В каждом запросе к домам есть условие family_id = ?: дом другой семьи
// не найдётся, даже если подставить его настоящий id в адрес.

// homesQuery — дома семьи вместе с жильцами (Preload) и числом невыполненных дел
// (подзапрос в Select попадает в поле OpenTasks).
func homesQuery(db *gorm.DB, familyID uuid.UUID) *gorm.DB {
	return db.Model(&models.Home{}).
		Select("homes.*, (SELECT count(*) FROM home_tasks t WHERE t.home_id = homes.id AND t.done_at IS NULL) AS open_tasks").
		Preload("Residents", func(db *gorm.DB) *gorm.DB { return db.Order("joined_at") }).
		Where("homes.family_id = ?", familyID)
}

func toHome(h models.Home) Home {
	residents := make([]uuid.UUID, len(h.Residents))
	for i, r := range h.Residents {
		residents[i] = r.UserID
	}
	return Home{
		ID: h.ID, Name: h.Name, Kind: h.Kind, Place: h.Place, Rooms: h.Rooms, PeopleCount: h.PeopleCount,
		Residents: residents, OpenTasks: h.OpenTasks, CreatedAt: h.CreatedAt,
	}
}

func listHomes(db *gorm.DB, familyID uuid.UUID) ([]Home, error) {
	var rows []models.Home
	if err := homesQuery(db, familyID).Order("homes.created_at").Find(&rows).Error; err != nil {
		return nil, err
	}
	homes := make([]Home, len(rows))
	for i, h := range rows {
		homes[i] = toHome(h)
	}
	return homes, nil
}

func getHome(db *gorm.DB, familyID, homeID uuid.UUID) (Home, error) {
	var h models.Home
	if err := homesQuery(db, familyID).Where("homes.id = ?", homeID).Take(&h).Error; err != nil {
		return Home{}, err
	}
	return toHome(h), nil
}

// homeInFamily — дом принадлежит этой семье. Дом не может переехать в другую семью
// (family_id никогда не меняется), поэтому после этой проверки дальше достаточно home_id.
func homeInFamily(db *gorm.DB, familyID, homeID uuid.UUID) (bool, error) {
	var count int64
	err := db.Model(&models.Home{}).Where("family_id = ? AND id = ?", familyID, homeID).Count(&count).Error
	return count > 0, err
}

// lockFamily блокирует строку семьи до конца транзакции. Два одновременных запроса
// «добавить дом» выполнятся по очереди, и оба не проскочат лимит тарифа.
func lockFamily(tx *gorm.DB, familyID uuid.UUID) error {
	var f models.Family
	return tx.Clauses(clause.Locking{Strength: "UPDATE"}).Select("id").Where("id = ?", familyID).Take(&f).Error
}

func countHomes(db *gorm.DB, familyID uuid.UUID) (int, error) {
	var n int64
	err := db.Model(&models.Home{}).Where("family_id = ?", familyID).Count(&n).Error
	return int(n), err
}

func insertHome(db *gorm.DB, familyID uuid.UUID, in homeInput) (uuid.UUID, error) {
	h := models.Home{FamilyID: familyID, Name: in.Name, Kind: in.Kind, Place: in.Place, Rooms: in.Rooms, PeopleCount: in.PeopleCount}
	err := db.Create(&h).Error
	return h.ID, err
}

func updateHome(db *gorm.DB, familyID, homeID uuid.UUID, in homeInput) (bool, error) {
	res := db.Model(&models.Home{}).Where("family_id = ? AND id = ?", familyID, homeID).Updates(map[string]any{
		"name": in.Name, "kind": in.Kind, "place": in.Place, "rooms": in.Rooms, "people_count": in.PeopleCount,
	})
	return res.RowsAffected > 0, res.Error
}

func deleteHome(db *gorm.DB, familyID, homeID uuid.UUID) (bool, error) {
	res := db.Where("family_id = ? AND id = ?", familyID, homeID).Delete(&models.Home{})
	return res.RowsAffected > 0, res.Error
}

// --- Дела по дому. Перед любым действием сервис проверяет homeInFamily. ---

func toTask(t models.HomeTask) Task {
	return Task{
		ID: t.ID, Text: t.Text, Description: t.Description, Done: t.DoneAt != nil, DoneAt: t.DoneAt,
		CreatedBy: t.CreatedBy, CreatedAt: t.CreatedAt,
	}
}

func listTasks(db *gorm.DB, homeID uuid.UUID) ([]Task, error) {
	var rows []models.HomeTask
	// Сначала невыполненные, внутри — по времени создания.
	if err := db.Where("home_id = ?", homeID).Order("done_at IS NOT NULL, created_at").Find(&rows).Error; err != nil {
		return nil, err
	}
	tasks := make([]Task, len(rows))
	for i, t := range rows {
		tasks[i] = toTask(t)
	}
	return tasks, nil
}

func insertTask(db *gorm.DB, homeID, userID uuid.UUID, text string, description *string) (Task, error) {
	t := models.HomeTask{HomeID: homeID, Text: text, Description: description, CreatedBy: &userID}
	err := db.Create(&t).Error
	return toTask(t), err
}

type taskPatch struct {
	Text        *string
	Description *string
	ClearDesc   bool
	Done        *bool
}

// updateTask меняет только присланные поля и возвращает задачу после изменения.
func updateTask(db *gorm.DB, homeID, taskID uuid.UUID, p taskPatch) (Task, error) {
	updates := map[string]any{}
	if p.Text != nil {
		updates["text"] = *p.Text
	}
	if p.ClearDesc {
		updates["description"] = nil
	} else if p.Description != nil {
		updates["description"] = *p.Description
	}
	if p.Done != nil {
		if *p.Done {
			// Повторное «выполнено» не сдвигает время выполнения.
			updates["done_at"] = gorm.Expr("COALESCE(done_at, now())")
		} else {
			updates["done_at"] = nil
		}
	}
	if len(updates) > 0 {
		res := db.Model(&models.HomeTask{}).Where("home_id = ? AND id = ?", homeID, taskID).Updates(updates)
		if res.Error != nil {
			return Task{}, res.Error
		}
		if res.RowsAffected == 0 {
			return Task{}, gorm.ErrRecordNotFound
		}
	}
	var t models.HomeTask
	err := db.Where("home_id = ? AND id = ?", homeID, taskID).Take(&t).Error
	return toTask(t), err
}

func deleteTask(db *gorm.DB, homeID, taskID uuid.UUID) (bool, error) {
	res := db.Where("home_id = ? AND id = ?", homeID, taskID).Delete(&models.HomeTask{})
	return res.RowsAffected > 0, res.Error
}
