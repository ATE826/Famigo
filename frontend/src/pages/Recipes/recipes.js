import { isSpoiled } from "../Fridge/products";
import { foodOptions } from "../ProfileFood/food";

// Ограничения, которые нарушает ингредиент (значения совпадают с пунктами из профиля)
const DAIRY = ["Аллергия на молоко", "Без лактозы", "Веганство"];
const GLUTEN = ["Аллергия на пшеницу", "Без глютена"];
const MEAT = ["Вегетарианство", "Веганство", "Пескетарианство", "Аллергия на мясо"];

const INGREDIENTS = {
  egg: { name: "Яйца", stems: ["яйц"], conflicts: ["Аллергия на яйца", "Веганство"] },
  milk: { name: "Молоко", stems: ["молок"], conflicts: DAIRY },
  cheese: { name: "Сыр", stems: ["сыр"], conflicts: DAIRY },
  butter: { name: "Сливочное масло", stems: ["сливочн"], conflicts: DAIRY },
  tomato: { name: "Помидоры", stems: ["помидор", "томат"], conflicts: ["Аллергия на помидоры"] },
  cucumber: { name: "Огурцы", stems: ["огурц"], conflicts: [] },
  chicken: { name: "Куриное филе", stems: ["курин", "куриц"], conflicts: MEAT },
  stew: {
    name: "Тушёнка",
    stems: ["тушён", "тушен"],
    conflicts: [...MEAT, "Без говядины", "Без красного мяса"],
  },
  potato: { name: "Картофель", stems: ["картоф"], conflicts: [] },
  onion: { name: "Лук", stems: ["лук"], conflicts: [] },
  carrot: { name: "Морковь", stems: ["морков"], conflicts: [] },
  pepper: { name: "Болгарский перец", stems: ["перец"], conflicts: [] },
  rice: { name: "Рис", stems: ["рис"], conflicts: [] },
  buckwheat: { name: "Гречка", stems: ["греч"], conflicts: [] },
  flour: { name: "Мука", stems: ["мук"], conflicts: GLUTEN },
  pasta: { name: "Макароны", stems: ["макарон", "паста", "спагетти"], conflicts: GLUTEN },
  bread: { name: "Хлеб", stems: ["хлеб"], conflicts: GLUTEN },
};

export const recipes = [
  { id: "omelette", title: "Омлет с сыром", minutes: 10, items: ["egg", "milk", "cheese"], steps: ["Взбейте яйца с молоком и щепоткой соли.", "Вылейте на разогретую сковороду.", "Посыпьте тёртым сыром и накройте крышкой на 3 минуты."] },
  { id: "greek", title: "Греческий салат", minutes: 10, items: ["tomato", "cucumber", "cheese"], steps: ["Нарежьте помидоры и огурцы крупными кусками.", "Добавьте кубики сыра, соль и масло."] },
  { id: "veg-salad", title: "Свежий овощной салат", minutes: 5, items: ["tomato", "cucumber"], steps: ["Нарежьте овощи.", "Посолите и заправьте маслом."] },
  { id: "chicken-potato", title: "Курица с картофелем в духовке", minutes: 50, items: ["chicken", "potato", "onion"], steps: ["Нарежьте картофель и лук, филе разделите на куски.", "Посолите, добавьте специи и масло.", "Запекайте 40 минут при 190 °C."] },
  { id: "mash", title: "Картофельное пюре", minutes: 30, items: ["potato", "milk", "butter"], steps: ["Отварите картофель до мягкости.", "Разомните с тёплым молоком и маслом."] },
  { id: "soup", title: "Куриный суп", minutes: 50, items: ["chicken", "potato", "carrot", "onion"], steps: ["Сварите филе в солёной воде 20 минут.", "Добавьте картофель, морковь и лук.", "Варите ещё 20 минут."] },
  { id: "shakshuka", title: "Шакшука", minutes: 20, items: ["egg", "tomato", "onion", "pepper"], steps: ["Обжарьте лук и перец, добавьте помидоры.", "Тушите 7 минут, сделайте углубления и вбейте яйца.", "Накройте крышкой, пока белок не схватится."] },
  { id: "stew-potato", title: "Картошка с тушёнкой", minutes: 35, items: ["potato", "stew", "onion"], steps: ["Обжарьте лук, добавьте нарезанный картофель.", "Тушите до мягкости и выложите тушёнку."] },
  { id: "pancakes", title: "Блины", minutes: 30, items: ["milk", "egg", "flour"], steps: ["Смешайте молоко, яйца и муку до жидкого теста.", "Жарьте на смазанной маслом сковороде с двух сторон."] },
  { id: "pasta-chicken", title: "Паста с курицей и сыром", minutes: 25, items: ["pasta", "chicken", "cheese"], steps: ["Отварите макароны.", "Обжарьте нарезанное филе.", "Смешайте и посыпьте сыром."] },
  { id: "buckwheat-chicken", title: "Гречка с курицей", minutes: 35, items: ["buckwheat", "chicken", "onion"], steps: ["Обжарьте лук и курицу.", "Добавьте промытую гречку и воду в пропорции 1:2.", "Варите под крышкой 15 минут."] },
  { id: "rice-veg", title: "Рис с овощами", minutes: 30, items: ["rice", "carrot", "onion", "pepper"], steps: ["Обжарьте овощи.", "Добавьте рис и воду, варите под крышкой до готовности."] },
  { id: "baked-potato", title: "Картофель, запечённый с сыром", minutes: 40, items: ["potato", "cheese"], steps: ["Запеките дольки картофеля 30 минут.", "Посыпьте сыром и верните в духовку на 5 минут."] },
  { id: "stew-veg", title: "Овощное рагу", minutes: 40, items: ["potato", "carrot", "onion", "tomato"], steps: ["Обжарьте лук и морковь.", "Добавьте картофель и помидоры.", "Тушите под крышкой 25 минут."] },
  { id: "toast", title: "Тосты с яйцом и помидором", minutes: 10, items: ["bread", "egg", "tomato"], steps: ["Поджарьте хлеб.", "Приготовьте яичницу и выложите на тост с ломтиками помидора."] },
];

const matches = (stems, text) => stems.some((stem) => text.includes(stem));

// Нарушает ли пункт профиля ингредиент. Свои пункты сверяем по тексту, стандартные по списку конфликтов.
function violates(pref, ingredient) {
  if (foodOptions.includes(pref)) return ingredient.conflicts.includes(pref);
  return matches(ingredient.stems, pref.toLowerCase());
}

export function evaluate(recipe, products, members) {
  const stock = products.filter((p) => p.qty > 0 && !isSpoiled(p)).map((p) => p.name.toLowerCase());
  const ingredients = recipe.items.map((key) => INGREDIENTS[key]);
  const have = ingredients.filter((i) => stock.some((name) => matches(i.stems, name)));
  const missing = ingredients.filter((i) => !have.includes(i));
  const blocked = members.filter((m) =>
    (m.foodPrefs ?? []).some((pref) => ingredients.some((i) => violates(pref, i))),
  );
  return { recipe, have, missing, blocked };
}
