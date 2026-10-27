package config

import (
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadDotEnv(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	content := "# комментарий\n\nFAMIGO_TEST_A=one\nFAMIGO_TEST_B = \"two words\"\nFAMIGO_TEST_KEEP=from-file\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("FAMIGO_TEST_KEEP", "from-env")
	t.Cleanup(func() {
		os.Unsetenv("FAMIGO_TEST_A")
		os.Unsetenv("FAMIGO_TEST_B")
	})

	if err := loadDotEnv(path); err != nil {
		t.Fatal(err)
	}

	cases := map[string]string{
		"FAMIGO_TEST_A":    "one",
		"FAMIGO_TEST_B":    "two words",
		"FAMIGO_TEST_KEEP": "from-env", // окружение важнее файла
	}
	for key, want := range cases {
		if got := os.Getenv(key); got != want {
			t.Errorf("%s = %q, want %q", key, got, want)
		}
	}
}

func TestLoadDotEnvMissingFile(t *testing.T) {
	if err := loadDotEnv(filepath.Join(t.TempDir(), "nope.env")); err != nil {
		t.Fatalf("отсутствующий .env не должен быть ошибкой: %v", err)
	}
}

func TestProductionRequiresStrongSecret(t *testing.T) {
	t.Chdir(t.TempDir()) // чтобы не подхватить настоящий .env
	t.Setenv("APP_ENV", "production")
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("JWT_SECRET", "short")

	if _, err := Load(slog.New(slog.NewTextHandler(io.Discard, nil))); err == nil {
		t.Fatal("в production короткий JWT_SECRET должен быть ошибкой")
	}
}

func TestDevelopmentGeneratesSecret(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("APP_ENV", "development")
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("JWT_SECRET", "")

	cfg, err := Load(slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	if len(cfg.JWTSecret) < minSecretLength {
		t.Fatalf("сгенерированный секрет слишком короткий: %d", len(cfg.JWTSecret))
	}
}

func TestSameSiteNoneNeedsSecure(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("COOKIE_SAMESITE", "none")
	t.Setenv("COOKIE_SECURE", "false")

	if _, err := Load(slog.New(slog.NewTextHandler(io.Discard, nil))); err == nil {
		t.Fatal("SameSite=None без Secure браузеры отвергают, должна быть ошибка")
	}
}

func TestSplitList(t *testing.T) {
	got := splitList(" http://a.ru , ,http://b.ru")
	if len(got) != 2 || got[0] != "http://a.ru" || got[1] != "http://b.ru" {
		t.Fatalf("splitList = %v", got)
	}
}

func TestLoadSecretsFromFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "my-secrets.env")
	if err := os.WriteFile(path, []byte("FAMIGO_TEST_SECRET=hidden\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("SECRETS_FILE", path)
	t.Cleanup(func() { os.Unsetenv("FAMIGO_TEST_SECRET") })

	if err := loadSecrets(); err != nil {
		t.Fatal(err)
	}
	if got := os.Getenv("FAMIGO_TEST_SECRET"); got != "hidden" {
		t.Fatalf("секрет из SECRETS_FILE не прочитан: %q", got)
	}
}

func TestLoadSecretsMissingExplicitFileIsError(t *testing.T) {
	t.Setenv("SECRETS_FILE", filepath.Join(t.TempDir(), "nope.env"))
	if err := loadSecrets(); err == nil {
		t.Fatal("указанный в SECRETS_FILE файл обязан существовать")
	}
}

func TestLoadSecretsOptionalByDefault(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("SECRETS_FILE", "")
	if err := loadSecrets(); err != nil {
		t.Fatalf("без SECRETS_FILE файл необязателен: %v", err)
	}
}

// Файл, сохранённый редактором Windows с BOM, читается так же, как без него.
func TestLoadDotEnvToleratesBOM(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, []byte("\ufeffFAMIGO_TEST_BOM=ok\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.Unsetenv("FAMIGO_TEST_BOM") })
	if err := loadDotEnv(path); err != nil {
		t.Fatal(err)
	}
	if got := os.Getenv("FAMIGO_TEST_BOM"); got != "ok" {
		t.Fatalf("первая строка с BOM не прочитана: %q", got)
	}
}

func TestProductionRequiresMessageKeys(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("APP_ENV", "production")
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("JWT_SECRET", "01234567890123456789012345678901234567890123")
	t.Setenv("MESSAGE_KEYS", "")

	if _, err := Load(slog.New(slog.NewTextHandler(io.Discard, nil))); err == nil {
		t.Fatal("в production без MESSAGE_KEYS сервер не должен запускаться")
	}

	t.Setenv("MESSAGE_KEYS", "1:"+strings.Repeat("A", 43)+"=")
	cfg, err := Load(slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil || len(cfg.MessageKeys) != 1 {
		t.Fatalf("корректный MESSAGE_KEYS: %v, ключей %d", err, len(cfg.MessageKeys))
	}
}

func TestInvalidMessageKeysAreRejected(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("MESSAGE_KEYS", "1:слишком-короткий")
	if _, err := Load(slog.New(slog.NewTextHandler(io.Discard, nil))); err == nil {
		t.Fatal("неверный MESSAGE_KEYS должен быть ошибкой, а не тихо отключать шифрование")
	}
}
