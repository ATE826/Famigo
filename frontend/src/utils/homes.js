import { t } from "../i18n";

export const kinds = ["apartment", "house", "dacha", "other"].map((value) => ({
  value,
  get label() {
    return t(`homeKinds.${value}`);
  },
}));

export function homeOf(homes, memberId) {
  return homes.find((h) => h.residents.includes(memberId));
}

const looks = {
  apartment: { icon: "apartment", gradient: "linear-gradient(160deg, #B9C7AC, #7E946D)" },
  house: { icon: "home", gradient: "linear-gradient(160deg, #E6B597, #C9764D)" },
  dacha: { icon: "cottage", gradient: "linear-gradient(160deg, #D9C29A, #A8844F)" },
  other: { icon: "pin", gradient: "linear-gradient(160deg, #929292, #4A4D47)" },
};

function lookOf(kind) {
  return looks[kind] ?? looks.other;
}

export function homeIcon(kind) {
  return lookOf(kind).icon;
}

export function homeGradient(kind) {
  return lookOf(kind).gradient;
}
