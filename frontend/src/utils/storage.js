import { getLocale } from "../i18n";
import { GB } from "./plans";

const MB = 1024 ** 2;

export function formatBytes(bytes) {
  const locale = getLocale();
  if (bytes >= GB) {
    return new Intl.NumberFormat(locale, { style: "unit", unit: "gigabyte", maximumFractionDigits: 1 }).format(bytes / GB);
  }
  const mb = Math.max(bytes / MB, 0);
  return new Intl.NumberFormat(locale, { style: "unit", unit: "megabyte", maximumFractionDigits: mb < 10 ? 1 : 0 }).format(mb);
}
