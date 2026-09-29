import { loadProducts, type Product } from "./products";
import { createGoogleSheetsHistory, evaluateDiscounts } from "./price-monitor/index.mjs";

const SOFIA_TIME_ZONE = "Europe/Sofia";

type WeekWindow = { week_start: string; week_end: string };
type DiscountEvaluation = {
  entity_type?: string;
  entity_id?: string;
  product_id: string;
  product_name: string;
  brand: string;
  product_url: string;
  weekly_discount_eligible: boolean;
  promotion_confidence: "VERIFIED_PRICE_DROP" | "EXPLICIT_SALE" | "REFERENCE_VALUE_SAVING" | "UNKNOWN";
  promotion_consumer_eligible: boolean;
  current_price: number | null;
  regular_price: number | null;
  currency: string | null;
  discount_amount: number | null;
  discount_percent: number | null;
  latest_checked_at: string | null;
  confidence: string | null;
  extraction_method: string | null;
  regular_price_method: string | null;
};

export type WeeklyDiscountProduct = DiscountEvaluation & { product: Product };
export type ConsumerDeal = DiscountEvaluation & {
  entity_type: "catalog_product" | "observed_product";
  entity_id: string;
  brand_id: number | null;
  title: string;
  image_url: string;
  destination_type: "internal" | "external";
  destination_url: string;
  outbound_url: string;
  destination_label: "Виж продукта" | "Към магазина";
  internal_slug: string | null;
  category: string | null;
  product_type: string;
  materials: string[];
  ingredients: string[];
  search_text: string;
  original_index: number;
};

export const CONSUMER_DEAL_MAX_AGE_HOURS = 72;
export const DEFAULT_CONSUMER_DEALS_EXCLUDED_BRAND_IDS = [43];

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SOFIA_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
});
const timeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SOFIA_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function parts(formatter: Intl.DateTimeFormat, value: Date) {
  return Object.fromEntries(formatter.formatToParts(value).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function localMidnightUtc(year: number, month: number, day: number) {
  const wallClock = Date.UTC(year, month - 1, day);
  let instant = wallClock;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const local = parts(timeFormatter, new Date(instant));
    const representedAsUtc = Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day), Number(local.hour), Number(local.minute), Number(local.second));
    const next = wallClock - (representedAsUtc - instant);
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant);
}

function shiftCalendarDate(year: number, month: number, day: number, days: number) {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

export function getSofiaWeekWindow(now = new Date()): WeekWindow {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error("A valid date is required for the Sofia week window");
  const local = parts(dateFormatter, now);
  const weekday = ({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 } as Record<string, number>)[local.weekday];
  if (weekday == null) throw new Error("Could not resolve Europe/Sofia weekday");
  const monday = shiftCalendarDate(Number(local.year), Number(local.month), Number(local.day), -weekday);
  const nextMonday = shiftCalendarDate(monday.year, monday.month, monday.day, 7);
  return {
    week_start: localMidnightUtc(monday.year, monday.month, monday.day).toISOString(),
    week_end: localMidnightUtc(nextMonday.year, nextMonday.month, nextMonday.day).toISOString(),
  };
}

export function joinWeeklyDiscountProducts(discounts: DiscountEvaluation[], products: Product[]): WeeklyDiscountProduct[] {
  const publicByRowId = new Map(products.map((product) => [String(product.row_id), product]));
  return discounts
    .filter((discount) => discount.weekly_discount_eligible === true)
    .map((discount) => ({ ...discount, product: publicByRowId.get(String(discount.product_id)) }))
    .filter((entry): entry is DiscountEvaluation & { product: Product } => Boolean(entry.product))
    .sort((a, b) => (Number(b.discount_percent) - Number(a.discount_percent))
      || a.product.brand_name.localeCompare(b.product.brand_name, "bg")
      || a.product.name_bg.localeCompare(b.product.name_bg, "bg")
      || String(a.product.row_id).localeCompare(String(b.product.row_id), "en", { numeric: true }));
}

type Dependencies = {
  readHistory?: () => Promise<unknown[]>;
  loadCatalog?: () => Promise<Product[]>;
  evaluate?: (rows: unknown[], window: WeekWindow) => DiscountEvaluation[];
};

async function readPriceHistory() {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || process.env;
  const createHistory = createGoogleSheetsHistory as unknown as (config: {
    spreadsheetId?: string; serviceAccountEmail?: string; privateKey?: string;
  }) => { getValues(range: string): Promise<{ values?: unknown[] }> };
  const history = createHistory({
    spreadsheetId: env.GOOGLE_PRICE_MONITOR_SPREADSHEET_ID,
    serviceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  });
  const response = await history.getValues("Price History!A2:S");
  return response.values || [];
}

async function readBaserowRows(tableId: string) {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || process.env;
  const token = env.BASEROW_API_TOKEN;
  if (!token || !tableId) throw new Error("Baserow read configuration is missing");
  const rows: any[] = [];
  let next: string | null = `https://api.baserow.io/api/database/rows/table/${tableId}/?user_field_names=true&size=200`;
  while (next) {
    const url = new URL(next);
    if (url.hostname !== "api.baserow.io") throw new Error("Unexpected Baserow pagination host");
    url.protocol = "https:";
    const response = await fetch(url, { headers: { Authorization: `Token ${token}` } });
    if (!response.ok) throw new Error(`Baserow read failed (${response.status})`);
    const body = await response.json();
    rows.push(...(body.results || []));
    next = body.next || null;
  }
  return rows;
}

const clean = (value: unknown) => String(value ?? "").trim();
const validPositive = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0;
const active = (value: unknown) => value === true || clean(value).toLowerCase() === "true" || clean(value) === "1";
const validDestination = (value: unknown) => {
  try { const url = new URL(clean(value)); return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname); }
  catch { return false; }
};

export function diversifyConsumerDeals(deals: ConsumerDeal[]) {
  const remaining = [...deals].sort((a, b) => Number(b.discount_percent) - Number(a.discount_percent)
    || Date.parse(String(b.latest_checked_at)) - Date.parse(String(a.latest_checked_at))
    || a.brand.localeCompare(b.brand, "bg") || a.entity_id.localeCompare(b.entity_id, "en", { numeric: true }));
  const result: ConsumerDeal[] = [];
  while (remaining.length) {
    const previousBrand = result.at(-1)?.brand_id;
    const alternative = remaining.findIndex((deal) => deal.brand_id !== previousBrand);
    const index = alternative >= 0 ? alternative : 0;
    result.push(remaining.splice(index, 1)[0]);
  }
  return result.map((deal, original_index) => ({ ...deal, original_index }));
}

export function buildConsumerDeals(evaluations: DiscountEvaluation[], observed: any[], brands: any[], products: Product[], now = new Date()) {
  const observedById = new Map(observed.map((row) => [String(row.id), row]));
  const brandsById = new Map(brands.map((row) => [String(row.id), row]));
  const productsByRowId = new Map(products.map((row) => [String(row.row_id), row]));
  const maxAge = CONSUMER_DEAL_MAX_AGE_HOURS * 3_600_000;
  const cards: ConsumerDeal[] = [];
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || process.env;
  const excludedBrandIds = new Set(String(env.CONSUMER_DEALS_EXCLUDED_BRAND_IDS || DEFAULT_CONSUMER_DEALS_EXCLUDED_BRAND_IDS.join(","))
    .split(",").map((value) => value.trim()).filter(Boolean));
  const brandEligible = (brand: any, brandId: unknown) => brand?.deals_eligible !== false && !excludedBrandIds.has(String(brandId));
  for (const evaluation of evaluations) {
    if (!evaluation.weekly_discount_eligible || evaluation.promotion_consumer_eligible !== true
      || !["VERIFIED_PRICE_DROP", "EXPLICIT_SALE"].includes(evaluation.promotion_confidence)
      || !validPositive(evaluation.current_price) || !validPositive(evaluation.regular_price)
      || Number(evaluation.regular_price) <= Number(evaluation.current_price) || !evaluation.currency || !evaluation.latest_checked_at
      || now.getTime() - Date.parse(evaluation.latest_checked_at) > maxAge || Date.parse(evaluation.latest_checked_at) > now.getTime() + 300_000) continue;
    const entityType = evaluation.entity_type === "observed_product" ? "observed_product" : "catalog_product";
    const entityId = clean(evaluation.entity_id || evaluation.product_id);
    if (entityType === "catalog_product") {
      const product = productsByRowId.get(entityId);
      const brand = product ? brandsById.get(String(product.brand_id)) : null;
      if (!product?.image_urls?.[0] || !product.slug || !product.brand_id || !brandEligible(brand, product.brand_id)) continue;
      cards.push({ ...evaluation, entity_type: entityType, entity_id: entityId, brand_id: product.brand_id, title: product.name_bg,
        image_url: product.image_urls[0], destination_type: "internal", destination_url: `/p/${product.slug}/`, outbound_url: product.product_url,
        destination_label: "Виж продукта", internal_slug: product.slug, category: product.category || null, product_type: product.product_type,
        materials: product.materials, ingredients: product.ingredient,
        search_text: `${product.name_bg} ${product.brand_name}`.toLocaleLowerCase("bg"), original_index: 0 });
      continue;
    }
    const row = observedById.get(entityId); const brand = row ? brandsById.get(String(row.brand_id)) : null;
    if (!row || !brand || !brandEligible(brand, row.brand_id) || !active(row.is_active) || !active(brand.is_active) || clean(row.lifecycle_status) === "inactive") continue;
    const matched = row.bulgaritam_product_id ? productsByRowId.get(String(row.bulgaritam_product_id)) : null;
    const destination = matched ? `/p/${matched.slug}/` : clean(row.canonical_url || row.source_url || evaluation.product_url);
    if ((!matched && !validDestination(destination)) || !clean(row.title) || !validDestination(row.image_url)) continue;
    cards.push({ ...evaluation, entity_type: entityType, entity_id: entityId, brand_id: Number(row.brand_id) || null, title: clean(row.title),
      image_url: clean(row.image_url), destination_type: matched ? "internal" : "external", destination_url: destination,
      outbound_url: matched?.product_url || clean(row.canonical_url || row.source_url || evaluation.product_url),
      destination_label: matched ? "Виж продукта" : "Към магазина", internal_slug: matched?.slug || null,
      category: matched?.category || null, product_type: matched?.product_type || "", materials: matched?.materials || [], ingredients: matched?.ingredient || [],
      search_text: `${clean(row.title)} ${clean(brand.brand_name || evaluation.brand)}`.toLocaleLowerCase("bg"), original_index: 0 });
  }
  const deduped = new Map<string, ConsumerDeal>();
  for (const card of cards) {
    const key = card.internal_slug ? `internal:${card.internal_slug}` : `${card.entity_type}:${card.entity_id}`;
    const current = deduped.get(key);
    if (!current || Date.parse(String(card.latest_checked_at)) > Date.parse(String(current.latest_checked_at))) deduped.set(key, card);
  }
  return diversifyConsumerDeals([...deduped.values()]);
}

export async function loadConsumerDeals(now = new Date(), dependencies: Dependencies & { readObserved?: () => Promise<any[]>; readBrands?: () => Promise<any[]> } = {}) {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || process.env;
  const end = new Date(now.getTime() + 1).toISOString();
  const start = new Date(now.getTime() - CONSUMER_DEAL_MAX_AGE_HOURS * 3_600_000).toISOString();
  const [rows, products, observed, brands] = await Promise.all([
    (dependencies.readHistory || readPriceHistory)(), (dependencies.loadCatalog || loadProducts)(),
    (dependencies.readObserved || (() => readBaserowRows(env.BASEROW_OBSERVED_PRODUCTS_TABLE_ID || "")))(),
    (dependencies.readBrands || (() => readBaserowRows(env.BASEROW_BRANDS_TABLE_ID || "1133942")))(),
  ]);
  const evaluated = (dependencies.evaluate || evaluateDiscounts)(rows, { week_start: start, week_end: end }).filter((entry): entry is DiscountEvaluation => Boolean(entry));
  const deals = buildConsumerDeals(evaluated, observed, brands, products, now);
  const activeSales = evaluated.filter((entry: any) => entry.active_sale === true);
  const freshEligible = evaluated.filter((entry) => entry.weekly_discount_eligible === true);
  return {
    deals, evaluated: evaluated.length, max_age_hours: CONSUMER_DEAL_MAX_AGE_HOURS,
    exclusions: {
      stale: activeSales.filter((entry) => entry.weekly_discount_eligible !== true).length,
      invalid_or_insufficient: Math.max(0, freshEligible.length - deals.length),
    },
  };
}

export async function loadWeeklyDiscountProducts(now = new Date(), dependencies: Dependencies = {}) {
  const window = getSofiaWeekWindow(now);
  const readHistory = dependencies.readHistory || readPriceHistory;
  const loadCatalog = dependencies.loadCatalog || loadProducts;
  const evaluate = dependencies.evaluate || evaluateDiscounts;
  const [rows, products] = await Promise.all([readHistory(), loadCatalog()]);
  const evaluated = evaluate(rows, window).filter((entry): entry is DiscountEvaluation => Boolean(entry));
  return { ...window, products: joinWeeklyDiscountProducts(evaluated, products) };
}

export function formatDiscountMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("bg-BG", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

export function formatDiscountPercent(value: number) {
  return `−${Math.round(value)}%`;
}
