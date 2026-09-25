import { isReliableDetectedObservation, PRICE_HISTORY_HEADERS } from "./google-sheets-history.mjs";

const text = (value) => String(value ?? "").trim();
const finite = (value) => {
  if (value == null || text(value) === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const currency = (value) => text(value).toUpperCase();
const time = (value) => {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : null;
};
const samePrice = (a, b) => a != null && b != null && Math.abs(a - b) < 0.000001;
const rounded = (value) => Number.isFinite(value) ? Math.round(value * 10_000) / 10_000 : null;

function observation(raw) {
  return Array.isArray(raw)
    ? Object.fromEntries(PRICE_HISTORY_HEADERS.map((header, index) => [header, raw[index] ?? ""]))
    : raw;
}

function evaluationWindow(options = {}) {
  const startValue = options.week_start ?? options.weekStart;
  const endValue = options.week_end ?? options.weekEnd;
  const start = time(startValue); const end = time(endValue);
  if (start == null || end == null || end <= start) throw new Error("Discount evaluation requires a valid half-open week window: week_start < week_end");
  return { start, end };
}

function explicitSalePair(latest) {
  const current = finite(latest.detected_price); const regular = finite(latest.regular_price);
  const currentCurrency = currency(latest.currency); const regularCurrency = currency(latest.regular_price_currency);
  if (current == null || current <= 0 || regular == null || regular <= current) return null;
  if (!currentCurrency || currentCurrency !== regularCurrency) return null;
  return { current, regular, currency: currentCurrency };
}

function authoritativePrevious(latest, current) {
  const previous = finite(latest.previous_verified_price); const difference = finite(latest.difference);
  if (previous == null || previous <= current || difference == null) return null;
  return samePrice(difference, current - previous) ? previous : null;
}

function priceDrop(reliable, latestIndex, current, currentCurrency) {
  let runStart = latestIndex;
  while (runStart > 0) {
    const earlier = reliable[runStart - 1];
    if (currency(earlier.currency) !== currentCurrency || !samePrice(finite(earlier.detected_price), current)) break;
    runStart -= 1;
  }

  let previous = null;
  for (let index = runStart - 1; index >= 0; index -= 1) {
    const candidate = reliable[index];
    if (currency(candidate.currency) !== currentCurrency) continue;
    previous = finite(candidate.detected_price);
    break;
  }
  if (previous == null) previous = authoritativePrevious(reliable[latestIndex], current);
  if (previous == null || previous <= current) return null;
  return {
    previous,
    amount: rounded(previous - current),
    percent: rounded(((previous - current) / previous) * 100),
    firstSeenAt: text(reliable[runStart].checked_at) || null,
  };
}

export function evaluateProductDiscount(rawObservations, options = {}) {
  const window = evaluationWindow(options);
  const rows = rawObservations.map(observation).filter((row) => text(row.product_id));
  if (!rows.length) return null;
  const reliable = rows
    .filter(isReliableDetectedObservation)
    .filter((row) => time(row.checked_at) != null)
    .sort((a, b) => time(a.checked_at) - time(b.checked_at));
  if (!reliable.length) {
    const latest = rows.slice().sort((a, b) => (time(b.checked_at) ?? -Infinity) - (time(a.checked_at) ?? -Infinity))[0];
    return {
      product_id: text(latest.product_id), product_name: text(latest.product_name), brand: text(latest.brand), product_url: text(latest.product_url),
      active_sale: false, verified_price_drop: false, weekly_discount_eligible: false,
      current_price: null, regular_price: null, previous_price: null, currency: null,
      discount_amount: null, discount_percent: null, price_drop_amount: null, price_drop_percent: null,
      latest_checked_at: null, last_verified_at: null, drop_first_seen_at: null,
      confidence: null, extraction_method: null, regular_price_method: null, regular_price_evidence: null,
    };
  }

  const latestIndex = reliable.length - 1; const latest = reliable[latestIndex];
  const current = finite(latest.detected_price); const currentCurrency = currency(latest.currency);
  const sale = explicitSalePair(latest);
  const drop = priceDrop(reliable, latestIndex, current, currentCurrency);
  const checkedAt = text(latest.checked_at); const checkedTime = time(checkedAt);
  const withinWindow = checkedTime >= window.start && checkedTime < window.end;

  return {
    product_id: text(latest.product_id), product_name: text(latest.product_name), brand: text(latest.brand), product_url: text(latest.product_url),
    active_sale: Boolean(sale), verified_price_drop: Boolean(drop), weekly_discount_eligible: Boolean(sale && withinWindow),
    current_price: current, regular_price: sale?.regular ?? null, previous_price: drop?.previous ?? null,
    currency: currentCurrency || null,
    discount_amount: sale ? rounded(sale.regular - sale.current) : null,
    discount_percent: sale ? rounded(((sale.regular - sale.current) / sale.regular) * 100) : null,
    price_drop_amount: drop?.amount ?? null, price_drop_percent: drop?.percent ?? null,
    latest_checked_at: checkedAt || null, last_verified_at: checkedAt || null, drop_first_seen_at: drop?.firstSeenAt ?? null,
    confidence: text(latest.confidence) || null, extraction_method: text(latest.extraction_method) || null,
    regular_price_method: sale ? text(latest.regular_price_method) || null : null,
    regular_price_evidence: sale ? latest.regular_price_evidence ?? null : null,
  };
}

export function evaluateDiscounts(rawObservations, options = {}) {
  evaluationWindow(options);
  const groups = new Map();
  for (const raw of rawObservations) {
    const row = observation(raw); const id = text(row.product_id);
    if (!id) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }
  return [...groups.values()]
    .map((rows) => evaluateProductDiscount(rows, options))
    .filter(Boolean)
    .sort((a, b) => a.product_name.localeCompare(b.product_name, "bg") || a.product_id.localeCompare(b.product_id));
}
