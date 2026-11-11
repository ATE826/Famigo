// Разбирает строку из QR-кода кассового чека: t=20260512T1830&s=1250.00&fn=...&i=...&fp=...&n=1
export function parseReceipt(raw) {
  const params = new URLSearchParams(raw.trim().replace(/^\?/, ""));
  const stamp = params.get("t")?.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})/);
  const amount = Number((params.get("s") ?? "").replace(/\s/g, "").replace(",", "."));
  if (!stamp || !(amount > 0)) return null;
  return { date: `${stamp[3]}.${stamp[2]}.${stamp[1]}`, amount };
}
