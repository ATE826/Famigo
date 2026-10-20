import { tValue } from "../../i18n";

export const foodOptions = [
  "Без лактозы",
  "Без глютена",
  "Без сахара",
  "Вегетарианство",
  "Веганство",
  "Аллергия на орехи",
  "Аллергия на морепродукты",
  "Халяль",
];

export const foodLabel = (value) => tValue("foodPrefs", value);
