import { offsetDateString } from "../utils/dates";

export const initialMembers = [
  {
    id: "anton",
    letter: "А",
    tone: "green",
    name: "Антон",
    note: "Вы",
    role: "Owner",
    email: "anton@example.com",
    joined: "июля",
    birthday: "",
    foodPrefs: [],
    foodNote: "",
  },
  {
    id: "mama",
    letter: "М",
    tone: "terra",
    name: "Мама",
    note: "С июля",
    role: "Admin",
    birthday: "14.03.1975",
    foodPrefs: ["Без глютена"],
    foodNote: "",
  },
  {
    id: "papa",
    letter: "П",
    tone: "mint",
    name: "Папа",
    note: "С июля",
    role: "Admin",
    birthday: "02.06.1972",
    foodPrefs: [],
    foodNote: "",
  },
  {
    id: "sister",
    letter: "С",
    tone: "cream",
    name: "Сестра",
    note: "С августа",
    role: "Member",
    birthday: "26.10.2008",
    foodPrefs: ["Аллергия на орехи"],
    foodNote: "",
  },
];

export const initialHomes = [
  {
    id: "apartment",
    name: "Квартира",
    place: "Москва",
    kind: "apartment",
    rooms: 3,
    people: 2,
    residents: ["anton", "mama"],
    tasks: [
      {
        id: "a1",
        text: "Заменить лампочку в коридоре",
        description: "Перегорела лампа над шкафом. Нужна лампа с цоколем E27 и тёплым светом.",
        done: false,
      },
      {
        id: "a2",
        text: "Купить фильтр для воды",
        description: "Подобрать картридж для кувшина и взять два на запас.",
        done: false,
      },
      {
        id: "a3",
        text: "Разобрать кладовку",
        description: "Выбросить ненужное, остальное сложить по коробкам и подписать.",
        done: false,
      },
    ],
  },
  {
    id: "dacha",
    name: "Дача",
    place: "Московская область",
    kind: "dacha",
    rooms: 5,
    people: 4,
    residents: ["papa", "sister"],
    tasks: [
      {
        id: "d1",
        text: "Проверить крышу",
        description: "Осмотреть кровлю после зимы и проверить, нет ли протечек на чердаке.",
        done: false,
      },
      {
        id: "d2",
        text: "Покрасить забор",
        description: "Купить краску и кисти, покрасить забор по периметру участка.",
        done: false,
      },
    ],
  },
];

export const initialProducts = [
  { id: 1, homeId: "apartment", name: "Молоко", cat: "Молочные", qty: 2, unit: "шт.", expires: offsetDateString(1), low: true },
  { id: 2, homeId: "apartment", name: "Сыр", cat: "Молочные", qty: 1, unit: "шт.", expires: offsetDateString(10) },
  { id: 3, homeId: "apartment", name: "Яйца", cat: "Молочные", qty: 8, unit: "шт.", expires: offsetDateString(14) },
  { id: 4, homeId: "apartment", name: "Помидоры", cat: "Овощи", qty: 4, unit: "шт.", expires: offsetDateString(2) },
  { id: 5, homeId: "apartment", name: "Огурцы", cat: "Овощи", qty: 3, unit: "шт.", expires: offsetDateString(6) },
  { id: 6, homeId: "apartment", name: "Куриное филе", cat: "Мясо", qty: 600, unit: "г", expires: offsetDateString(3) },
  { id: 7, homeId: "dacha", name: "Картофель", cat: "Овощи", qty: 5, unit: "кг", expires: offsetDateString(60) },
  { id: 8, homeId: "dacha", name: "Тушёнка", cat: "Другое", qty: 6, unit: "шт.", expires: offsetDateString(300) },
  { id: 10, homeId: "apartment", name: "Йогурт", cat: "Молочные", qty: 2, unit: "шт.", expires: offsetDateString(-2) },
  { id: 9, homeId: "dacha", name: "Чай", cat: "Напитки", qty: 1, unit: "шт.", expires: offsetDateString(120) },
];

export const initialMessages = {
  family: [
    { id: 1, from: "mama", text: "Ужин сегодня в 19:00", time: "17:42" },
    { id: 2, from: "anton", text: "Хорошо, буду дома к семи.", time: "17:45", status: "прочитано" },
    { id: 3, from: "papa", text: "Я тоже.", time: "17:51" },
  ],
  mama: [{ id: 4, from: "mama", text: "Не забудь купить молоко", time: "17:30" }],
  papa: [{ id: 5, from: "papa", text: "Буду дома через час", time: "16:10" }],
  sister: [],
};

export const initialUnread = { family: 2 };

export const initialChatSettings = { family: { muted: false, pinned: true } };
