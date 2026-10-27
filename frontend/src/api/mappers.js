// Перевод данных между форматом API и форматом, к которому привыкли экраны фронтенда.
// API хранит коды (dairy, pcs, owner), копейки и даты ISO; экраны работают с русскими
// значениями (их переводит i18n), рублями и датами вида 27.10.2026.

const invert = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));

const productCategories = { Молочные: "dairy", Овощи: "vegetables", Мясо: "meat", Напитки: "drinks", Другое: "other" };
const units = { "шт.": "pcs", мл: "ml", л: "l", г: "g", кг: "kg" };
const budgetCategories = {
  Продукты: "groceries",
  Дом: "home",
  Транспорт: "transport",
  Развлечения: "entertainment",
  Другое: "other",
  Зарплата: "salary",
  Подарок: "gift",
};
const roles = { Owner: "owner", Admin: "admin", Member: "member" };
const plans = { free: "free", premium: "premium", premiumPlus: "premium_plus" };

export const toApi = {
  productCategory: (v) => productCategories[v] ?? "other",
  unit: (v) => units[v] ?? "pcs",
  budgetCategory: (v) => budgetCategories[v] ?? "other",
  role: (v) => roles[v] ?? "member",
  plan: (v) => plans[v] ?? v,
};

const fromApiMaps = {
  productCategory: invert(productCategories),
  unit: invert(units),
  budgetCategory: invert(budgetCategories),
  role: invert(roles),
  plan: invert(plans),
};

// 27.10.2026 ↔ 2026-10-27
export function ruDateToIso(value) {
  if (!value) return "";
  const [day, month, year] = value.split(".");
  return `${year}-${month}-${day}`;
}

export function isoToRuDate(value) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

const pad = (n) => String(n).padStart(2, "0");

export function localDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const rublesToKopecks = (rubles) => Math.round(Number(rubles) * 100);
export const kopecksToRubles = (kopecks) => kopecks / 100;

export function mapMember(m) {
  return {
    id: m.userId,
    name: m.name,
    letter: (m.name?.[0] ?? "?").toUpperCase(),
    tone: m.avatarTone,
    photo: m.avatarUrl ?? "",
    role: fromApiMaps.role[m.role] ?? "Member",
    homeId: m.homeId,
    joined: m.joinedAt?.slice(0, 7) ?? "",
    birthday: isoToRuDate(m.birthday),
    foodPrefs: m.foodPrefs ?? [],
    foodNote: m.foodNote ?? "",
  };
}

// Свои данные (почта, телефон, согласия) приходят из /me и видны только самому человеку.
export function mergeMe(member, me) {
  if (!me) return member;
  const hasFood = me.foodPrefs.length > 0 || Boolean(me.foodNote);
  return {
    ...member,
    email: me.email,
    phone: me.phone ?? "",
    phoneVerified: me.phoneVerified,
    consents: { ...member.consents, food: hasFood ? "given" : null },
  };
}

export function mapHome(h, tasks = []) {
  return {
    id: h.id,
    name: h.name,
    kind: h.kind,
    place: h.place ?? "",
    rooms: h.rooms,
    people: h.peopleCount,
    residents: h.residents ?? [],
    tasks: tasks.map((task) => ({
      id: task.id,
      text: task.text,
      description: task.description ?? "",
      done: task.done,
    })),
  };
}

export function homeToApi(home) {
  return {
    name: home.name,
    kind: home.kind,
    place: home.place || null,
    rooms: Number(home.rooms),
    peopleCount: Number(home.people),
  };
}

export function mapProduct(p) {
  return {
    id: p.id,
    homeId: p.homeId,
    name: p.name,
    cat: fromApiMaps.productCategory[p.category] ?? "Другое",
    qty: p.quantity,
    unit: fromApiMaps.unit[p.unit] ?? "шт.",
    expires: isoToRuDate(p.expiresOn),
  };
}

export function productToApi(p) {
  return {
    name: p.name,
    category: toApi.productCategory(p.cat),
    quantity: Number(p.qty),
    unit: toApi.unit(p.unit),
    expiresOn: ruDateToIso(p.expires),
  };
}

export function mapOperation(op) {
  return {
    id: op.id,
    date: op.occurredOn,
    type: op.type,
    category: fromApiMaps.budgetCategory[op.category] ?? "Другое",
    amount: kopecksToRubles(op.amount),
    title: op.title ?? "",
    desc: op.description ?? "",
    who: op.userId,
  };
}

export function operationToApi(op) {
  return {
    type: op.type,
    category: toApi.budgetCategory(op.category),
    title: op.title || null,
    description: op.desc || null,
    amount: rublesToKopecks(op.amount),
    occurredOn: op.date,
  };
}

export function mapEvent(e) {
  const start = new Date(e.startsAt);
  return {
    id: e.id,
    date: localDateKey(start),
    time: localTime(start),
    title: e.title,
    description: e.description ?? "",
    place: e.place,
    memberIds: e.memberIds ?? [],
    createdBy: e.createdBy,
  };
}

export function mapMessage(m) {
  const created = new Date(m.createdAt);
  return {
    id: m.id,
    from: m.userId,
    text: m.text,
    deleted: m.deleted,
    createdAt: m.createdAt,
    day: localDateKey(created),
    time: localTime(created),
  };
}

export function mapSubscription(s) {
  return {
    planId: fromApiMaps.plan[s.plan.id] ?? "free",
    period: s.period,
    renewsAt: s.renewsAt,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    payerId: s.payerId,
  };
}

export function mapSettings(s) {
  return {
    budget: s.notifyBudget,
    calendar: s.notifyCalendar,
    fridge: s.notifyFridge,
    chat: s.notifyChat,
    family: s.notifyFamily,
  };
}

export function settingsToApi(settings, language) {
  return {
    notifyBudget: settings.budget,
    notifyCalendar: settings.calendar,
    notifyFridge: settings.fridge,
    notifyChat: settings.chat,
    notifyFamily: settings.family,
    language,
  };
}
