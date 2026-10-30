package recipes

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/ATE826/Famigo/backend/internal/ai"
)

// Опциональная проверка реального провайдера: обычные тесты не требуют нейросети.
func TestLiveRecipeSelection(t *testing.T) {
	endpoint := os.Getenv("FAMIGO_TEST_AI_URL")
	if endpoint == "" {
		t.Skip("set FAMIGO_TEST_AI_URL to test a real model")
	}
	model := os.Getenv("FAMIGO_TEST_AI_MODEL")
	if model == "" {
		model = "gemma4:e4b"
	}
	service := NewService(nil, nil, ai.New(ai.Config{
		BaseURL: endpoint, Model: model, Timeout: 5 * time.Minute,
		JSONMode: "schema", Reasoning: "none", MaxConcurrent: 1,
	}, slog.Default()))
	items := []fridgeItem{
		{Name: "Картофель", Quantity: 1, Unit: "кг", DaysLeft: 7},
		{Name: "Морковь", Quantity: 3, Unit: "шт.", DaysLeft: 7},
		{Name: "Лук", Quantity: 2, Unit: "шт.", DaysLeft: 10},
		{Name: "Помидоры", Quantity: 4, Unit: "шт.", DaysLeft: 2},
		{Name: "Куриное филе", Quantity: 500, Unit: "г", DaysLeft: 1},
		{Name: "Чечевица", Quantity: 300, Unit: "г", DaysLeft: 30},
	}
	result, err := service.generate(context.Background(), items, nil, nil, suggestInput{Servings: 2, Language: "ru", Category: "soup"})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Items) != 5 || result.Category != "soup" {
		t.Fatalf("incomplete selection: %+v", result)
	}
	for _, dish := range result.Items {
		t.Logf("%s: %d ingredients, %d steps", dish.Title, len(dish.Ingredients), len(dish.Steps))
	}
}

func TestCategoryValidation(t *testing.T) {
	for category := range categoryHints {
		in, err := (suggestRequest{Servings: 2, Category: category}).validate()
		if err != nil || in.Category != category {
			t.Fatalf("category=%s: %+v %v", category, in, err)
		}
	}
	if in, err := (suggestRequest{Servings: 2}).validate(); err != nil || in.Category != "any" {
		t.Fatalf("default category: %+v %v", in, err)
	}
	if _, err := (suggestRequest{Servings: 2, Category: "invented"}).validate(); err == nil {
		t.Fatal("unknown category accepted")
	}
}

func TestPromptCarriesCategoryLanguageAndExactCount(t *testing.T) {
	for _, lang := range languages {
		prompt, err := generationPrompt(fridgeItems, nil, nil, suggestInput{Servings: 2, Language: lang, Category: "soup"}, 3, []string{"Омлет"}, nil)
		if err != nil {
			t.Fatal(err)
		}
		for _, want := range []string{`"dishes":3`, `"category":"soup"`, languageNames[lang], `"excludeTitles":["Омлет"]`, categoryHints["soup"]} {
			if !strings.Contains(prompt, want) {
				t.Fatalf("missing %q in %s", want, prompt)
			}
		}
	}
	for _, count := range []int{1, 3, 5} {
		schema := schemaForDishes(count, "any")["properties"].(map[string]any)["dishes"].(map[string]any)
		if schema["minItems"] != count || schema["maxItems"] != count {
			t.Fatal(schema)
		}
	}
}

func recipeFixture(title string) rawDish {
	d := omelette()
	d.Title = title
	additions := map[string]string{
		"Омлет с зеленью": "Укроп", "Сырная запеканка": "Творог", "Яичный рулет": "Шпинат",
		"Овощной гратен": "Картофель", "Сырные маффины": "Мука", "Ореховое суфле": "Миндаль",
		"Омлет": "Укроп", "Запеканка": "Творог", "Рулет": "Шпинат", "Гратен": "Картофель", "Суфле": "Тыква", "Маффины": "Мука",
	}
	if name := additions[title]; name != "" {
		d.Ingredients = append(d.Ingredients, rawIngredient{Name: name, NameRu: name, Amount: "50 г"})
	}
	d.Steps = []string{"Подготовьте продукты для блюда «" + title + "».", "Смешайте ингредиенты.", "Приготовьте и подавайте."}
	return d
}

type capturedGeneration struct {
	Messages []struct {
		Content string `json:"content"`
	} `json:"messages"`
	ResponseFormat struct {
		JSONSchema struct {
			Schema map[string]any `json:"schema"`
		} `json:"json_schema"`
	} `json:"response_format"`
}

func TestGenerateReplacesDuplicatesAndRestrictedDishes(t *testing.T) {
	a, b := recipeFixture("Омлет с зеленью"), recipeFixture("Сырная запеканка")
	duplicate := a
	duplicate.Title = "ОМЛЕТ с зеленью!"
	renamed := a
	renamed.Title = "Другое название того же омлета"
	blocked := recipeFixture("Ореховое суфле")
	blocked.Steps = append(blocked.Steps, "Добавьте грецкие орехи.")
	batch := [][]rawDish{{a, duplicate, renamed, b, blocked}, {recipeFixture("Яичный рулет"), recipeFixture("Овощной гратен"), recipeFixture("Сырные маффины")}}
	requests := make(chan capturedGeneration, 3)
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req capturedGeneration
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Error(err)
		}
		requests <- req
		index := int(calls.Add(1)) - 1
		if index >= len(batch) {
			http.Error(w, "unexpected retry", 500)
			return
		}
		answer, _ := json.Marshal(rawAnswer{Dishes: batch[index]})
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": string(answer)}}}})
	}))
	defer srv.Close()
	service := NewService(nil, nil, ai.New(ai.Config{BaseURL: srv.URL, Model: "test", Timeout: time.Second}, slog.New(slog.NewTextHandler(io.Discard, nil))))
	result, err := service.generate(context.Background(), fridgeItems, []string{"Аллергия на орехи"}, nil, suggestInput{Servings: 2, Language: "ru", Category: "hot"})
	if err != nil || len(result.Items) != 5 || result.Dropped != 3 || result.Category != "hot" || calls.Load() != 2 {
		t.Fatalf("result=%+v err=%v calls=%d", result, err, calls.Load())
	}
	first := <-requests
	if !strings.Contains(first.Messages[0].Content, categoryHints["hot"]) {
		t.Fatal("selected category is missing from system instructions")
	}
	retry := <-requests
	retrySchema := retry.ResponseFormat.JSONSchema.Schema["properties"].(map[string]any)["dishes"].(map[string]any)
	if retrySchema["minItems"] != float64(3) || retrySchema["maxItems"] != float64(3) {
		t.Fatalf("retry schema must request exactly three dishes: %+v", retrySchema)
	}
	if !strings.Contains(retry.Messages[1].Content, `"dishes":3`) || !strings.Contains(retry.Messages[1].Content, `"alreadySuggested"`) || !strings.Contains(retry.Messages[1].Content, "Омлет с зеленью") {
		t.Fatalf("retry did not ask for missing dishes and exclude accepted ones: %+v", retry)
	}
}

func TestGenerateDoesNotReturnPartialOrUnsafeSelection(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		answer, _ := json.Marshal(rawAnswer{Dishes: []rawDish{recipeFixture("Омлет")}})
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": string(answer)}}}})
	}))
	defer srv.Close()
	service := NewService(nil, nil, ai.New(ai.Config{BaseURL: srv.URL, Timeout: time.Second}, slog.New(slog.NewTextHandler(io.Discard, nil))))
	for _, restrictions := range [][]string{nil, {"Аллергия на яйца"}} {
		calls.Store(0)
		result, err := service.generate(context.Background(), fridgeItems, restrictions, nil, suggestInput{Servings: 2, Language: "ru"})
		if err != errIncomplete || len(result.Items) != 0 || calls.Load() != maxGenerationAttempts {
			t.Fatalf("partial/unsafe result: %+v err=%v calls=%d", result, err, calls.Load())
		}
	}
}

func TestGenerateCapsOversizedSelection(t *testing.T) {
	names := []string{"Омлет", "Запеканка", "Рулет", "Гратен", "Суфле", "Маффины"}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var dishes []rawDish
		for _, name := range names {
			dishes = append(dishes, recipeFixture(name))
		}
		answer, _ := json.Marshal(rawAnswer{Dishes: dishes})
		_, _ = fmt.Fprintf(w, `{"choices":[{"message":{"content":%q}}]}`, string(answer))
	}))
	defer srv.Close()
	service := NewService(nil, nil, ai.New(ai.Config{BaseURL: srv.URL, Timeout: time.Second}, slog.Default()))
	result, err := service.generate(context.Background(), fridgeItems, nil, nil, suggestInput{Servings: 2, Language: "ru"})
	if err != nil || len(result.Items) != 5 {
		t.Fatalf("%+v %v", result, err)
	}
}

func TestGenerateAllowsDifferentRecipesFromSameProducts(t *testing.T) {
	names := []string{"Котлеты с сырной начинкой", "Мясной рулет", "Сырная запеканка с фаршем", "Тефтели в молочном соусе", "Мясное суфле"}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var dishes []rawDish
		for _, name := range names {
			dishes = append(dishes, rawDish{Title: name, Minutes: 30,
				Ingredients: []rawIngredient{
					{Name: "Говяжий фарш", NameRu: "Говяжий фарш", Amount: "300 г", Product: "Говяжий фарш"},
					{Name: "Сыр", NameRu: "Сыр", Amount: "100 г", Product: "Сыр"},
					{Name: "Молоко", NameRu: "Молоко", Amount: "100 мл", Product: "Молоко"},
				}, Steps: []string{"Подготовьте продукты для блюда «" + name + "».", "Приготовьте блюдо выбранным способом.", "Подавайте."}})
		}
		answer, _ := json.Marshal(rawAnswer{Dishes: dishes})
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": string(answer)}}}})
	}))
	defer srv.Close()
	service := NewService(nil, nil, ai.New(ai.Config{BaseURL: srv.URL, Timeout: time.Second}, slog.Default()))
	result, err := service.generate(context.Background(), nil, nil, nil, suggestInput{Servings: 2, Language: "ru", Category: "hot"})
	if err != nil || len(result.Items) != 5 {
		t.Fatalf("different recipes were rejected because of shared products: count=%d err=%v", len(result.Items), err)
	}
}

func TestGenerateAllowsDifferentIngredientsWithSameSteps(t *testing.T) {
	fruits := []string{"Банан", "Клубника", "Персик", "Манго", "Груша"}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var dishes []rawDish
		for _, fruit := range fruits {
			dishes = append(dishes, rawDish{Title: "Смузи: " + fruit, Minutes: 5,
				Ingredients: []rawIngredient{{Name: "Молоко", NameRu: "Молоко", Amount: "200 мл"}, {Name: fruit, NameRu: fruit, Amount: "100 г"}},
				Steps:       []string{"Очистите фрукты.", "Измельчите ингредиенты в блендере.", "Перелейте в стакан и подавайте."}})
		}
		answer, _ := json.Marshal(rawAnswer{Dishes: dishes})
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": string(answer)}}}})
	}))
	defer srv.Close()
	service := NewService(nil, nil, ai.New(ai.Config{BaseURL: srv.URL, Timeout: time.Second}, slog.Default()))
	result, err := service.generate(context.Background(), nil, nil, nil, suggestInput{Servings: 2, Language: "ru", Category: "drink"})
	if err != nil || len(result.Items) != 5 {
		t.Fatalf("different drinks with common steps rejected: count=%d err=%v", len(result.Items), err)
	}
}

func TestLiveSparsePantry(t *testing.T) {
	testLiveSparsePantry(t, nil)
}

func TestLiveLactoseFreeSparsePantry(t *testing.T) {
	testLiveSparsePantry(t, []string{"Без лактозы"})
}

func testLiveSparsePantry(t *testing.T, restrictions []string) {
	endpoint := os.Getenv("FAMIGO_TEST_AI_URL")
	if endpoint == "" {
		t.Skip("set FAMIGO_TEST_AI_URL to test a real model")
	}
	model := os.Getenv("FAMIGO_TEST_AI_MODEL")
	if model == "" {
		model = "gemma4:e4b"
	}
	service := NewService(nil, nil, ai.New(ai.Config{BaseURL: endpoint, Model: model, Timeout: 5 * time.Minute, JSONMode: "schema", Reasoning: "none", MaxConcurrent: 1}, slog.Default()))
	items := []fridgeItem{
		{Name: "Говяжий фарш", Quantity: 1, Unit: "kg", DaysLeft: 60},
		{Name: "Молоко", Quantity: 3, Unit: "l", DaysLeft: 60},
		{Name: "Сыр", Quantity: 500, Unit: "g", DaysLeft: 60},
	}
	for _, category := range []string{"any", "snack", "hot", "cold", "soup", "salad", "bakery", "dessert", "drink"} {
		t.Run(category, func(t *testing.T) {
			result, err := service.generate(context.Background(), items, restrictions, nil, suggestInput{Servings: 2, Language: "ru", Category: category})
			if err != nil || len(result.Items) != 5 {
				t.Fatalf("category=%s count=%d err=%v", category, len(result.Items), err)
			}
			for index, dish := range result.Items {
				minSteps := 6
				if category == "drink" {
					minSteps = 4
				}
				if len(dish.Steps) < minSteps {
					t.Errorf("recipe lacks detailed instructions: %+v", dish)
				}
				if category == "dessert" || category == "drink" {
					var ingredients []string
					for _, ingredient := range dish.Ingredients {
						ingredients = append(ingredients, ingredient.Name)
					}
					// В этом сценарии ограничений нет: желатин в десерте допустим.
					// Проверяем, что модель не использовала фарш из исходной корзины.
					if strings.Contains(normalize(strings.Join(ingredients, " ")), "фарш") {
						t.Errorf("minced meat does not belong in category %s: %+v", category, dish)
					}
				}
				t.Log(dish.Title)
				if index == 0 {
					t.Logf("ingredients: %+v", dish.Ingredients)
					t.Logf("instructions: %s", strings.Join(dish.Steps, "\n"))
				}
			}
		})
	}
}

func TestPromptFiltersRestrictedProductsAndSuppliesTerms(t *testing.T) {
	items := []fridgeItem{{Name: "Говяжий фарш"}, {Name: "Молоко"}, {Name: "Сыр"}}
	prompt, err := userPrompt(items, []string{"Без лактозы"}, nil, suggestInput{Servings: 2, Language: "ru"})
	if err != nil {
		t.Fatal(err)
	}
	var payload struct {
		Fridge []fridgeItem `json:"fridge"`
		Terms  []string     `json:"forbiddenIngredientTerms"`
	}
	if err := json.Unmarshal([]byte(prompt[strings.Index(prompt, "{"):]), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Fridge) != 1 || payload.Fridge[0].Name != "Говяжий фарш" {
		t.Fatalf("restricted fridge sent: %+v", payload.Fridge)
	}
	if !strings.Contains(strings.Join(payload.Terms, ","), "молок") || !strings.Contains(strings.Join(payload.Terms, ","), "сыр") {
		t.Fatal(payload.Terms)
	}
	if len(items) != 3 {
		t.Fatal("original fridge mutated")
	}
	prompt, err = userPrompt(items[1:], []string{"Без лактозы"}, nil, suggestInput{Servings: 2, Language: "ru"})
	if err != nil || !strings.Contains(prompt, `"fridge":[]`) {
		t.Fatalf("all restricted products must produce an empty allowed list: %s %v", prompt, err)
	}
}
