import { fetchProductPage, monitorProduct } from "./monitor.mjs";

const TRANSIENT_HTTP = new Set([408, 425, 500, 502, 503, 504]);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const positiveFinite = (value) => {
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export function canaryComparison(authoritativePrice, detectedPrice) {
  const authoritative = positiveFinite(authoritativePrice); const detected = positiveFinite(detectedPrice);
  return {
    authoritative_price: authoritative,
    difference: authoritative != null && detected != null ? Math.round((detected - authoritative) * 10_000) / 10_000 : null,
  };
}

export function approvedFallbackFetchFailure(outcome) {
  if (outcome?.error) return ["timeout", "fetch failed", "network_error"].includes(outcome.error) || outcome.error.startsWith("network:");
  return outcome?.page?.httpStatus === 403 || TRANSIENT_HTTP.has(outcome?.page?.httpStatus);
}

function fetchError(error) {
  return error?.name === "AbortError" ? "timeout" : `network:${String(error?.message || error)}`;
}

export async function directFetchWithRetry(productUrl, { fetchPage = fetchProductPage, retries = 2, sleep = delay, timeoutMs = 15_000, onRetry } = {}) {
  let outcome;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try { outcome = { page: await fetchPage(productUrl, { timeoutMs }), error: null, attempts: attempt + 1 }; }
    catch (error) { outcome = { page: null, error: fetchError(error), attempts: attempt + 1 }; }
    const transient = Boolean(outcome.error) || TRANSIENT_HTTP.has(outcome.page?.httpStatus);
    if (!transient || attempt === retries) return outcome;
    const retryDelay = 1_000 * (2 ** attempt);
    onRetry?.({ attempt: attempt + 1, delay: retryDelay, outcome });
    await sleep(retryDelay);
  }
  return outcome;
}

export async function runAppsScriptCanaryProduct(product, { fallbackProvider, fetchPage, retries = 2, sleep, timeoutMs, onRetry } = {}) {
  const direct = await directFetchWithRetry(product.product_url, { fetchPage, retries, sleep, timeoutMs, onRetry });
  const fallbackAttempted = approvedFallbackFetchFailure(direct);
  const directCanonical = direct.page
    ? await monitorProduct(product, { page: direct.page })
    : await monitorProduct(product, { fetchImpl: async () => { throw new Error(direct.error || "network_error"); } });
  let fallbackPage = null; let fallbackError = null; let canonical = directCanonical;
  if (fallbackAttempted) {
    if (typeof fallbackProvider !== "function") throw new Error("Apps Script fallback provider is required");
    try { fallbackPage = await fallbackProvider(product); canonical = await monitorProduct(product, { page: fallbackPage }); }
    catch (error) { fallbackError = String(error?.message || error); }
  }
  return { direct, directCanonical, fallbackAttempted, fallbackPage, fallbackError, canonical };
}

export const monitorProductWithAppsScriptFallback = runAppsScriptCanaryProduct;
