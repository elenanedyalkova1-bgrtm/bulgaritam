export const PRICE_HEALTH_STATUSES = ["verified", "changed", "ambiguous", "not_detected", "blocked", "dead_url", "redirected", "browser_required", "error"] as const;
export type PriceHealthStatus = typeof PRICE_HEALTH_STATUSES[number] | "unmonitored";

export type PriceHealthRow = {
  id: number; product: string; brand: string; brandId: number | null; productUrl: string;
  currentOfferPrice: number | null; currentOfferCurrency: string | null;
  detectedPrice: number | null; detectedCurrency: string | null; difference: number | null;
  currencyMatches: boolean | null; status: PriceHealthStatus; confidence: string | null;
  extractionMethod: string | null; lastChecked: string | null; lastCheckedMs: number | null;
};

const text = (value: unknown) => String(value ?? "").trim();
const selectValue = (value: unknown) => text(typeof value === "object" && value !== null && "value" in value ? (value as any).value : value);
const amount = (value: unknown) => {
  const normalized = text(value).replace(/\s/g, "").replace(",", ".");
  const parsed = normalized ? Number(normalized) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};
const timestamp = (value: unknown) => {
  const parsed = Date.parse(text(value)); return Number.isFinite(parsed) ? parsed : null;
};

export function normalizePriceHealthRow(product: any, brand?: any): PriceHealthRow {
  const currentOfferPrice = amount(product.offer_price_amount);
  const detectedPrice = amount(product.price_detected_amount);
  const currentOfferCurrency = text(product.offer_price_currency) || null;
  const detectedCurrency = text(product.price_detected_currency) || null;
  const currencyMatches = currentOfferCurrency && detectedCurrency ? currentOfferCurrency === detectedCurrency : null;
  const difference = currentOfferPrice != null && detectedPrice != null && currencyMatches
    ? Math.round((detectedPrice - currentOfferPrice) * 10_000) / 10_000 : null;
  const rawStatus = selectValue(product.price_check_status);
  const status = PRICE_HEALTH_STATUSES.includes(rawStatus as any) ? rawStatus as PriceHealthStatus : "unmonitored";
  const lastChecked = text(product.price_last_checked_at) || null;
  return {
    id: Number(product.id), product: text(product.name_bg) || `Row #${product.id}`, brand: text(brand?.brand_name || product.brand_name) || "—",
    brandId: Number(brand?.id || product.brand_ref?.[0]?.id) || null, productUrl: text(product.product_url),
    currentOfferPrice, currentOfferCurrency, detectedPrice, detectedCurrency, difference, currencyMatches, status,
    confidence: selectValue(product.price_confidence) || null, extractionMethod: text(product.price_extraction_method) || null,
    lastChecked, lastCheckedMs: timestamp(lastChecked),
  };
}

export function priceHealthOverview(rows: PriceHealthRow[], { now = Date.now(), staleDays = 7 } = {}) {
  const staleBefore = now - staleDays * 86_400_000;
  const count = (status: PriceHealthStatus) => rows.filter((row) => row.status === status).length;
  return {
    totalMonitored: rows.filter((row) => row.status !== "unmonitored" || row.lastCheckedMs != null).length,
    verified: count("verified"), changed: count("changed"), needsReview: count("ambiguous"), notDetected: count("not_detected"),
    blocked: count("blocked"), deadUrls: count("dead_url"), redirected: count("redirected"),
    notCheckedRecently: rows.filter((row) => row.lastCheckedMs != null && row.lastCheckedMs < staleBefore).length,
    neverChecked: rows.filter((row) => row.lastCheckedMs == null).length,
  };
}

export function filterAndSortPriceHealthRows(rows: PriceHealthRow[], options: {
  status?: string; brandId?: number; confidence?: string; checked?: string; sort?: string; now?: number; staleDays?: number;
} = {}) {
  const now = options.now ?? Date.now(); const staleDays = options.staleDays ?? 7; const staleBefore = now - staleDays * 86_400_000;
  const recentCutoffs: Record<string, number> = { "24h": now - 86_400_000, "7d": now - 7 * 86_400_000, "30d": now - 30 * 86_400_000 };
  const filtered = rows.filter((row) => !options.status || options.status === "all" || row.status === options.status)
    .filter((row) => !options.brandId || row.brandId === options.brandId)
    .filter((row) => !options.confidence || options.confidence === "all" || row.confidence === options.confidence)
    .filter((row) => {
      if (!options.checked || options.checked === "all") return true;
      if (options.checked === "never") return row.lastCheckedMs == null;
      if (options.checked === "stale") return row.lastCheckedMs != null && row.lastCheckedMs < staleBefore;
      return row.lastCheckedMs != null && row.lastCheckedMs >= (recentCutoffs[options.checked] ?? 0);
    });
  const oldest = (value: number | null) => value ?? Number.POSITIVE_INFINITY;
  const newest = (value: number | null) => value ?? Number.NEGATIVE_INFINITY;
  return filtered.sort((a, b) => {
    if (options.sort === "oldest_verification") {
      const rank = Number(b.status === "verified") - Number(a.status === "verified");
      return rank || oldest(a.lastCheckedMs) - oldest(b.lastCheckedMs) || a.product.localeCompare(b.product, "bg");
    }
    if (options.sort === "largest_difference") {
      const magnitude = (value: number | null) => value == null ? Number.NEGATIVE_INFINITY : Math.abs(value);
      return magnitude(b.difference) - magnitude(a.difference) || newest(b.lastCheckedMs) - newest(a.lastCheckedMs);
    }
    const rank = Number(b.status === "changed") - Number(a.status === "changed");
    return rank || newest(b.lastCheckedMs) - newest(a.lastCheckedMs) || a.product.localeCompare(b.product, "bg");
  });
}
