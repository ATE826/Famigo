package recipes

import (
	"strings"
	"testing"
)

func TestViolates(t *testing.T) {
	cases := []struct {
		pref string
		text string
		want bool
	}{
		{"Аллергия на орехи", "Салат с грецкими орехами", true},
		{"Аллергия на орехи", "Салат с огурцами", false},
		{"Аллергия на молоко", "Омлет на молоке", true},
		{"Без лактозы", "Паста со сливочным соусом", true},
		{"Аллергия на молоко", "Масло оливковое", false},
		{"Без лактозы", "Сформируйте котлеты из сырого фарша", false},
		{"Аллергия на молоко", "Натрите сырую морковь", false},
		{"Без лактозы", "Овощи в сыром виде", false},
		{"Без лактозы", "Посыпьте котлеты сыром", true},
		{"Без лактозы", "Добавьте сыр и перемешайте", true},
		{"Без лактозы", "Подавайте с сырным соусом", true},
		{"Без лактозы", "Выберите несколько сыров", true},
		{"Без лактозы", "Приготовьте сырники", true},
		{"Без лактозы", "Смешайте сырую морковь с сыром", true},
		{"Вегетарианство", "Гречка с курицей", true},
		{"Вегетарианство", "Рагу из тушёных овощей", false},
		{"Вегетарианство", "Густой овощной суп", false},
		{"Веганство", "Блины на яйцах", true},
		{"Пескетарианство", "Лосось на гриле", false},
		{"Пескетарианство", "Котлеты из говядины", true},
		{"Аллергия на пшеницу", "Пастернак запечённый", false},
		{"Без глютена", "Ржаной хлеб", true},
		{"Без свинины", "Карбонара с беконом", true},
		{"Халяль", "Курица в вине", true},
		{"Аллергия на мёд", "Курица в медовом соусе", true},
		{"Без сахара", "Сырники с мёдом", true},
		// Свои пункты профиля: ищем по словам самого пункта.
		{"Аллергия на баклажаны", "Рагу с баклажаном", true},
		{"Не ем лук", "Суп с луком", true},
		{"Не ем лук", "Суп с морковью", false},
	}
	for _, c := range cases {
		if got := violates(c.pref, words(c.text)); got != c.want {
			t.Errorf("violates(%q, %q) = %v, want %v", c.pref, c.text, got, c.want)
		}
	}
}

func TestParseAnswerToleratesFences(t *testing.T) {
	dishes, err := parseAnswer("Вот блюда:\n```json\n{\"dishes\":[{\"title\":\"Омлет\"}]}\n```")
	if err != nil || len(dishes) != 1 || dishes[0].Title != "Омлет" {
		t.Fatalf("parseAnswer: %v %+v", err, dishes)
	}
	if _, err := parseAnswer("не JSON"); err == nil {
		t.Fatal("ответ без JSON должен быть ошибкой")
	}
}

var fridgeItems = []fridgeItem{{Name: "Яйца", Quantity: 10, Unit: "pcs"}, {Name: "Молоко", Quantity: 1, Unit: "l"}}

func omelette() rawDish {
	return rawDish{
		Title:   "Омлет",
		Minutes: 10,
		Ingredients: []rawIngredient{
			{Name: "Яйца", NameRu: "Яйца", Amount: "4 шт.", Product: "яйца"},
			{Name: "Молоко", NameRu: "Молоко", Amount: "100 мл", Product: "Молоко"},
			{Name: "Сыр", NameRu: "Сыр", Amount: "50 г"},
			{Name: "Соль", NameRu: "Соль", Amount: "по вкусу"},
		},
		Steps: []string{"Взбейте яйца с молоком.", "Жарьте 5 минут."},
	}
}

func TestCheckDishMarksFridgeAndShopping(t *testing.T) {
	dish, ok := checkDish(omelette(), fridgeItems, nil, suggestInput{Servings: 3, Language: "ru"})
	if !ok {
		t.Fatal("подходящее блюдо отброшено")
	}
	if dish.Servings != 3 || len(dish.Ingredients) != 4 || dish.MissingCount != 1 || !dish.Ingredients[3].Staple {
		t.Fatalf("блюдо: %+v", dish)
	}
	if !dish.Ingredients[0].InFridge || !dish.Ingredients[1].InFridge || dish.Ingredients[2].InFridge {
		t.Fatalf("есть/докупить размечены неверно: %+v", dish.Ingredients)
	}
}

func TestCheckDishDropsRestricted(t *testing.T) {
	ru := suggestInput{Servings: 2, Language: "ru"}
	if _, ok := checkDish(omelette(), fridgeItems, []string{"Аллергия на яйца"}, ru); ok {
		t.Fatal("омлет человеку с аллергией на яйца должен быть отброшен")
	}
	// Соль не попадает в список покупок, но на ограничения проверяется.
	if _, ok := checkDish(omelette(), fridgeItems, []string{"Без соли"}, ru); ok {
		t.Fatal("блюдо с солью человеку «без соли» должно быть отброшено")
	}
}

func TestCheckDishDropsRestrictedSteps(t *testing.T) {
	d := omelette()
	d.Steps = append(d.Steps, "Посыпьте грецкими орехами.")
	if _, ok := checkDish(d, fridgeItems, []string{"Аллергия на орехи"}, suggestInput{Servings: 2, Language: "ru"}); ok {
		t.Fatal("ограничение в шагах должно отбрасывать блюдо, даже если ингредиент не указан")
	}
}

func TestParseAnswerRequiresDishes(t *testing.T) {
	for _, answer := range []string{`{}`, `{"dishes":null}`, `{"error":"unavailable"}`} {
		if _, err := parseAnswer(answer); err == nil {
			t.Fatalf("ответ без списка блюд принят: %s", answer)
		}
	}
	if dishes, err := parseAnswer(`{"dishes":[]}`); err != nil || len(dishes) != 0 {
		t.Fatalf("пустой список допустим: %v, %v", dishes, err)
	}
}

func TestCheckDishCleansText(t *testing.T) {
	d := omelette()
	d.Title = "  Омлет\x00 " + strings.Repeat("я", 200)
	d.Steps = []string{"", "Шаг\nс переносом"}
	dish, ok := checkDish(d, fridgeItems, nil, suggestInput{Servings: 2, Language: "ru"})
	if !ok {
		t.Fatal("блюдо отброшено")
	}
	if strings.ContainsRune(dish.Title, 0) || len([]rune(dish.Title)) > 80 {
		t.Fatalf("название не очищено: %q", dish.Title)
	}
	if len(dish.Steps) != 1 || dish.Steps[0] != "Шаг с переносом" {
		t.Fatalf("шаги: %q", dish.Steps)
	}
}

func TestRussianAnswerUsesRussianNames(t *testing.T) {
	d := omelette()
	d.Ingredients[0].Name = "Eggs"
	dish, _ := checkDish(d, fridgeItems, nil, suggestInput{Servings: 2, Language: "ru"})
	if dish.Ingredients[0].Name != "Яйца" {
		t.Fatalf("для русского ответа нужно русское название: %q", dish.Ingredients[0].Name)
	}
	dish, _ = checkDish(d, fridgeItems, nil, suggestInput{Servings: 2, Language: "en"})
	if dish.Ingredients[0].Name != "Eggs" {
		t.Fatalf("для английского ответа — английское: %q", dish.Ingredients[0].Name)
	}
}

func TestPromptHasNoPersonalData(t *testing.T) {
	restrictions, wishes := collectRestrictions([]eater{
		{Prefs: []string{"Аллергия на орехи"}, Note: "Не люблю лук"},
		{Prefs: []string{"Аллергия на орехи", "Веганство"}},
	})
	if len(restrictions) != 2 || len(wishes) != 1 {
		t.Fatalf("ограничения без повторов: %v %v", restrictions, wishes)
	}
	prompt, err := userPrompt(fridgeItems, restrictions, wishes, suggestInput{Servings: 2, Language: "ru"})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"Аллергия на орехи", "Веганство", "Не люблю лук", `"servings":2`} {
		if !strings.Contains(prompt, want) {
			t.Errorf("в подсказке нет %q: %s", want, prompt)
		}
	}
	for _, forbidden := range []string{"Яйца", "Молоко"} {
		if strings.Contains(prompt, forbidden) {
			t.Errorf("запрещённый продукт остался в холодильнике модели: %s", forbidden)
		}
	}
}
