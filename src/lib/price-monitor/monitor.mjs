import { extractPrice } from "./extract.mjs";
import { detectPlatform } from "./platform.mjs";
import { normalizeCurrency, parsePrice, pricesEqual } from "./normalize.mjs";
import { extractProductMetadata } from "./product-metadata.mjs";
import { entityIdentity } from "./entity-identity.mjs";
import { extractPromotionSemanticEvidence } from "./promotion-semantics.mjs";
import { extractShopifyMarketEvidence, shopifyMarketUrl, validateShopifyMarket } from "./shopify-market.mjs";

const DEFAULT_HEADERS = {
  Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
  "Accept-Language": "bg-BG,bg;q=0.9,en;q=0.7",
  "User-Agent": "BulgaritamPriceMonitor/1.0 (+https://bulgaritam.bg/; contact: info@bulgaritam.bg)",
};

export async function fetchProductPage(url, { fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { headers: DEFAULT_HEADERS, redirect: "follow", signal: controller.signal });
    const html = await response.text();
    return { httpStatus: response.status, finalUrl: response.url || url, redirected: response.redirected === true, headers: Object.fromEntries(response.headers?.entries?.() || []), html };
  } finally { clearTimeout(timer); }
}

function baseResult(product) {
  const identity = entityIdentity(product);
  return {
    ...identity,
    product_id: product.product_id ?? product.id ?? null,
    product_slug: product.product_slug ?? product.slug ?? null,
    product_name: product.product_name ?? product.name_bg ?? product.name ?? null,
    brand_name: product.brand_name ?? product.brand ?? null,
    product_url: product.product_url,
    checked_at: new Date().toISOString(),
    http_status: null, final_url: product.product_url, detected_price: null, currency: null,
    regular_price: null, regular_price_currency: null, regular_price_method: null, regular_price_evidence: null,
    extraction_tier: null, extraction_method: null, detected_platform: "unknown", confidence: null,
    status: "error", extraction_status: null, extraction_outcome: null, redirected: false, previous_offer_price: parsePrice(product.offer_price_amount),
    previous_offer_currency: normalizeCurrency(product.offer_price_currency), price_changed: null,
    previous_offer_status: String(product.offer_price_status?.value ?? product.offer_price_status ?? "unverified").trim() || "unverified",
    currency_mismatch: false, error_reason: null, evidence: null,
    title: null, image_url: null, canonical_url: null, availability: null, sku: null, external_product_id: null, metadata_method: null,
  };
}

export async function monitorProduct(product, options = {}) {
  const result = baseResult(product);
  if (!/^https?:\/\//i.test(String(product.product_url || ""))) return { ...result, error_reason: "invalid_product_url" };
  try {
    let page = options.page || await fetchProductPage(product.product_url, options);
    let platform = detectPlatform(page.html || "", page.headers || {});
    const intendedShopifyCountry = String(options.intendedShopifyCountry || "BG").trim().toUpperCase();
    let shopifyMarketEvidence = platform === "shopify" ? extractShopifyMarketEvidence(page.html || "") : null;
    if (!options.page && platform === "shopify" && shopifyMarketEvidence?.shopify_country !== intendedShopifyCountry) {
      const marketUrl = shopifyMarketUrl(page.finalUrl || product.product_url, intendedShopifyCountry);
      page = await fetchProductPage(marketUrl, options);
      platform = detectPlatform(page.html || "", page.headers || {});
      shopifyMarketEvidence = platform === "shopify" ? extractShopifyMarketEvidence(page.html || "") : null;
    }
    result.http_status = page.httpStatus; result.final_url = page.finalUrl || product.product_url;
    result.detected_platform = platform;
    if ([404, 410].includes(page.httpStatus)) return { ...result, status: "dead_url", error_reason: `http_${page.httpStatus}` };
    if ([401, 403, 429].includes(page.httpStatus)) return { ...result, status: "blocked", error_reason: `http_${page.httpStatus}` };
    if (page.httpStatus < 200 || page.httpStatus >= 400) return { ...result, status: "error", error_reason: `http_${page.httpStatus}` };
    const extracted = extractPrice(page.html || "", { url: result.final_url, platform: result.detected_platform });
    const metadata = extractProductMetadata(page.html || "", { url: result.final_url });
    const promotionSemantics = extractPromotionSemanticEvidence({ html: page.html || "", productName: metadata.title || result.product_name, regularPriceMethod: extracted.regular_price_method });
    const regularPriceEvidence = extracted.regular_price_evidence == null ? null
      : typeof extracted.regular_price_evidence === "object"
        ? { ...extracted.regular_price_evidence, promotion_semantics: promotionSemantics }
        : { source_evidence: extracted.regular_price_evidence, promotion_semantics: promotionSemantics };
    Object.assign(result, {
      ...metadata,
      detected_price: extracted.price ?? null, currency: extracted.currency ?? null,
      regular_price: extracted.regular_price ?? null,
      regular_price_currency: extracted.regular_price_currency ?? null,
      regular_price_method: extracted.regular_price_method ?? null,
      regular_price_evidence: regularPriceEvidence,
      extraction_tier: extracted.tier ?? null, extraction_method: extracted.method ?? null,
      extraction_outcome: extracted.outcome ?? null,
      confidence: extracted.confidence ?? null, evidence: { ...(extracted.evidence || {}), diagnostics: extracted.diagnostics || null },
      error_reason: extracted.reason ?? null,
    });
    if (result.detected_platform === "shopify") {
      const marketValidation = validateShopifyMarket({
        evidence: { ...shopifyMarketEvidence, requested_country: intendedShopifyCountry },
        intendedCountry: intendedShopifyCountry,
        detectedCurrency: result.currency,
        regularCurrency: result.regular_price_currency,
        expectedCurrency: result.previous_offer_currency || (intendedShopifyCountry === "BG" ? "EUR" : null),
      });
      result.evidence = { ...(result.evidence || {}), shopify_market: marketValidation };
      if (result.regular_price_evidence && typeof result.regular_price_evidence === "object") {
        result.regular_price_evidence = { ...result.regular_price_evidence, shopify_market: marketValidation };
      }
      if (!marketValidation.valid) {
        result.status = "ambiguous";
        result.extraction_status = "ambiguous";
        result.currency_mismatch = /currency/.test(marketValidation.reason || "");
        result.price_changed = null;
        result.error_reason = marketValidation.reason;
        result.confidence = "low";
        return result;
      }
    }
    const redirected = page.redirected === true;
    result.redirected = redirected;
    if (extracted.status) result.extraction_status = extracted.status;
    if (redirected) result.status = "redirected";
    else if (extracted.status) result.status = extracted.status;
    else if (result.detected_price != null) {
      if (result.previous_offer_price == null) result.status = "verified";
      else if (result.previous_offer_currency && result.currency && result.previous_offer_currency !== result.currency) {
        result.status = "ambiguous"; result.currency_mismatch = true; result.error_reason = "currency_mismatch";
      } else {
        result.price_changed = !pricesEqual(result.detected_price, result.previous_offer_price);
        result.status = result.price_changed ? "changed" : "verified";
      }
    }
    if (!result.extraction_status) result.extraction_status = result.detected_price != null ? (result.price_changed ? "changed" : "verified") : result.status;
    return result;
  } catch (error) {
    return { ...result, status: "error", error_reason: error?.name === "AbortError" ? "timeout" : String(error?.message || error) };
  }
}

export async function monitorBatch(products, { concurrency = 5, ...options } = {}) {
  const results = new Array(products.length); let cursor = 0;
  async function worker() { while (cursor < products.length) { const index = cursor++; results[index] = await monitorProduct(products[index], options); } }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), products.length || 1) }, worker));
  return results;
}
