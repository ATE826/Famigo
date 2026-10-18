export const initialMembers = [
  { id: "anton", letter: "А", tone: "green", name: "Антон", note: "Вы", role: "Owner" },
  { id: "mama", letter: "М", tone: "terra", name: "Мама", note: "С июля", role: "Admin" },
  { id: "papa", letter: "П", tone: "sage", name: "Папа", note: "С июля", role: "Admin" },
  { id: "sister", letter: "С", tone: "gray", name: "Сестра", note: "С августа", role: "Member" },
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
    residents: ["anton", "mama", "papa", "sister"],
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
  { id: 1, homeId: "apartment", name: "Молоко", cat: "Молочные", qty: 2, unit: "шт.", expires: "20.08.2026", low: true },
  { id: 2, homeId: "apartment", name: "Сыр", cat: "Молочные", qty: 1, unit: "шт.", expires: "28.08.2026" },
  { id: 3, homeId: "apartment", name: "Яйца", cat: "Молочные", qty: 8, unit: "шт.", expires: "30.08.2026" },
  { id: 4, homeId: "apartment", name: "Помидоры", cat: "Овощи", qty: 4, unit: "шт.", expires: "21.08.2026" },
  { id: 5, homeId: "apartment", name: "Огурцы", cat: "Овощи", qty: 3, unit: "шт.", expires: "24.08.2026" },
  { id: 6, homeId: "apartment", name: "Куриное филе", cat: "Мясо", qty: 600, unit: "г", expires: "19.08.2026" },
  { id: 7, homeId: "dacha", name: "Картофель", cat: "Овощи", qty: 5, unit: "кг", expires: "15.09.2026" },
  { id: 8, homeId: "dacha", name: "Тушёнка", cat: "Другое", qty: 6, unit: "шт.", expires: "01.03.2027" },
  { id: 10, homeId: "apartment", name: "Йогурт", cat: "Молочные", qty: 2, unit: "шт.", expires: "15.08.2026" },
  { id: 9, homeId: "dacha", name: "Чай", cat: "Напитки", qty: 1, unit: "шт.", expires: "01.12.2026" },
];
