package config

import (
	"bufio"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// loadSecrets читает файл с секретами (JWT_SECRET, DATABASE_URL...). Он хранится отдельно
// от .env, не попадает в git и может лежать вне папки проекта.
//
// Где ищем:
//  1. по пути из SECRETS_FILE — если переменная задана, файл обязан существовать:
//     иначе опечатка в пути тихо привела бы к временному секрету вместо настоящего;
//  2. иначе secrets.env в текущей папке или на уровень выше (корень репозитория).
//
// Как и везде, переменные, уже заданные в окружении, файл не перезаписывает.
func loadSecrets() error {
	if path := os.Getenv("SECRETS_FILE"); path != "" {
		if _, err := os.Stat(path); err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				return fmt.Errorf("SECRETS_FILE: файл %q не найден", path)
			}
			return fmt.Errorf("SECRETS_FILE: %w", err)
		}
		return loadDotEnv(path)
	}
	for _, path := range []string{"secrets.env", filepath.Join("..", "secrets.env")} {
		if err := loadDotEnv(path); err != nil {
			return err
		}
	}
	return nil
}

// loadDotEnv читает файл вида KEY=VALUE и кладёт значения в окружение процесса.
// Уже заданные переменные не перезаписываются. Пустые строки и строки с # пропускаются.
// Своя маленькая реализация вместо библиотеки: формат простой, а зависимостей меньше.
func loadDotEnv(path string) error {
	file, err := os.Open(path)
	if errors.Is(err, fs.ErrNotExist) {
		return nil // .env необязателен: в Docker переменные задаются окружением
	}
	if err != nil {
		return fmt.Errorf("открыть %s: %w", path, err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for line := 1; scanner.Scan(); line++ {
		raw := scanner.Text()
		if line == 1 {
			raw = strings.TrimPrefix(raw, "\ufeff") // Блокнот и другие редакторы Windows ставят в начало файла BOM
		}
		text := strings.TrimSpace(raw)
		if text == "" || strings.HasPrefix(text, "#") {
			continue
		}
		key, value, ok := strings.Cut(text, "=")
		if !ok {
			return fmt.Errorf("%s:%d: ожидается KEY=VALUE", path, line)
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if _, exists := os.LookupEnv(key); !exists {
			os.Setenv(key, value)
		}
	}
	return scanner.Err()
}
