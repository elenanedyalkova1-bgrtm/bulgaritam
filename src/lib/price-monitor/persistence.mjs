import { normalizeCurrency, parsePrice, pricesEqual } from "./normalize.mjs";

const PROTECTED_FIELDS = new Set([
  "price_min_eur", "price_max_eur",
  "offer_price_amount", "offer_price_currency", "offer_price_verified_at", "offer_price_source", "offer_price_source_url",
]);
const CURRENT_FIELDS = new Set([
  "price_last_checked_at", "price_check_status", "price_detected_amount", "price_detected_currency",
  "price_extraction_method", "price_confidence", "price_change_detected",
  "offer_price_status",
]);
const RENEWAL_FIELDS = new Set(["offer_price_verified_at"]);
const APPROVED_RENEWAL_METHODS = new Map([
  ["json_ld_product_offer", "monitor_json_ld_product_offer"],
  ["open_graph_product_price", "monitor_product_meta"],
  ["schema_microdata_price", "monitor_schema_microdata"],
]);
const APPROVED_AUTHORITATIVE_SOURCES = new Set([
  ...APPROVED_RENEWAL_METHODS.values(),
  "manual_external_product_page",
]);

function finiteOrNull(value) { return Number.isFinite(value) ? value : null; }
function selectValue(value) { return String(value && typeof value === "object" ? value.value : value ?? "").trim(); }
function normalizedProductUrl(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    return `${hostname}${pathname}`;
  } catch { return null; }
}
function successfulHttpStatus(value) { return Number.isInteger(value) && value >= 200 && value < 400; }

function hasApprovedProductIdentity(result, canonicalProductUrl) {
  const pageIdentity = result.evidence?.diagnostics?.page_identity || {};
  const selectedProduct = result.evidence?.diagnostics?.selected_product || {};
  const sourceUrl = normalizedProductUrl(result.final_url || result.product_url);
  const pageCanonical = normalizedProductUrl(pageIdentity.canonical || result.final_url || result.product_url);
  const canonicalMatches = Boolean(canonicalProductUrl && sourceUrl === canonicalProductUrl && pageCanonical === canonicalProductUrl);
  if (result.extraction_method === "json_ld_product_offer") {
    return canonicalMatches
      && Number(selectedProduct.score) >= 25
      && Number(result.evidence?.candidate_count) >= 1
      && Boolean(result.evidence?.path);
  }
  const productName = String(result.product_name ?? "").trim().toLocaleLowerCase("bg");
  const pageTitle = String(pageIdentity.title ?? "").trim().toLocaleLowerCase("bg");
  const titleMatches = Boolean(productName && pageTitle.includes(productName));
  return canonicalMatches && Boolean(titleMatches || pageIdentity.canonical);
}

/**
 * Builds the only permitted authoritative mutation for an unchanged, freshly
 * verified Offer. It deliberately cannot alter amount, currency, source, URL,
 * status, or any catalog range field.
 */
export function buildAuthoritativeRenewal(result) {
  const methodSource = APPROVED_RENEWAL_METHODS.get(result.extraction_method);
  const authoritativeSource = selectValue(result.previous_offer_source);
  const authoritativeAmount = parsePrice(result.previous_offer_price);
  const detectedAmount = parsePrice(result.detected_price);
  const authoritativeCurrency = normalizeCurrency(result.previous_offer_currency);
  const detectedCurrency = normalizeCurrency(result.currency);
  const productUrl = normalizedProductUrl(result.product_url);
  const sourceUrl = normalizedProductUrl(result.previous_offer_source_url);
  const checkedAt = String(result.checked_at ?? "").trim();

  if (result.observation_origin !== "fresh_monitor_check" || !successfulHttpStatus(result.http_status)) return null;
  if (!methodSource || result.confidence !== "high" || result.status !== "verified" || result.extraction_status === "ambiguous") return null;
  if (result.extraction_outcome === "variation_range" || result.currency_mismatch === true || result.price_changed !== false) return null;
  if (selectValue(result.previous_offer_status) !== "verified_current") return null;
  if (!APPROVED_AUTHORITATIVE_SOURCES.has(authoritativeSource)) return null;
  if (authoritativeSource !== "manual_external_product_page" && authoritativeSource !== methodSource) return null;
  if (authoritativeAmount == null || detectedAmount == null || !pricesEqual(authoritativeAmount, detectedAmount)) return null;
  if (!authoritativeCurrency || !detectedCurrency || authoritativeCurrency !== detectedCurrency) return null;
  if (!productUrl || !sourceUrl || productUrl !== sourceUrl || !hasApprovedProductIdentity(result, productUrl)) return null;
  if (result.redirected === true && normalizedProductUrl(result.final_url) !== productUrl) return null;
  if (result.detected_platform === "shopify" && result.evidence?.shopify_market?.valid !== true) return null;
  if (result.evidence?.shopify_market?.valid === false) return null;
  const checkedMs = Date.parse(checkedAt);
  if (!Number.isFinite(checkedMs)) return null;
  return { offer_price_verified_at: new Date(checkedMs).toISOString() };
}

export function persistenceStatus(result) {
  if (["dead_url", "blocked", "redirected", "error", "browser_required", "not_detected", "ambiguous"].includes(result.status)) return result.status;
  if (["verified", "changed"].includes(result.status) && result.confidence !== "high") return "ambiguous";
  if (result.confidence === "high" && result.previous_offer_price != null && result.detected_price != null) {
    if (result.currency_mismatch) return "ambiguous";
    return result.price_changed ? "changed" : "verified";
  }
  return result.status || result.extraction_status || "error";
}

export function buildPersistencePlan(result) {
  if (result.product_id == null) throw new Error("Persistence requires product_id");
  const status = persistenceStatus(result);
  const confirmedChange = result.confidence === "high" && status === "changed" && result.price_changed === true;
  const previousOfferStatus = String(result.previous_offer_status ?? "unverified").trim();
  let nextOfferStatus = previousOfferStatus;
  if (confirmedChange && ["verified_current", "change_pending"].includes(previousOfferStatus)) nextOfferStatus = "change_pending";
  if (status === "dead_url" && ["verified_current", "change_pending"].includes(previousOfferStatus)) nextOfferStatus = "source_unavailable";
  const current = {
    price_last_checked_at: result.checked_at,
    price_check_status: status,
    price_change_detected: confirmedChange,
    offer_price_status: nextOfferStatus,
  };
  const detectedAmount = finiteOrNull(result.detected_price);
  if (detectedAmount != null) {
    current.price_detected_amount = detectedAmount;
    current.price_detected_currency = result.currency || null;
    current.price_extraction_method = result.extraction_method || null;
    current.price_confidence = result.confidence || null;
  }
  assertSafePayload(current, CURRENT_FIELDS);
  return { product_id: result.product_id, current, authoritative_renewal: buildAuthoritativeRenewal(result) };
}

function assertSafePayload(payload, allowlist) {
  for (const key of Object.keys(payload)) {
    if (PROTECTED_FIELDS.has(key)) throw new Error(`Protected price field rejected: ${key}`);
    if (!allowlist.has(key)) throw new Error(`Unexpected persistence field rejected: ${key}`);
  }
}

function assertRenewalPayload(payload) {
  if (payload == null) return;
  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== "offer_price_verified_at") throw new Error("Invalid authoritative renewal payload");
  if (!RENEWAL_FIELDS.has(keys[0]) || !Number.isFinite(Date.parse(String(payload.offer_price_verified_at ?? "")))) throw new Error("Invalid authoritative renewal timestamp");
}

export function createBaserowCurrentStatePersistence({ token, productsTableId, fetchImpl = fetch }) {
  if (!token) throw new Error("BASEROW_API_TOKEN is required for persistence");
  if (!productsTableId) throw new Error("BASEROW_TABLE_ID is required for persistence");
  const request = async (url, init) => {
    const response = await fetchImpl(url, { ...init, headers: { Authorization: `Token ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) } });
    const body = await response.text();
    if (!response.ok) throw new Error(`Baserow persistence failed (${response.status}): ${body.slice(0, 500)}`);
    return body ? JSON.parse(body) : null;
  };
  return {
    async write(plan) {
      assertSafePayload(plan.current, CURRENT_FIELDS);
      assertRenewalPayload(plan.authoritative_renewal);
      const payload = { ...plan.current, ...(plan.authoritative_renewal || {}) };
      const current = await request(`https://api.baserow.io/api/database/rows/table/${productsTableId}/${plan.product_id}/?user_field_names=true`, { method: "PATCH", body: JSON.stringify(payload) });
      return { product_row_id: current?.id ?? plan.product_id };
    },
  };
}

export const createBaserowPersistence = createBaserowCurrentStatePersistence;

export async function persistMonitorResults(results, { write = false, historyWriter, currentWriter, writer } = {}) {
  const plans = results.map(buildPersistencePlan);
  if (!write) return { mode: "dry-run", writes_performed: false, planned: plans.length, plans };
  const stateWriter = currentWriter || writer;
  if (!historyWriter?.append) throw new Error("Google Sheets Price History writer is required when write=true");
  if (!stateWriter?.write) throw new Error("Baserow current-state writer is required when write=true");
  const history = await historyWriter.append(results);
  const written = [];
  for (const plan of plans) written.push(await stateWriter.write(plan));
  return { mode: "write-monitor-results", writes_performed: true, planned: plans.length, history, current_state: written };
}

export const persistenceSafety = Object.freeze({
  protected_fields: [...PROTECTED_FIELDS], current_fields: [...CURRENT_FIELDS], renewal_fields: [...RENEWAL_FIELDS],
  write_order: "append_google_sheet_history_then_patch_baserow_current_state",
});
