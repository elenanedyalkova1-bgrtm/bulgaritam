import { isReliableDetectedObservation, PRICE_HISTORY_HEADERS } from "./google-sheets-history.mjs";
import { classifyPromotionSemantics, MINIMUM_DISCOUNT, promotionConsumerEligible } from "./promotion-semantics.mjs";

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
const meaningfulDiscount = (higher, current) => {
  if (higher == null || current == null || higher <= current) return false;
  const amount = higher - current; const percent = amount / higher * 100;
  return amount >= MINIMUM_DISCOUNT.amount && percent >= MINIMUM_DISCOUNT.percent;
};

function observation(raw) {
  const row = Array.isArray(raw)
    ? Object.fromEntries(PRICE_HISTORY_HEADERS.map((header, index) => [header, raw[index] ?? ""]))
    : raw;
  return { ...row, entity_type: text(row.entity_type) || "catalog_product", entity_id: text(row.entity_id) || text(row.product_id) };
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
  if (current == null || current <= 0 || regular == null || !meaningfulDiscount(regular, current)) return null;
  if (!currentCurrency || currentCurrency !== regularCurrency) return null;
  return { current, regular, currency: currentCurrency };
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
  if (!meaningfulDiscount(previous, current)) return null;
  return {
    previous,
    amount: rounded(previous - current),
    percent: rounded(((previous - current) / previous) * 100),
    firstSeenAt: text(reliable[runStart].checked_at) || null,
  };
}

export function evaluateProductDiscount(rawObservations, options = {}) {
  const window = evaluationWindow(options);
  const rows = rawObservations.map(observation).filter((row) => text(row.entity_id));
  if (!rows.length) return null;
  const reliable = rows
    .filter(isReliableDetectedObservation)
    .filter((row) => time(row.checked_at) != null)
    .sort((a, b) => time(a.checked_at) - time(b.checked_at));
  if (!reliable.length) {
    const latest = rows.slice().sort((a, b) => (time(b.checked_at) ?? -Infinity) - (time(a.checked_at) ?? -Infinity))[0];
    return {
      entity_type: latest.entity_type, entity_id: latest.entity_id, product_id: text(latest.product_id), product_name: text(latest.product_name), brand: text(latest.brand), product_url: text(latest.product_url),
      active_sale: false, verified_price_drop: false, weekly_discount_eligible: false,
      promotion_confidence: "UNKNOWN", promotion_consumer_eligible: false,
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
  const promotionConfidence = classifyPromotionSemantics({
    activeSale: Boolean(sale), verifiedPriceDrop: Boolean(drop),
    regularPriceMethod: sale ? latest.regular_price_method : null,
    regularPriceEvidence: sale ? latest.regular_price_evidence : null,
    productName: text(latest.product_name),
  });
  const consumerEligible = promotionConsumerEligible(promotionConfidence);
  const comparisonPrice = sale?.regular ?? drop?.previous ?? null;
  const discountAmount = comparisonPrice != null ? rounded(comparisonPrice - current) : null;
  const discountPercent = comparisonPrice != null ? rounded(((comparisonPrice - current) / comparisonPrice) * 100) : null;

  return {
    entity_type: latest.entity_type, entity_id: latest.entity_id, product_id: text(latest.product_id), product_name: text(latest.product_name), brand: text(latest.brand), product_url: text(latest.product_url),
    active_sale: Boolean(sale), verified_price_drop: Boolean(drop), weekly_discount_eligible: Boolean(consumerEligible && withinWindow),
    promotion_confidence: promotionConfidence, promotion_consumer_eligible: consumerEligible,
    current_price: current, regular_price: comparisonPrice, previous_price: drop?.previous ?? null,
    currency: currentCurrency || null,
    discount_amount: discountAmount,
    discount_percent: discountPercent,
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
    const row = observation(raw); const id = `${row.entity_type}|${row.entity_id}`;
    if (!id) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }
  return [...groups.values()]
    .map((rows) => evaluateProductDiscount(rows, options))
    .filter(Boolean)
    .sort((a, b) => a.product_name.localeCompare(b.product_name, "bg") || a.product_id.localeCompare(b.product_id));
}
