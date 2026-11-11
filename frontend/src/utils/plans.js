// Тарифы Famigo. Цены Premium взяты из проекта (249 ₽/мес, 2 490 ₽/год).
// Цена Premium+ временная, её нужно утвердить.
export const GB = 1024 ** 3;

export const PLANS = {
  free: {
    id: "free",
    rank: 0,
    price: { month: 0, year: 0 },
    homes: 2,
    storage: 2 * GB,
    geo: false,
    historyDays: 0,
    receipts: false,
    checkin: false,
    recipes: false,
  },
  premium: {
    id: "premium",
    rank: 1,
    price: { month: 249, year: 2490 },
    homes: 3,
    storage: 10 * GB,
    geo: true,
    historyDays: 7,
    receipts: false,
    checkin: true,
    recipes: false,
  },
  premiumPlus: {
    id: "premiumPlus",
    rank: 2,
    price: { month: 499, year: 4990 },
    homes: Infinity,
    storage: 100 * GB,
    geo: true,
    historyDays: 30,
    receipts: true,
    checkin: true,
    recipes: true,
  },
};

export const PLAN_ORDER = ["free", "premium", "premiumPlus"];

export const FREE_SUBSCRIPTION = {
  planId: "free",
  period: "month",
  renewsAt: null,
  cancelAtPeriodEnd: false,
  payerId: null,
};

export function activePlanId(subscription, now = new Date()) {
  if (subscription.planId === "free" || !subscription.renewsAt) return "free";
  return new Date(subscription.renewsAt) > now ? subscription.planId : "free";
}

export function renewalDate(period, from = new Date()) {
  const date = new Date(from);
  if (period === "year") date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}

export function yearSavingPercent(planId) {
  const { month, year } = PLANS[planId].price;
  if (!month) return 0;
  return Math.round((1 - year / (month * 12)) * 100);
}
