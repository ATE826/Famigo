package database

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"path"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

// Файлы миграций вшиваются в программу при сборке, поэтому серверу не нужна папка рядом.
//
//go:embed migrations/*.sql
var migrationFiles embed.FS

// Любое число: по нему PostgreSQL выдаёт блокировку, чтобы два запущенных сервера
// не начали применять миграции одновременно.
const migrationLockID = 812_026

// schemaMigration — служебная таблица: какие миграции уже применены.
// Её создаёт AutoMigrate из GORM: для такой простой таблицы его хватает.
// Таблицы приложения описаны SQL-миграциями — почему, см. пакет models.
type schemaMigration struct {
	Version   string    `gorm:"primaryKey"`
	AppliedAt time.Time `gorm:"not null;default:now()"`
}

func (schemaMigration) TableName() string { return "schema_migrations" }

// Migrate применяет новые SQL-миграции по порядку имён файлов (0001_..., 0002_...).
// Применённые версии записываются в schema_migrations, поэтому каждая выполняется один раз.
// Каждая миграция — в своей транзакции: если в файле ошибка, база останется как была.
// Пустые файлы (заготовки будущих разделов) пропускаются и не отмечаются применёнными,
// чтобы их содержимое выполнилось, когда его напишут.
func Migrate(ctx context.Context, db *gorm.DB, log *slog.Logger) error {
	names, err := migrationNames(migrationFiles)
	if err != nil {
		return err
	}

	// Блокировка PostgreSQL принадлежит соединению, поэтому всё делаем в одном соединении.
	return db.WithContext(ctx).Connection(func(conn *gorm.DB) error {
		if err := conn.Exec("SELECT pg_advisory_lock(?)", migrationLockID).Error; err != nil {
			return fmt.Errorf("взять блокировку миграций: %w", err)
		}
		defer conn.WithContext(context.Background()).Exec("SELECT pg_advisory_unlock(?)", migrationLockID)

		if err := conn.AutoMigrate(&schemaMigration{}); err != nil {
			return fmt.Errorf("создать schema_migrations: %w", err)
		}
		var versions []string
		if err := conn.Model(&schemaMigration{}).Pluck("version", &versions).Error; err != nil {
			return err
		}
		applied := make(map[string]bool, len(versions))
		for _, v := range versions {
			applied[v] = true
		}

		for _, name := range names {
			version := strings.TrimSuffix(name, ".sql")
			if applied[version] {
				continue
			}
			sql, err := migrationFiles.ReadFile(path.Join("migrations", name))
			if err != nil {
				return err
			}
			if strings.TrimSpace(string(sql)) == "" {
				continue
			}
			err = conn.Transaction(func(tx *gorm.DB) error {
				// Exec без параметров: файл миграции — это наш собственный SQL из репозитория,
				// пользовательских данных в нём нет.
				if err := tx.Exec(string(sql)).Error; err != nil {
					return err
				}
				return tx.Create(&schemaMigration{Version: version}).Error
			})
			if err != nil {
				return fmt.Errorf("миграция %s: %w", name, err)
			}
			log.Info("миграция применена", "version", version)
		}
		return nil
	})
}

func migrationNames(files fs.FS) ([]string, error) {
	entries, err := fs.ReadDir(files, "migrations")
	if err != nil {
		return nil, err
	}
	var names []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			names = append(names, entry.Name())
		}
	}
	sort.Strings(names)
	return names, nil
}
