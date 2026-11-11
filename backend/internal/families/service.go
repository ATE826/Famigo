package families

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/ATE826/Famigo/backend/internal/database"
	"github.com/ATE826/Famigo/backend/internal/httpx"
	"github.com/ATE826/Famigo/backend/internal/notifications"
)

type Service struct {
	db     *gorm.DB
	notify *notifications.Service
}

func NewService(db *gorm.DB, notify *notifications.Service) *Service {
	return &Service{db: db, notify: notify}
}

var errMemberNotFound = httpx.NotFound("Участник не найден")

// Правила ролей — те же, что на фронтенде (frontend/src/utils/permissions.js).
// Фронтенд их только показывает, а соблюдает сервер: запрос можно отправить в обход интерфейса.

// canRemove: себя удалить нельзя (для этого есть «покинуть семью»),
// владелец удаляет кого угодно, администратор — только обычных участников.
func canRemove(actorRole, targetRole string, self bool) bool {
	if self {
		return false
	}
	switch actorRole {
	case RoleOwner:
		return true
	case RoleAdmin:
		return targetRole == RoleMember
	}
	return false
}

// canChangeRole: менять роль можно только тем, кто ниже тебя, и только на admin/member.
// Сделать кого-то владельцем можно только передачей прав (TransferOwnership).
func canChangeRole(actorRole, targetRole, newRole string, self bool) bool {
	if self || (newRole != RoleAdmin && newRole != RoleMember) {
		return false
	}
	return roleRank[actorRole] >= roleRank[RoleAdmin] && roleRank[actorRole] > roleRank[targetRole]
}

func (s *Service) Create(ctx context.Context, userID uuid.UUID, name string) (Details, error) {
	db := s.db.WithContext(ctx)
	var familyID uuid.UUID
	err := db.Transaction(func(tx *gorm.DB) error {
		var err error
		familyID, err = createFamily(tx, name, userID)
		return err
	})
	if err != nil {
		return Details{}, err
	}
	return getDetails(db, familyID, userID)
}

func (s *Service) List(ctx context.Context, userID uuid.UUID) ([]Family, error) {
	return listFamilies(s.db.WithContext(ctx), userID)
}

func (s *Service) Details(ctx context.Context, familyID, userID uuid.UUID) (Details, error) {
	return getDetails(s.db.WithContext(ctx), familyID, userID)
}

func (s *Service) Rename(ctx context.Context, familyID uuid.UUID, role, name string) error {
	if err := RequireManager(role); err != nil {
		return err
	}
	return renameFamily(s.db.WithContext(ctx), familyID, name)
}

// Invite возвращает действующий код приглашения или создаёт новый на 12 часов.
// Код видят все участники: пригласить родственника может любой (как на фронтенде).
func (s *Service) Invite(ctx context.Context, familyID, userID uuid.UUID) (Invite, error) {
	db := s.db.WithContext(ctx)
	inv, err := currentInvite(db, familyID)
	if err == nil {
		return inv, nil
	}
	if !database.IsNotFound(err) {
		return Invite{}, err
	}
	// Код случайный, но совпадение с чужим кодом теоретически возможно — тогда пробуем ещё раз.
	for range 5 {
		inv = Invite{Code: newInviteCode(), ExpiresAt: time.Now().Add(inviteTTL)}
		err = insertInvite(db, familyID, userID, inv)
		if !database.IsUniqueViolation(err) {
			break
		}
	}
	return inv, err
}

// Join — вступить в семью по коду. Ошибка одна для «нет кода» и «код истёк»,
// чтобы перебором нельзя было найти коды, которые когда-то существовали.
func (s *Service) Join(ctx context.Context, userID uuid.UUID, rawCode string) (Details, error) {
	invalid := httpx.BadRequest("invalid_invite", "Код не найден или устарел")
	code, ok := normalizeInviteCode(rawCode)
	if !ok {
		return Details{}, invalid
	}
	db := s.db.WithContext(ctx)
	familyID, expires, err := findInvite(db, code)
	if database.IsNotFound(err) || (err == nil && time.Now().After(expires)) {
		return Details{}, invalid
	}
	if err != nil {
		return Details{}, err
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		err := addMember(tx, familyID, userID, RoleMember)
		if database.IsUniqueViolation(err) {
			return httpx.Conflict("already_member", "Вы уже в этой семье")
		}
		if err != nil {
			return err
		}
		name, err := userName(tx, userID)
		if err != nil {
			return err
		}
		return s.notify.NotifyFamily(tx, familyID, []uuid.UUID{userID}, notifications.Notification{
			Type:  notifications.TypeFamily,
			Title: "Новый участник семьи",
			Body:  name + " теперь в семье",
			Link:  "/more/family",
		})
	})
	if err != nil {
		return Details{}, err
	}
	return getDetails(db, familyID, userID)
}

func (s *Service) ChangeRole(ctx context.Context, familyID, actorID, targetID uuid.UUID, newRole string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		actorRole, targetRole, err := lockRoles(tx, familyID, actorID, targetID)
		if database.IsNotFound(err) {
			return errMemberNotFound
		}
		if err != nil {
			return err
		}
		if !canChangeRole(actorRole, targetRole, newRole, actorID == targetID) {
			return httpx.Forbidden("Недостаточно прав, чтобы поменять эту роль")
		}
		return setRole(tx, familyID, targetID, newRole)
	})
}

func (s *Service) RemoveMember(ctx context.Context, familyID, actorID, targetID uuid.UUID) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		actorRole, targetRole, err := lockRoles(tx, familyID, actorID, targetID)
		if database.IsNotFound(err) {
			return errMemberNotFound
		}
		if err != nil {
			return err
		}
		if !canRemove(actorRole, targetRole, actorID == targetID) {
			return httpx.Forbidden("Недостаточно прав, чтобы удалить этого участника")
		}
		return removeMember(tx, familyID, targetID)
	})
}

// Leave — выйти из семьи самому. Если уходит владелец, права перейдут
// администратору (триггер pass_family_ownership в базе).
func (s *Service) Leave(ctx context.Context, familyID, userID uuid.UUID) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		err := removeMember(tx, familyID, userID)
		if database.IsNotFound(err) {
			return errMemberNotFound
		}
		return err
	})
}

// TransferOwnership — владелец передаёт права другому участнику и сам становится админом.
// Порядок важен: сначала понижаем себя, потом повышаем другого, иначе на мгновение
// владельцев станет двое и уникальный индекс в базе отклонит запрос.
func (s *Service) TransferOwnership(ctx context.Context, familyID, actorID, targetID uuid.UUID) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		actorRole, _, err := lockRoles(tx, familyID, actorID, targetID)
		if database.IsNotFound(err) {
			return errMemberNotFound
		}
		if err != nil {
			return err
		}
		if actorRole != RoleOwner || actorID == targetID {
			return httpx.Forbidden("Передать права может только владелец")
		}
		if err := setRole(tx, familyID, actorID, RoleAdmin); err != nil {
			return err
		}
		return setRole(tx, familyID, targetID, RoleOwner)
	})
}

// SetHome — поселить участника в дом (или выселить: homeID = nil). Как на фронтенде,
// жильцами управляют владелец и администраторы.
func (s *Service) SetHome(ctx context.Context, familyID uuid.UUID, role string, targetID uuid.UUID, homeID *uuid.UUID) error {
	if err := RequireManager(role); err != nil {
		return err
	}
	ok, err := setHome(s.db.WithContext(ctx), familyID, targetID, homeID)
	if database.IsForeignKeyViolation(err) {
		return httpx.NotFound("Дом не найден")
	}
	if err == nil && !ok {
		return errMemberNotFound
	}
	return err
}
