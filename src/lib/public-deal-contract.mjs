const text = (value, max = 300) => String(value ?? "").trim().slice(0, max);
const positive = (value) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
const strings = (value, maxItems = 20) => (Array.isArray(value) ? value : []).map((item) => text(item, 100)).filter(Boolean).slice(0, maxItems);
const safeUrl = (value, { relative = false } = {}) => {
  const raw = text(value, 2_000);
  if (relative && /^\/[a-z0-9/_-]*$/i.test(raw)) return raw;
  try { const url = new URL(raw); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : null; }
  catch { return null; }
};

export const PUBLIC_DEALS_CONTRACT_VERSION = 1;

export function sanitizeConsumerDeal(deal) {
  const current = positive(deal?.current_price); const regular = positive(deal?.regular_price);
  const discountPercent = positive(deal?.discount_percent);
  const checked = text(deal?.latest_checked_at, 40); const checkedTime = Date.parse(checked);
  const destinationType = deal?.destination_type === "internal" ? "internal" : deal?.destination_type === "external" ? "external" : null;
  const destination = safeUrl(deal?.destination_url, { relative: destinationType === "internal" });
  const outbound = safeUrl(deal?.outbound_url);
  const image = safeUrl(deal?.image_url);
  const entityType = deal?.entity_type === "catalog_product" ? "catalog_product" : deal?.entity_type === "observed_product" ? "observed_product" : null;
  if (!entityType || !text(deal?.entity_id, 100) || !text(deal?.title) || !text(deal?.brand) || !current || !regular || regular <= current || !discountPercent
    || !/^[A-Z]{3}$/.test(text(deal?.currency, 3)) || !Number.isFinite(checkedTime) || !destinationType || !destination || !outbound || !image) return null;
  return {
    id: `${entityType}:${text(deal.entity_id, 100)}`,
    entity_type: entityType, entity_id: text(deal.entity_id, 100), title: text(deal.title),
    brand_id: positive(deal.brand_id), brand: text(deal.brand), image_url: image,
    current_price: current, regular_price: regular, currency: text(deal.currency, 3),
    discount_percent: Number(discountPercent.toFixed(4)), latest_checked_at: new Date(checkedTime).toISOString(),
    destination_type: destinationType, destination_url: destination, outbound_url: outbound,
    internal_slug: destinationType === "internal" ? text(deal.internal_slug, 160) || null : null,
    category: text(deal.category, 120) || null, product_type: text(deal.product_type, 120),
    materials: strings(deal.materials), ingredients: strings(deal.ingredients), search_text: text(deal.search_text, 1_000),
  };
}

export function publicDealsPayload(deals, generatedAt = new Date(), stale = false) {
  const sanitized = deals.map(sanitizeConsumerDeal).filter(Boolean);
  return { version: PUBLIC_DEALS_CONTRACT_VERSION, generated_at: generatedAt.toISOString(), stale, count: sanitized.length, deals: sanitized };
}
