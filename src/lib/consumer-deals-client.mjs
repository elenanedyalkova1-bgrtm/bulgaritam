import { sanitizeConsumerDeal } from './public-deal-contract.mjs';

// Public-page policy only. The Admin API and monitoring contract stay unchanged.
export const CONSUMER_DEALS_ENDPOINT = 'https://admin.bulgaritam.bg/api/consumer-deals/';
export const DEAL_MAX_AGE_MS = 72 * 60 * 60_000;
export const DEAL_REFRESH_MS = 10 * 60_000;
export const DEAL_TIMEOUT_MS = 12_000;
const CLOCK_SKEW_MS = 5 * 60_000;
const currencies = new Set(Intl.supportedValuesOf('currency'));

export function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value.replace(/(?<=:\d{2})Z$/, '.000Z') ? parsed : NaN;
}

export function observationIsFresh(value, now = Date.now()) {
  const checked = timestamp(value);
  return Number.isFinite(checked) && checked <= now + CLOCK_SKEW_MS && now - checked < DEAL_MAX_AGE_MS;
}

function publicWebUrl(value) {
  if (typeof value !== 'string' || /[\s\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && Boolean(url.hostname);
  } catch { return false; }
}

export function validateDealsPayload(payload, now = Date.now()) {
  if (!payload || payload.version !== 1 || payload.stale !== false || !Array.isArray(payload.deals)
    || !Number.isInteger(payload.count) || payload.count !== payload.deals.length
    || !observationIsFresh(payload.generated_at, now)) throw new Error('Unverified deals snapshot');
  const ids = new Set();
  const deals = [];
  for (const raw of payload.deals) {
    if (!raw || !['current_price', 'regular_price', 'discount_percent'].every((key) => typeof raw[key] === 'number' && Number.isFinite(raw[key]))
      || raw.current_price <= 0 || raw.regular_price <= raw.current_price || raw.regular_price > 1e12
      || raw.discount_percent < 1 || raw.discount_percent >= 100 || raw.regular_price - raw.current_price < 0.5
      || !currencies.has(raw.currency) || !Number.isFinite(timestamp(raw.latest_checked_at))
      || timestamp(raw.latest_checked_at) > now + CLOCK_SKEW_MS
      || timestamp(raw.latest_checked_at) > timestamp(payload.generated_at) + CLOCK_SKEW_MS
      || !publicWebUrl(raw.image_url) || !publicWebUrl(raw.outbound_url)) throw new Error('Invalid deal');
    const percent = (raw.regular_price - raw.current_price) / raw.regular_price * 100;
    if (Math.abs(percent - raw.discount_percent) > 0.01) throw new Error('Inconsistent discount');
    if (raw.destination_type === 'internal') {
      if (typeof raw.internal_slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.internal_slug)
        || raw.destination_url !== `/p/${raw.internal_slug}/`) throw new Error('Invalid product link');
    } else if (raw.destination_type !== 'external' || !publicWebUrl(raw.destination_url)) throw new Error('Invalid store link');
    const deal = sanitizeConsumerDeal(raw);
    if (!deal || ids.has(deal.id)) throw new Error('Invalid or duplicate deal');
    ids.add(deal.id);
    // Match browser mixed-image upgrading without mutating stored API data.
    const image = new URL(deal.image_url);
    image.protocol = 'https:';
    deal.image_url = image.toString();
    // A cached response can legitimately contain observations that have since expired.
    if (observationIsFresh(deal.latest_checked_at, now)) deals.push(deal);
  }
  return { deals, generated_at: payload.generated_at };
}
