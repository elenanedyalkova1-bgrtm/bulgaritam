export const VERIFIED_OFFER_STATUSES = ["unverified", "verified_current", "change_pending", "stale", "source_unavailable", "revoked"] as const;
export type VerifiedOfferStatus = typeof VERIFIED_OFFER_STATUSES[number];

export const VERIFIED_OFFER_SOURCES = [
  "monitor_json_ld_product_offer",
  "monitor_product_meta",
  "monitor_schema_microdata",
  "manual_external_product_page",
] as const;
export type VerifiedOfferSource = typeof VERIFIED_OFFER_SOURCES[number];

export const AUTOMATIC_CANDIDATE_METHODS = new Map<string, VerifiedOfferSource>([
  ["json_ld_product_offer", "monitor_json_ld_product_offer"],
  ["open_graph_product_price", "monitor_product_meta"],
  ["schema_microdata_price", "monitor_schema_microdata"],
] as const);

export const DEFAULT_OFFER_FRESHNESS_DAYS = 14;

export type PublishableOffer = {
  amount: number;
  currency: string;
  verifiedAt: string;
  source: VerifiedOfferSource;
  sourceUrl: string;
  seller: { name: string; url: string | null };
};

export type ManualPriceInput = {
  manual_price_amount?: unknown;
  manual_price_currency?: unknown;
  manual_price_verified_at?: unknown;
  manual_price_source_url?: unknown;
};
export type ManualPriceAction = "save" | "confirm" | "clear";
export type CatalogPriceAction = "save" | "confirm";

const text = (value: unknown) => String(value ?? "").trim();
const selectValue = (value: unknown) => text(value && typeof value === "object" && "value" in value ? (value as { value?: unknown }).value : value);
const amount = (value: unknown) => {
  const parsed = Number(text(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

export function isIso4217Currency(value: unknown): boolean {
  return /^[A-Z]{3}$/.test(text(value).toUpperCase());
}

export function validExternalProductUrl(value: unknown, siteOrigin = "https://bulgaritam.bg"): string | null {
  try {
    const url = new URL(text(value));
    const site = new URL(siteOrigin);
    if (!["http:", "https:"].includes(url.protocol) || url.hostname === site.hostname || url.hostname.endsWith(`.${site.hostname}`)) return null;
    return url.toString();
  } catch { return null; }
}

export function normalizedProductUrl(value: unknown, siteOrigin?: string): string | null {
  const external = validExternalProductUrl(value, siteOrigin);
  if (!external) return null;
  const url = new URL(external);
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  return `${hostname}${pathname}`;
}

export function buildManualPriceMutation(
  product: Record<string, any>, input: ManualPriceInput, action: ManualPriceAction,
  now: Date | number = new Date(), options: { siteOrigin?: string } = {},
): Record<string, unknown> {
  if (action === "clear") {
    const mutation: Record<string, unknown> = { manual_price_amount: null, manual_price_currency: "", manual_price_verified_at: null, manual_price_source_url: "" };
    if (selectValue(product.offer_price_source) === "manual_external_product_page") Object.assign(mutation, {
      offer_price_amount: null, offer_price_currency: "", offer_price_verified_at: null,
      offer_price_source: null, offer_price_source_url: "", offer_price_status: "revoked",
    });
    return mutation;
  }
  const rawAmount = text(input.manual_price_amount);
  const currency = text(input.manual_price_currency).toUpperCase();
  const rawSourceUrl = text(input.manual_price_source_url);
  const existingVerifiedAt = text(input.manual_price_verified_at);
  if (!rawAmount && !currency && !rawSourceUrl && !existingVerifiedAt) return {
    manual_price_amount: null, manual_price_currency: "", manual_price_verified_at: null, manual_price_source_url: "",
  };
  const parsedAmount = amount(rawAmount);
  if (parsedAmount == null || parsedAmount <= 0) throw new Error("Manual price must be a positive exact amount.");
  if (!isIso4217Currency(currency)) throw new Error("Manual price currency must be a three-letter ISO 4217 code.");
  const catalogCurrency = text(product.currency).toUpperCase();
  if (catalogCurrency && isIso4217Currency(catalogCurrency) && currency !== catalogCurrency) throw new Error(`Manual price currency (${currency}) conflicts with the Product currency (${catalogCurrency}).`);
  const sourceUrl = validExternalProductUrl(rawSourceUrl, options.siteOrigin);
  const canonicalUrl = validExternalProductUrl(product.product_url, options.siteOrigin);
  if (!sourceUrl) throw new Error("Manual price source must be a valid external product URL.");
  if (!canonicalUrl || normalizedProductUrl(sourceUrl, options.siteOrigin) !== normalizedProductUrl(canonicalUrl, options.siteOrigin)) throw new Error("Manual price source must match the Product external URL (query parameters and trailing slash may differ).");
  const base: Record<string, unknown> = { manual_price_amount: parsedAmount, manual_price_currency: currency, manual_price_verified_at: existingVerifiedAt || null, manual_price_source_url: sourceUrl };
  if (action === "save") return base;
  const currentMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(currentMs)) throw new Error("Manual verification time is invalid.");
  const verifiedAt = new Date(currentMs).toISOString();
  return { ...base, manual_price_verified_at: verifiedAt, offer_price_amount: parsedAmount, offer_price_currency: currency, offer_price_verified_at: verifiedAt, offer_price_source: "manual_external_product_page", offer_price_source_url: sourceUrl, offer_price_status: "verified_current" };
}

/**
 * Converts an intentional catalog price entry into the single authoritative
 * Offer snapshot. Unchanged values on an ordinary Product save are a no-op, so
 * unrelated edits can never refresh price verification freshness.
 */
export function buildCatalogPriceMutation(
  product: Record<string, any>,
  input: { exact_price?: unknown; currency?: unknown; source_url?: unknown },
  action: CatalogPriceAction = "save",
  now: Date | number = new Date(),
  options: { siteOrigin?: string } = {},
): Record<string, unknown> {
  const rawAmount = text(input.exact_price);
  if (!rawAmount) {
    if (action === "confirm") throw new Error("Exact current price is required before confirmation.");
    return {};
  }
  const parsedAmount = amount(rawAmount);
  const currency = text(input.currency || product.currency).toUpperCase();
  const canonicalUrl = validExternalProductUrl(product.product_url, options.siteOrigin);
  const sourceUrl = validExternalProductUrl(input.source_url || product.product_url, options.siteOrigin);
  if (parsedAmount == null || parsedAmount <= 0) throw new Error("Exact current price must be a positive amount.");
  if (!isIso4217Currency(currency)) throw new Error("Exact current price currency must be a three-letter ISO 4217 code.");
  const productCurrency = text(product.currency).toUpperCase();
  if (productCurrency && isIso4217Currency(productCurrency) && currency !== productCurrency) throw new Error(`Exact price currency (${currency}) conflicts with the Product currency (${productCurrency}).`);
  if (!canonicalUrl) throw new Error("Product URL must be a valid external official product URL.");
  if (!sourceUrl || normalizedProductUrl(sourceUrl, options.siteOrigin) !== normalizedProductUrl(canonicalUrl, options.siteOrigin)) throw new Error("Exact price source must match the Product canonical external URL.");

  const unchanged = amount(product.offer_price_amount) === parsedAmount
    && text(product.offer_price_currency).toUpperCase() === currency
    && normalizedProductUrl(product.offer_price_source_url, options.siteOrigin) === normalizedProductUrl(sourceUrl, options.siteOrigin);
  if (action === "save" && unchanged) return {};

  const currentMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(currentMs)) throw new Error("Catalog price verification time is invalid.");
  return {
    offer_price_amount: parsedAmount,
    offer_price_currency: currency,
    offer_price_verified_at: new Date(currentMs).toISOString(),
    offer_price_source: "manual_external_product_page",
    offer_price_source_url: sourceUrl,
    offer_price_status: "verified_current",
  };
}

export function resolvePublishableOffer(product: Record<string, any>, now: Date | number = new Date(), options: {
  freshnessDays?: number;
  siteOrigin?: string;
  visible?: boolean;
} = {}): PublishableOffer | null {
  if (selectValue(product.offer_price_status) !== "verified_current") return null;
  const parsedAmount = amount(product.offer_price_amount);
  const currency = text(product.offer_price_currency).toUpperCase();
  const verifiedAt = text(product.offer_price_verified_at);
  const verifiedMs = Date.parse(verifiedAt);
  const source = selectValue(product.offer_price_source) as VerifiedOfferSource;
  const sourceUrl = validExternalProductUrl(product.offer_price_source_url, options.siteOrigin);
  const canonicalProductUrl = validExternalProductUrl(product.product_url, options.siteOrigin);
  const brandName = text(product.brand_name);
  const brandUrl = validExternalProductUrl(product.website_url || product.brand_url, options.siteOrigin);
  const currentMs = now instanceof Date ? now.getTime() : Number(now);
  const ttlMs = (options.freshnessDays ?? DEFAULT_OFFER_FRESHNESS_DAYS) * 86_400_000;

  if (parsedAmount == null || parsedAmount <= 0) return null;
  if (!isIso4217Currency(currency)) return null;
  if (!Number.isFinite(verifiedMs) || !Number.isFinite(currentMs) || verifiedMs > currentMs || currentMs - verifiedMs > ttlMs) return null;
  if (!VERIFIED_OFFER_SOURCES.includes(source)) return null;
  if (!sourceUrl || !canonicalProductUrl || normalizedProductUrl(sourceUrl, options.siteOrigin) !== normalizedProductUrl(canonicalProductUrl, options.siteOrigin) || !brandName) return null;
  if (options.visible === false) return null;

  return { amount: parsedAmount, currency, verifiedAt: new Date(verifiedMs).toISOString(), source, sourceUrl, seller: { name: brandName, url: brandUrl } };
}

export function candidateFromMonitorResult(result: Record<string, any>, product: Record<string, any>, options: { siteOrigin?: string } = {}) {
  const source = AUTOMATIC_CANDIDATE_METHODS.get(result.extraction_method);
  const detectedAmount = amount(result.detected_price);
  const currency = text(result.currency).toUpperCase();
  const sourceUrl = validExternalProductUrl(result.final_url || result.product_url, options.siteOrigin);
  const canonicalProductUrl = validExternalProductUrl(product.product_url, options.siteOrigin);
  const pageIdentity = result.evidence?.diagnostics?.page_identity || {};
  const selectedProduct = result.evidence?.diagnostics?.selected_product || {};
  const productName = text(product.product_name || product.name_bg).toLocaleLowerCase("bg");
  const titleMatches = productName && text(pageIdentity.title).toLocaleLowerCase("bg").includes(productName);
  const canonicalMatches = canonicalProductUrl && normalizedProductUrl(pageIdentity.canonical || sourceUrl, options.siteOrigin) === normalizedProductUrl(canonicalProductUrl, options.siteOrigin);
  const strongIdentity = result.extraction_method === "json_ld_product_offer"
    ? Number(selectedProduct.score) >= 25 && Number(result.evidence?.candidate_count) >= 1 && Boolean(result.evidence?.path)
    : Boolean(canonicalMatches && (titleMatches || pageIdentity.canonical));
  if (!source || result.confidence !== "high" || !["verified", "changed"].includes(result.status) || result.currency_mismatch === true) return null;
  if (detectedAmount == null || detectedAmount <= 0 || !isIso4217Currency(currency) || !sourceUrl || !strongIdentity) return null;
  if (result.redirected && normalizedProductUrl(canonicalProductUrl, options.siteOrigin) !== normalizedProductUrl(sourceUrl, options.siteOrigin)) return null;
  if (!text(product.brand_name)) return null;
  return { amount: detectedAmount, currency, verifiedAt: result.checked_at, source, sourceUrl, evidence: result.evidence, historyRowId: result.history_row_id ?? null };
}

export function offerJsonLd(offer: PublishableOffer) {
  return {
    "@type": "Offer",
    url: offer.sourceUrl,
    price: offer.amount,
    priceCurrency: offer.currency,
    seller: { "@type": "Organization", name: offer.seller.name, url: offer.seller.url || undefined },
  };
}

export function formatVerifiedOfferAmount(offer: PublishableOffer, locale = "bg-BG") {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(offer.amount)} ${offer.currency}`;
}
