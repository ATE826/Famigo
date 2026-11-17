// Точка входа API Famigo: читает настройки, подключается к базе,
// применяет миграции и запускает HTTP-сервер.
//
// `api healthcheck` — проверка для Docker: в минимальном образе нет curl,
// поэтому сервер умеет проверить сам себя.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"encoding/json"
	"github.com/ATE826/Famigo/backend/internal/ai"
	"github.com/ATE826/Famigo/backend/internal/config"
	"github.com/ATE826/Famigo/backend/internal/database"
	"github.com/ATE826/Famigo/backend/internal/mail"
	"github.com/ATE826/Famigo/backend/internal/server"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if len(os.Args) > 1 && os.Args[1] == "aicheck" {
		cfg, err := config.Load(log)
		if err != nil {
			log.Error("настройки AI", "err", err)
			os.Exit(1)
		}
		client := ai.New(cfg.AI, log)
		if client == nil {
			log.Error("AI не настроен")
			os.Exit(1)
		}
		answer, err := client.Complete(context.Background(), ai.Request{System: "Ответь JSON по схеме. Это тест с вымышленными данными.", User: "Предложи одно простое блюдо из риса и моркови, без молока. Укажи название и список ингредиентов на русском.", SchemaName: "recipe_check", Schema: map[string]any{"type": "object", "properties": map[string]any{"name": map[string]any{"type": "string"}, "ingredients": map[string]any{"type": "array", "items": map[string]any{"type": "string"}}}, "required": []string{"name", "ingredients"}, "additionalProperties": false}, Temperature: 0.3})
		if err != nil {
			log.Error("проверка AI", "err", err)
			os.Exit(1)
		}
		var result struct {
			Name        string   `json:"name"`
			Ingredients []string `json:"ingredients"`
		}
		if json.Unmarshal([]byte(answer), &result) != nil || result.Name == "" || len(result.Ingredients) == 0 {
			log.Error("AI: некорректная структура рецепта")
			os.Exit(1)
		}
		log.Info("AI: авторизация и JSON-рецепт проверены", "model", client.Model(), "ingredients", len(result.Ingredients))
		return
	}

	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(healthcheck())
	}
	if len(os.Args) > 1 && os.Args[1] == "mailcheck" {
		cfg, err := config.Load(log)
		if err != nil {
			log.Error("настройки почты", "err", err)
			os.Exit(1)
		}
		sender := mail.New(cfg.Mail)
		if sender == nil {
			log.Error("отправка почты не настроена")
			os.Exit(1)
		}
		if err := sender.CheckSMTP(context.Background()); err != nil {
			log.Error("проверка SMTP", "err", err)
			os.Exit(1)
		}
		log.Info("SMTP: TLS и авторизация работают, письмо не отправлялось")
		return
	}

	if err := run(log); err != nil {
		log.Error("сервер остановлен с ошибкой", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	cfg, err := config.Load(log)
	if err != nil {
		return err
	}

	// ctx отменится, когда нажмут Ctrl+C или Docker попросит процесс завершиться.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := database.Connect(ctx, cfg.DatabaseURL, log)
	if err != nil {
		return err
	}
	defer database.Close(db)

	if err := database.Migrate(ctx, db, log); err != nil {
		return err
	}

	handler, err := server.New(cfg, db, log)
	if err != nil {
		return err
	}

	// Таймауты защищают от медленных клиентов (атака Slowloris): соединение,
	// которое по байту в минуту шлёт заголовки, не будет висеть вечно.
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Info("сервер запущен", "addr", "http://localhost:"+cfg.Port, "production", cfg.Production)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
		close(errCh)
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}

	// Плавная остановка: новые запросы не принимаем, текущие даём закончить.
	log.Info("останавливаю сервер...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

func healthcheck() int {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	client := http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + port + "/api/health")
	if err != nil {
		return 1
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}
