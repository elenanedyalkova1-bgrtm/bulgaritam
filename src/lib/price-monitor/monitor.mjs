import { extractPrice } from "./extract.mjs";
import { detectPlatform } from "./platform.mjs";
import { normalizeCurrency, parsePrice, pricesEqual } from "./normalize.mjs";

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
  return {
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
  };
}

export async function monitorProduct(product, options = {}) {
  const result = baseResult(product);
  if (!/^https?:\/\//i.test(String(product.product_url || ""))) return { ...result, error_reason: "invalid_product_url" };
  try {
    const page = options.page || await fetchProductPage(product.product_url, options);
    result.http_status = page.httpStatus; result.final_url = page.finalUrl || product.product_url;
    result.detected_platform = detectPlatform(page.html || "", page.headers || {});
    if ([404, 410].includes(page.httpStatus)) return { ...result, status: "dead_url", error_reason: `http_${page.httpStatus}` };
    if ([401, 403, 429].includes(page.httpStatus)) return { ...result, status: "blocked", error_reason: `http_${page.httpStatus}` };
    if (page.httpStatus < 200 || page.httpStatus >= 400) return { ...result, status: "error", error_reason: `http_${page.httpStatus}` };
    const extracted = extractPrice(page.html || "", { url: result.final_url, platform: result.detected_platform });
    Object.assign(result, {
      detected_price: extracted.price ?? null, currency: extracted.currency ?? null,
      regular_price: extracted.regular_price ?? null,
      regular_price_currency: extracted.regular_price_currency ?? null,
      regular_price_method: extracted.regular_price_method ?? null,
      regular_price_evidence: extracted.regular_price_evidence ?? null,
      extraction_tier: extracted.tier ?? null, extraction_method: extracted.method ?? null,
      extraction_outcome: extracted.outcome ?? null,
      confidence: extracted.confidence ?? null, evidence: { ...(extracted.evidence || {}), diagnostics: extracted.diagnostics || null },
      error_reason: extracted.reason ?? null,
    });
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
