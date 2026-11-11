import ru from "./locales/ru";
import en from "./locales/en";
import es from "./locales/es";
import zh from "./locales/zh";
import ja from "./locales/ja";
import de from "./locales/de";

export const LANGUAGES = [
  { value: "ru", label: "Русский", locale: "ru-RU" },
  { value: "en", label: "English", locale: "en-US" },
  { value: "es", label: "Español", locale: "es-ES" },
  { value: "zh", label: "中文", locale: "zh-CN" },
  { value: "ja", label: "日本語", locale: "ja-JP" },
  { value: "de", label: "Deutsch", locale: "de-DE" },
];

const dictionaries = { ru, en, es, zh, ja, de };
const STORAGE_KEY = "famigo-lang-v2";

const FALLBACK_LANG = "en";

function detectDeviceLang() {
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of preferred) {
    const code = String(tag).toLowerCase().split("-")[0];
    if (dictionaries[code]) return code;
  }
  return FALLBACK_LANG;
}

function readLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (dictionaries[saved]) return saved;
  } catch {
    // хранилище недоступно: берём язык устройства
  }
  return detectDeviceLang();
}

let current = readLang();

export function getLang() {
  return current;
}

export function getLocale() {
  return LANGUAGES.find((l) => l.value === current).locale;
}

export function applyLang(lang, persist = false) {
  current = dictionaries[lang] ? lang : FALLBACK_LANG;
  document.documentElement.lang = current;
  if (!persist) return;
  try {
    localStorage.setItem(STORAGE_KEY, current);
  } catch {
    // хранилище недоступно: язык просто не запомнится
  }
}

function lookup(dictionary, key) {
  return key.split(".").reduce((node, part) => node?.[part], dictionary);
}

export function has(key) {
  return lookup(dictionaries[current], key) !== undefined || lookup(ru, key) !== undefined;
}

export function t(key, params = {}) {
  let value = lookup(dictionaries[current], key) ?? lookup(ru, key) ?? key;
  if (Array.isArray(value)) return value;
  if (typeof value === "object") {
    const form = new Intl.PluralRules(getLocale()).select(params.count ?? 0);
    value = value[form] ?? value.many ?? value.other;
  }
  return value.replace(/\{(\w+)\}/g, (match, name) => (name in params ? params[name] : match));
}

export function tValue(group, value) {
  const key = `${group}.${value}`;
  return has(key) ? t(key) : value;
}
