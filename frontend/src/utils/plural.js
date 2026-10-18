export function plural(n, forms) {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 > 10 && mod100 < 20) return forms[2];
  if (mod10 > 1 && mod10 < 5) return forms[1];
  if (mod10 === 1) return forms[0];
  return forms[2];
}

export const roomsLabel = (n) => `${n} ${plural(n, ["комната", "комнаты", "комнат"])}`;
export const peopleLabel = (n) => `${n} ${plural(n, ["человек", "человека", "человек"])}`;
export const productsLabel = (n) => `${n} ${plural(n, ["продукт", "продукта", "продуктов"])}`;
