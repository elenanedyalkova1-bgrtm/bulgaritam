const CURRENCY_ALIASES = new Map([
  ["€", "EUR"], ["eur", "EUR"], ["euro", "EUR"], ["евро", "EUR"],
  ["лв", "BGN"], ["лв.", "BGN"], ["bgn", "BGN"], ["лева", "BGN"],
  ["$", "USD"], ["usd", "USD"], ["£", "GBP"], ["gbp", "GBP"],
]);

export function normalizeCurrency(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return CURRENCY_ALIASES.get(raw.toLowerCase()) || (/^[A-Za-z]{3}$/.test(raw) ? raw.toUpperCase() : null);
}

export function parsePrice(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  let raw = String(value ?? "").replace(/\u00a0/g, " ").trim();
  if (!raw || !/\d/.test(raw)) return null;
  raw = raw.replace(/[^\d.,\-\s]/g, "").replace(/\s/g, "").replace(/[.,]+$/, "");
  if (!raw || raw.startsWith("-")) return null;
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    raw = comma > dot ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  } else if (comma >= 0) {
    const decimals = raw.length - comma - 1;
    raw = decimals === 1 || decimals === 2 ? raw.replace(/,/g, ".") : raw.replace(/,/g, "");
  } else if (dot >= 0 && raw.split(".").length > 2) {
    const parts = raw.split(".");
    const last = parts.pop();
    raw = last.length <= 2 ? `${parts.join("")}.${last}` : `${parts.join("")}${last}`;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function pricesEqual(a, b) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.005;
}

export function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)));
}
