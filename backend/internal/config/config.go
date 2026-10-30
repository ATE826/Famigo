// Пакет config собирает настройки сервера из переменных окружения.
// Все настройки в одном месте: так видно, что нужно серверу для запуска.
package config

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/ATE826/Famigo/backend/internal/ai"
	"github.com/ATE826/Famigo/backend/internal/fieldcrypt"
)

type Config struct {
	// Production включает строгий режим: обязательный JWT_SECRET, Secure-куки, HSTS.
	Production bool
	Port       string
	// DatabaseURL — строка подключения к PostgreSQL.
	DatabaseURL string

	// JWTSecret подписывает токены доступа. Утечка = любой может войти под любым пользователем.
	JWTSecret       []byte
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration

	// CookieSecure — кука refresh-токена только по HTTPS.
	CookieSecure   bool
	CookieSameSite http.SameSite

	// AllowedOrigins — адреса фронтенда, которым браузер разрешит запросы к API (CORS).
	AllowedOrigins []string
	// TrustedProxies — адреса прокси (nginx), которым можно верить в заголовке X-Forwarded-For.
	// Пусто — не верим никому: иначе любой подделает свой IP и обойдёт ограничение запросов.
	TrustedProxies []string

	// MessageKeys — ключи шифрования сообщений в базе. Первый активный, остальные нужны
	// для чтения старых сообщений (смена ключа). Пусто — шифрование выключено (только в разработке).
	MessageKeys []fieldcrypt.Key

	// AI — нейросеть для подбора блюд. Пустой AI.BaseURL — подбор выключен.
	AI ai.Config

	UploadDir string
	// DemoPayments разрешает оформить подписку без оплаты. Только для разработки и защиты проекта.
	DemoPayments bool
	// LegalVersion — версия документов, на которые даётся согласие при регистрации.
	LegalVersion string
	// AuthRateLimit — сколько попыток входа и регистрации в минуту разрешено с одного IP.
	AuthRateLimit int
	// RateLimit — сколько запросов в минуту разрешено с одного IP всего.
	// Учтите: семья за одним домашним роутером — это один IP на всех.
	RateLimit int
}

const minSecretLength = 32

// Load собирает настройки. Порядок (что раньше — то важнее):
//  1. переменные окружения;
//  2. .env — обычные настройки, лежит в репозитории;
//  3. secrets.env или файл из SECRETS_FILE — пароли и ключи, в репозитории их нет.
func Load(log *slog.Logger) (Config, error) {
	if err := loadDotEnv(".env"); err != nil {
		return Config{}, err
	}
	// Идёт после .env, чтобы SECRETS_FILE можно было указать в .env.
	if err := loadSecrets(); err != nil {
		return Config{}, err
	}

	cfg := Config{
		Production:     getEnv("APP_ENV", "development") == "production",
		Port:           getEnv("PORT", "8080"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		AllowedOrigins: splitList(getEnv("ALLOWED_ORIGINS", "http://localhost:5173")),
		TrustedProxies: splitList(os.Getenv("TRUSTED_PROXIES")),
		UploadDir:      getEnv("UPLOAD_DIR", "uploads"),
		LegalVersion:   getEnv("LEGAL_VERSION", "2026-10"),
	}

	var err error
	if cfg.AccessTokenTTL, err = getDuration("ACCESS_TOKEN_TTL", 15*time.Minute); err != nil {
		return Config{}, err
	}
	if cfg.RefreshTokenTTL, err = getDuration("REFRESH_TOKEN_TTL", 30*24*time.Hour); err != nil {
		return Config{}, err
	}
	if cfg.CookieSecure, err = getBool("COOKIE_SECURE", cfg.Production); err != nil {
		return Config{}, err
	}
	if cfg.DemoPayments, err = getBool("DEMO_PAYMENTS", !cfg.Production); err != nil {
		return Config{}, err
	}
	if cfg.CookieSameSite, err = parseSameSite(getEnv("COOKIE_SAMESITE", "strict")); err != nil {
		return Config{}, err
	}
	if cfg.AuthRateLimit, err = getInt("AUTH_RATE_LIMIT", 20); err != nil {
		return Config{}, err
	}
	if cfg.RateLimit, err = getInt("RATE_LIMIT", 600); err != nil {
		return Config{}, err
	}

	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("не задан DATABASE_URL: секреты хранятся в secrets.env (образец: secrets.env.example)")
	}

	secret := os.Getenv("JWT_SECRET")
	switch {
	case len(secret) >= minSecretLength:
		cfg.JWTSecret = []byte(secret)
	case cfg.Production:
		return Config{}, fmt.Errorf("JWT_SECRET должен быть не короче %d символов", minSecretLength)
	default:
		// В разработке можно без секрета: генерируем случайный. Минус — после перезапуска
		// сервера всем придётся войти заново. Захардкоженный секрет был бы дырой.
		cfg.JWTSecret = randomSecret()
		log.Warn("JWT_SECRET не задан: сгенерирован временный секрет, после перезапуска нужно войти заново")
	}

	if cfg.MessageKeys, err = fieldcrypt.ParseKeys(os.Getenv("MESSAGE_KEYS")); err != nil {
		return Config{}, err
	}
	if len(cfg.MessageKeys) == 0 {
		if cfg.Production {
			return Config{}, errors.New("MESSAGE_KEYS обязателен в production: без него сообщения хранились бы открытым текстом (openssl rand -base64 32, формат 1:<ключ>)")
		}
		log.Warn("MESSAGE_KEYS не задан: сообщения в базе НЕ шифруются (допустимо только в разработке)")
	}

	if cfg.AI, err = loadAI(); err != nil {
		return Config{}, err
	}

	if cfg.CookieSameSite == http.SameSiteNoneMode && !cfg.CookieSecure {
		return Config{}, errors.New("COOKIE_SAMESITE=none работает только с COOKIE_SECURE=true")
	}
	return cfg, nil
}

// loadAI — настройки нейросети. Подходит любой OpenAI-совместимый API:
// локальный Ollama (http://localhost:11434/v1) или облачный (Gemini, OpenRouter, Groq…).
func loadAI() (ai.Config, error) {
	cfg := ai.Config{
		BaseURL:   strings.TrimSpace(os.Getenv("AI_BASE_URL")),
		Model:     strings.TrimSpace(os.Getenv("AI_MODEL")),
		APIKey:    strings.TrimSpace(os.Getenv("AI_API_KEY")),
		JSONMode:  getEnv("AI_JSON_MODE", "schema"),
		Reasoning: strings.TrimSpace(os.Getenv("AI_REASONING")),
	}
	var err error
	if cfg.Timeout, err = getDuration("AI_TIMEOUT", 5*time.Minute); err != nil {
		return ai.Config{}, err
	}
	if cfg.MaxConcurrent, err = getInt("AI_MAX_CONCURRENT", 1); err != nil {
		return ai.Config{}, err
	}
	if cfg.BaseURL == "" {
		return cfg, nil
	}
	u, err := url.Parse(cfg.BaseURL)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return ai.Config{}, errors.New("AI_BASE_URL: ожидается адрес вида http://localhost:11434/v1")
	}
	if cfg.Model == "" {
		return ai.Config{}, errors.New("AI_MODEL: укажите модель, например gemma4:26b")
	}
	if cfg.JSONMode != "schema" && cfg.JSONMode != "object" {
		return ai.Config{}, errors.New("AI_JSON_MODE: ожидается schema или object")
	}
	// Ключ по обычному http ушёл бы открытым текстом. Без шифрования можно только к своей
	// машине или соседнему контейнеру.
	if cfg.APIKey != "" && u.Scheme == "http" && !localHost(u.Hostname()) {
		return ai.Config{}, errors.New("AI_BASE_URL: с ключом AI_API_KEY нужен https://")
	}
	return cfg, nil
}

func localHost(host string) bool {
	return host == "localhost" || host == "127.0.0.1" || host == "::1" || host == "host.docker.internal"
}

func randomSecret() []byte {
	buf := make([]byte, 48)
	if _, err := rand.Read(buf); err != nil {
		panic(err) // без случайных чисел безопасно работать нельзя
	}
	return []byte(base64.RawURLEncoding.EncodeToString(buf))
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}
	return fallback
}

func getDuration(key string, fallback time.Duration) (time.Duration, error) {
	value := os.Getenv(key)
	if value == "" {
		return fallback, nil
	}
	d, err := time.ParseDuration(value)
	if err != nil || d <= 0 {
		return 0, fmt.Errorf("%s: ожидается длительность вроде 15m или 720h", key)
	}
	return d, nil
}

func getInt(key string, fallback int) (int, error) {
	value := os.Getenv(key)
	if value == "" {
		return fallback, nil
	}
	n, err := strconv.Atoi(value)
	if err != nil || n <= 0 {
		return 0, fmt.Errorf("%s: ожидается положительное число", key)
	}
	return n, nil
}

func getBool(key string, fallback bool) (bool, error) {
	value := os.Getenv(key)
	if value == "" {
		return fallback, nil
	}
	b, err := strconv.ParseBool(value)
	if err != nil {
		return false, fmt.Errorf("%s: ожидается true или false", key)
	}
	return b, nil
}

func parseSameSite(value string) (http.SameSite, error) {
	switch strings.ToLower(value) {
	case "strict":
		return http.SameSiteStrictMode, nil
	case "lax":
		return http.SameSiteLaxMode, nil
	case "none":
		return http.SameSiteNoneMode, nil
	}
	return 0, errors.New("COOKIE_SAMESITE: ожидается strict, lax или none")
}

func splitList(value string) []string {
	var items []string
	for _, item := range strings.Split(value, ",") {
		if item = strings.TrimSpace(item); item != "" {
			items = append(items, item)
		}
	}
	return items
}
