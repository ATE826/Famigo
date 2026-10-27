// Пакет database отвечает за подключение к PostgreSQL через GORM, ошибки базы и миграции.
//
// Защита от SQL-инъекций во всём проекте держится на одном правиле:
// значения от пользователя никогда не вклеиваются в текст SQL, а передаются
// отдельно как параметры «?» (db.Where("email = ?", email)). GORM отправляет
// PostgreSQL текст запроса и данные раздельно, поэтому строка вида
// "'; DROP TABLE users; --" останется просто строкой.
//
// Опасные места GORM, которых в проекте нет и быть не должно:
//   - db.Where(userInput) или db.Order(userInput) — строка от пользователя станет частью SQL;
//   - db.First(&user, userInput) со строкой — GORM подставит её как условие целиком;
//   - db.Raw(fmt.Sprintf(...)) — склейка SQL из строк.
package database

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Connect открывает пул соединений и сразу проверяет, что база отвечает.
func Connect(ctx context.Context, url string, log *slog.Logger) (*gorm.DB, error) {
	// pgxpool.ParseConfig здесь только разбирает строку подключения: он понимает
	// и обычные параметры, и настройки пула (pool_max_conns и т.п.).
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, errors.New("не удалось разобрать DATABASE_URL")
	}
	// Ограничиваем время любого запроса: зависший запрос не должен держать соединение вечно.
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "10000"

	sqlDB := stdlib.OpenDB(*cfg.ConnConfig)
	sqlDB.SetMaxOpenConns(int(cfg.MaxConns))
	sqlDB.SetMaxIdleConns(int(cfg.MaxConns))
	sqlDB.SetConnMaxLifetime(cfg.MaxConnLifetime)
	sqlDB.SetConnMaxIdleTime(cfg.MaxConnIdleTime)

	db, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{
		Logger: newLogger(log),
		// Одиночные INSERT/UPDATE не нужно оборачивать в транзакцию: где действий несколько,
		// мы открываем транзакцию сами (db.Transaction).
		SkipDefaultTransaction: true,
		// Подключение проверяем сами, с таймаутом.
		DisableAutomaticPing: true,
		NowFunc:              func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("открыть GORM: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := sqlDB.PingContext(pingCtx); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("подключиться к PostgreSQL: %w", err)
	}
	return db, nil
}

// Close закрывает все соединения с базой.
func Close(db *gorm.DB) {
	if sqlDB, err := db.DB(); err == nil {
		sqlDB.Close()
	}
}

// newLogger — журнал GORM: пишет медленные запросы и ошибки.
// ParameterizedQueries: в журнал попадает текст запроса без значений, поэтому
// почта, хеши паролей и сообщения чата не окажутся в логах.
func newLogger(log *slog.Logger) logger.Interface {
	return quietCanceled{logger.New(slogWriter{log}, logger.Config{
		SlowThreshold:             500 * time.Millisecond,
		LogLevel:                  logger.Warn,
		IgnoreRecordNotFoundError: true,
		ParameterizedQueries:      true,
		Colorful:                  false,
	})}
}

// quietCanceled не пишет в журнал запросы, оборванные клиентом (context canceled):
// человек просто ушёл со страницы, это не ошибка базы.
type quietCanceled struct{ logger.Interface }

func (q quietCanceled) LogMode(level logger.LogLevel) logger.Interface {
	return quietCanceled{q.Interface.LogMode(level)}
}

func (q quietCanceled) Trace(ctx context.Context, begin time.Time, fc func() (string, int64), err error) {
	if errors.Is(err, context.Canceled) {
		return
	}
	q.Interface.Trace(ctx, begin, fc, err)
}

type slogWriter struct{ log *slog.Logger }

func (w slogWriter) Printf(format string, args ...any) {
	w.log.Warn("gorm", "msg", fmt.Sprintf(format, args...))
}

// Коды ошибок PostgreSQL, которые мы превращаем в понятные ответы.
const (
	codeUniqueViolation     = "23505"
	codeForeignKeyViolation = "23503"
	codeCheckViolation      = "23514"
)

func hasCode(err error, code string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == code
}

// IsUniqueViolation — нарушена уникальность (например, такая почта уже есть).
func IsUniqueViolation(err error) bool { return hasCode(err, codeUniqueViolation) }

// IsForeignKeyViolation — ссылка на несуществующую запись (например, чужой дом).
func IsForeignKeyViolation(err error) bool { return hasCode(err, codeForeignKeyViolation) }

// IsCheckViolation — данные не прошли проверку CHECK в таблице.
func IsCheckViolation(err error) bool { return hasCode(err, codeCheckViolation) }

// IsNotFound — Take/First не нашли ни одной строки.
func IsNotFound(err error) bool { return errors.Is(err, gorm.ErrRecordNotFound) }
