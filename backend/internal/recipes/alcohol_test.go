package recipes

import (
	"strings"
	"testing"
)

func TestMinorRejectsAlcoholRegardlessOfCategory(t *testing.T) {
	for _, title := range []string{"Курица в вине", "Пиво", "Rum cocktail", "Рис"} {
		d := rawDish{Title: title, Ingredients: []rawIngredient{{Name: "Wine", NameRu: "Вино", Amount: "100 мл"}}, Steps: []string{"Тушите 20 минут"}}
		if _, ok := checkDish(d, nil, nil, suggestInput{Servings: 2, Category: "hot", AllowAlcohol: false}); ok {
			t.Fatal("alcohol accepted")
		}
	}
	prompt, err := generationPrompt([]fridgeItem{{Name: "Вино", Category: "alcohol"}, {Name: "Рис"}}, []string{"Без алкоголя"}, nil, suggestInput{Servings: 2, Category: "hot"}, 5, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	// The ingredient matcher must also prevent alcoholic pantry items in prompts.
	if strings.Contains(prompt, `"name":"Вино"`) {
		t.Fatal("alcoholic pantry item leaked into prompt")
	}
}
