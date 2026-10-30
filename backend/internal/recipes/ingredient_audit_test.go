package recipes

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/ATE826/Famigo/backend/internal/ai"
)

func TestAuditAddsFoodMentionedOnlyInServingText(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request capturedGeneration
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Error(err)
		}
		answer := `{"recipes":[{"index":0,"ingredients":[{"name":"Фарш","name_ru":"Фарш","amount":"150 г"},{"name":"Листья салата","name_ru":"Листья салата","amount":"4 шт."}]}]}`
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": answer}}}})
	}))
	defer srv.Close()
	s := NewService(nil, nil, ai.New(ai.Config{BaseURL: srv.URL, Timeout: time.Second}, slog.Default()))
	dish := rawDish{Title: "Мясные конвертики", Minutes: 30,
		Ingredients:  []rawIngredient{{Name: "Фарш", NameRu: "Фарш", Amount: "150 г"}},
		Instructions: []rawInstruction{{Text: "Заверните начинку в листья салата и подавайте."}},
	}
	dishes, err := s.auditIngredients(context.Background(), []rawDish{dish}, suggestInput{Servings: 1, Language: "ru"})
	if err != nil {
		t.Fatal(err)
	}
	checked, ok := checkDish(dishes[0], []fridgeItem{{Name: "Фарш"}}, nil, suggestInput{Servings: 1, Language: "ru"})
	if !ok || len(checked.Ingredients) != 2 || checked.Ingredients[1].Name != "Листья салата" || checked.MissingCount != 1 {
		t.Fatalf("serving ingredient missing from tags: %+v", checked)
	}
}

func TestAuditRejectsUnknownRecipeIndex(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": `{"recipes":[{"index":99,"ingredients":[{"name":"Вода","name_ru":"Вода","amount":"100 мл"}]}]}`}}}})
	}))
	defer srv.Close()
	s := NewService(nil, nil, ai.New(ai.Config{BaseURL: srv.URL, Timeout: time.Second}, slog.Default()))
	_, err := s.auditIngredients(context.Background(), []rawDish{{Instructions: []rawInstruction{{Text: "Шаг приготовления."}}}}, suggestInput{Servings: 1, Language: "ru"})
	if err == nil {
		t.Fatal("unknown recipe index accepted")
	}
}
