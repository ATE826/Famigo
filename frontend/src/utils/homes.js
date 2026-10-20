export const kinds = [
  { value: "apartment", label: "Квартира" },
  { value: "house", label: "Дом" },
  { value: "dacha", label: "Дача" },
  { value: "other", label: "Другое" },
];

export function homeOf(homes, memberId) {
  return homes.find((h) => h.residents.includes(memberId));
}

export function homeIcon(kind) {
  return kind === "apartment" ? "home" : "cottage";
}

export function homeGradient(kind) {
  if (kind === "apartment") return "linear-gradient(160deg, #B9C7AC, #8FA37E)";
  if (kind === "house") return "linear-gradient(160deg, #B9C7AC, #7E946D)";
  return "linear-gradient(160deg, #EBCFBF, #D9A07E)";
}
