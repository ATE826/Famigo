package recipes

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/ATE826/Famigo/backend/internal/ai"
)

func TestDraftGetsDetailedRecipeWithTheSameRestrictions(t *testing.T) {
	draft := rawDish{Title: "Мясные конвертики", Minutes: 30, Ingredients: []rawIngredient{{Name: "Говяжий фарш", NameRu: "Говяжий фарш", Amount: "150 г"}}}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request capturedGeneration
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Error(err)
		}
		for _, want := range []string{"Без лактозы", "forbiddenIngredientTerms", "японский", draft.Title} {
			if !strings.Contains(request.Messages[1].Content, want) {
				t.Errorf("detail request lost %s", want)
			}
		}
		detail := draft
		detail.Title = "Другое название от модели"
		detail.Preparation = []rawInstruction{{Text: "Нарежьте лук."}}
		detail.Cooking = []rawInstruction{{Text: "Обжарьте фарш с луком на среднем огне 10 минут."}}
		detail.Serving = []rawInstruction{{Text: "Заверните начинку в листья салата.", Ingredients: []rawIngredient{{Name: "Листья салата", NameRu: "Листья салата", Amount: "4 шт."}}}}
		answer, _ := json.Marshal(detail)
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": string(answer)}}}})
	}))
	defer srv.Close()
	s := NewService(nil, nil, ai.New(ai.Config{BaseURL: srv.URL, Timeout: time.Second}, slog.Default()))
	detailed, err := s.describeRecipes(context.Background(), []rawDish{draft}, []fridgeItem{{Name: "Говяжий фарш"}}, []string{"Без лактозы"}, nil, suggestInput{Servings: 2, Language: "ja", Category: "hot"})
	if err != nil {
		t.Fatal(err)
	}
	result := completeIngredients(detailed[0])
	if result.Title != draft.Title || len(result.Steps) != 3 || len(result.Ingredients) != 2 || result.Ingredients[1].NameRu != "Листья салата" {
		t.Fatalf("draft did not become a complete recipe: %+v", result)
	}
}
