const PROTECTED_FIELDS = new Set([
  "price_min_eur", "price_max_eur",
  "offer_price_amount", "offer_price_currency", "offer_price_verified_at", "offer_price_source", "offer_price_source_url",
]);
const CURRENT_FIELDS = new Set([
  "price_last_checked_at", "price_check_status", "price_detected_amount", "price_detected_currency",
  "price_extraction_method", "price_confidence", "price_change_detected",
  "offer_price_status",
]);

function finiteOrNull(value) { return Number.isFinite(value) ? value : null; }

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
  return { product_id: result.product_id, current };
}

function assertSafePayload(payload, allowlist) {
  for (const key of Object.keys(payload)) {
    if (PROTECTED_FIELDS.has(key)) throw new Error(`Protected price field rejected: ${key}`);
    if (!allowlist.has(key)) throw new Error(`Unexpected persistence field rejected: ${key}`);
  }
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
      const current = await request(`https://api.baserow.io/api/database/rows/table/${productsTableId}/${plan.product_id}/?user_field_names=true`, { method: "PATCH", body: JSON.stringify(plan.current) });
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
  protected_fields: [...PROTECTED_FIELDS], current_fields: [...CURRENT_FIELDS],
  write_order: "append_google_sheet_history_then_patch_baserow_current_state",
});
