package recipes

import (
	"strings"
	"testing"
)

func TestInstructionSchemaRequiresDetailedSteps(t *testing.T) {
	for _, category := range []string{"any", "hot", "soup", "salad", "drink"} {
		phases := schemaForRecipeDetails(category)["properties"].(map[string]any)
		expected := map[string]int{"stage1_preparation": 2, "stage2_cooking": 3, "stage3_serving": 1}
		if category == "drink" {
			expected["stage1_preparation"], expected["stage2_cooking"] = 1, 2
		}
		for phase, minimum := range expected {
			if phases[phase].(map[string]any)["minItems"] != minimum {
				t.Fatalf("category=%s phase=%s schema=%+v", category, phase, phases[phase])
			}
		}
	}
}

func TestPreparationCookingServingBecomeOneCompleteRecipe(t *testing.T) {
	d := rawDish{Title: "Картофельное рагу", Minutes: 40,
		Ingredients: []rawIngredient{{Name: "Картофель", NameRu: "Картофель", Amount: "2 шт."}},
		Preparation: []rawInstruction{{Text: "Очистите картофель.", Ingredients: []rawIngredient{{Name: "Картофель 2 шт.", NameRu: "Картофель 2 шт.", Amount: "2 шт."}}}},
		Cooking:     []rawInstruction{{Text: "Тушите картофель с водой 25 минут до мягкости.", Ingredients: []rawIngredient{{Name: "Вода", NameRu: "Вода", Amount: "200 мл"}}}},
		Serving:     []rawInstruction{{Text: "Разложите по тарелкам и посыпьте зеленью.", Ingredients: []rawIngredient{{Name: "Зелень", NameRu: "Зелень", Amount: "10 г"}}}},
	}
	dish, ok := checkDish(d, nil, nil, suggestInput{Servings: 2, Language: "ru"})
	if !ok || len(dish.Ingredients) != 3 || len(dish.Steps) != 3 || dish.Ingredients[0].Name != "Картофель" || dish.MissingCount != 2 {
		t.Fatalf("phases or ingredient deduplication failed: %+v", dish)
	}
	if dish.Steps[0] != d.Preparation[0].Text || dish.Steps[2] != d.Serving[0].Text {
		t.Fatal("steps reordered")
	}
}

func TestInstructionIngredientsAppearInTagsAndShopping(t *testing.T) {
	d := rawDish{Title: "Мясные конвертики в салате", Minutes: 30,
		Ingredients: []rawIngredient{
			{Name: "Говяжий фарш", NameRu: "Говяжий фарш", Amount: "150 г", Product: "Говяжий фарш"},
			{Name: "Лук репчатый", NameRu: "Лук репчатый", Amount: "1 шт."},
		},
		Instructions: []rawInstruction{
			{Text: "Очистите лук и нарежьте мелкими кубиками.", Ingredients: []rawIngredient{{Name: "Лук репчатый", NameRu: "Лук репчатый", Amount: "1 шт."}}},
			{Text: "Разогрейте масло на среднем огне и обжарьте лук 5 минут до мягкости.", Ingredients: []rawIngredient{{Name: "Растительное масло", NameRu: "Растительное масло", Amount: "1 ст. л."}}},
			{Text: "Добавьте фарш, разделите комочки лопаткой и обжаривайте до полной готовности.", Ingredients: []rawIngredient{{Name: "Говяжий фарш", NameRu: "Говяжий фарш", Amount: "150 г"}}},
			{Text: "Промойте и обсушите листья салата. Разложите начинку по листьям и заверните края внутрь.", Ingredients: []rawIngredient{{Name: "Листья салата", NameRu: "Листья салата", Amount: "4 шт."}}},
		},
	}
	items := []fridgeItem{{Name: "Говяжий фарш", Quantity: 1, Unit: "kg"}}
	dish, ok := checkDish(d, items, nil, suggestInput{Servings: 1, Language: "ru"})
	if !ok || len(dish.Ingredients) != 4 || dish.MissingCount != 2 || len(dish.Steps) != 4 {
		t.Fatalf("recipe=%+v ok=%v", dish, ok)
	}
	if dish.Ingredients[3].Name != "Листья салата" || dish.Ingredients[3].Amount != "4 шт." || dish.Ingredients[3].InFridge {
		t.Fatalf("missing serving ingredient not added: %+v", dish.Ingredients)
	}
	if len(d.Ingredients) != 2 {
		t.Fatal("original ingredient list was mutated")
	}
	// Ограничения должны проверять и ингредиенты, перечисленные только в шаге.
	d.Instructions[3].Ingredients = append(d.Instructions[3].Ingredients, rawIngredient{Name: "Грецкие орехи", NameRu: "Грецкие орехи", Amount: "10 г"})
	if _, ok := checkDish(d, items, []string{"Аллергия на орехи"}, suggestInput{Servings: 1, Language: "ru"}); ok {
		t.Fatal("ingredient used only in a step bypassed restrictions")
	}
}

func TestShoppingAnnotationsAreNotAcceptedAsInstructions(t *testing.T) {
	for _, note := range []string{
		"Выложите на листья салата (докупить листья салата).", "Buy lettuce for serving.",
		"Comprar lechuga.", "Salat kaufen.", "购买生菜。", "レタスを購入してください。",
	} {
		d := omelette()
		d.Steps = append(d.Steps, note)
		if _, ok := checkDish(d, nil, nil, suggestInput{Servings: 1, Language: "ru"}); ok {
			t.Fatalf("shopping note accepted: %s", note)
		}
	}
}

func TestDetailedInstructionsAreNotTruncatedToOldLimit(t *testing.T) {
	d := omelette()
	d.Steps = []string{strings.Repeat("Подробная инструкция приготовления. ", 14)}
	dish, ok := checkDish(d, nil, nil, suggestInput{Servings: 1, Language: "ru"})
	if !ok || len([]rune(dish.Steps[0])) < 400 {
		t.Fatalf("step truncated: %+v", dish)
	}
}

func TestMemberSelectionModes(t *testing.T) {
	all, none := true, false
	for _, tc := range []struct {
		flag     *bool
		ids      []string
		expected bool
	}{
		{nil, nil, true}, {nil, []string{"00000000-0000-0000-0000-000000000001"}, false},
		{&none, nil, false}, {&all, nil, true},
	} {
		in, err := (suggestRequest{Servings: 1, AllMembers: tc.flag, MemberIDs: tc.ids}).validate()
		if err != nil || in.AllMembers != tc.expected {
			t.Fatalf("mode=%+v err=%v", in, err)
		}
	}
}
