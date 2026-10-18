export function todayString() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${now.getFullYear()}`;
}

const pad = (n) => String(n).padStart(2, "0");

export function todayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function offsetDateString(days) {
  const date = todayStart();
  date.setDate(date.getDate() + days);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

export function todayShort() {
  const full = todayString();
  return full.slice(0, 6) + full.slice(8);
}

export function fullToShort(value) {
  const [day, month, year] = value.split(".");
  return `${day}.${month}.${year.slice(-2)}`;
}

export function shortToFull(value) {
  const [day, month, year] = value.split(".");
  return `${day}.${month}.20${year}`;
}
