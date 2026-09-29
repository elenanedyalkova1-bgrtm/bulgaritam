import { observedCanonicalKey } from "./entity-identity.mjs";

export const OBSERVED_PRODUCT_FIELDS = Object.freeze([
  "canonical_key", "brand_id", "source_url", "canonical_url", "external_product_id", "sku", "title", "image_url",
  "current_price", "currency", "regular_price", "regular_price_currency", "availability", "first_seen_at", "last_seen_at",
  "last_checked_at", "discovery_method", "discovery_confidence", "reader_status", "reader_error", "lifecycle_status",
  "consecutive_not_seen", "consecutive_dead", "is_active", "bulgaritam_product_id",
]);

export function observedProductRecord(candidate, observation = {}, now = new Date().toISOString()) {
  const canonicalUrl = observation.canonical_url || candidate.normalized_url || candidate.source_url;
  const canonicalKey = observedCanonicalKey({ brand_id: candidate.brand_id, canonical_url: canonicalUrl, source_url: candidate.source_url });
  if (!canonicalKey) throw new Error("Observed product requires brand_id and a valid canonical/source URL");
  return {
    canonical_key: canonicalKey, brand_id: candidate.brand_id, source_url: candidate.source_url, canonical_url: canonicalUrl,
    external_product_id: observation.external_product_id || null, sku: observation.sku || null, title: observation.title || null,
    image_url: observation.image_url || null, current_price: observation.detected_price ?? null, currency: observation.currency || null,
    regular_price: observation.regular_price ?? null, regular_price_currency: observation.regular_price_currency || null,
    availability: observation.availability || null, first_seen_at: candidate.first_seen_at || now, last_seen_at: now,
    last_checked_at: observation.checked_at || null, discovery_method: candidate.discovery_method,
    discovery_confidence: candidate.discovery_confidence, reader_status: observation.extraction_status || observation.status || "not_checked",
    reader_error: observation.error_reason || null, lifecycle_status: "active", consecutive_not_seen: 0,
    consecutive_dead: 0, is_active: true, bulgaritam_product_id: candidate.bulgaritam_product_id || null,
  };
}

export function nextObservedLifecycle(current, event, now = Date.now()) {
  const state = String(current.lifecycle_status || "active"); const notSeen = Number(current.consecutive_not_seen || 0); const dead = Number(current.consecutive_dead || 0);
  if (event === "seen") return { lifecycle_status: "active", consecutive_not_seen: 0, consecutive_dead: 0, is_active: true };
  if (event === "blocked" || event === "rate_limited") return { lifecycle_status: state, consecutive_not_seen: notSeen, consecutive_dead: dead, is_active: current.is_active !== false };
  if (event === "not_seen") { const count = notSeen + 1; return { lifecycle_status: count >= 3 ? "recheck" : "not_seen", consecutive_not_seen: count, consecutive_dead: dead, is_active: count < 5 }; }
  if (event === "dead_url") { const count = dead + 1; return { lifecycle_status: count >= 2 ? "recheck" : "not_seen", consecutive_not_seen: notSeen, consecutive_dead: count, is_active: count < 3 }; }
  return { lifecycle_status: state, consecutive_not_seen: notSeen, consecutive_dead: dead, is_active: current.is_active !== false };
}

export function createObservedProductStore({ token, tableId, fetchImpl = fetch } = {}) {
  if (!token || !tableId) throw new Error("Observed Products store requires token and tableId");
  const headers = { Authorization: `Token ${token}`, "Content-Type": "application/json" };
  const safeUrl = (value) => { const url = new URL(value); if (url.hostname !== "api.baserow.io") throw new Error("Invalid Observed Products API URL"); url.protocol = "https:"; return url.toString(); };
  const request = async (url, init = {}) => { const response = await fetchImpl(safeUrl(url), { ...init, headers: { ...headers, ...(init.headers || {}) } }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(`Observed Products API ${response.status}: ${JSON.stringify(body).slice(0, 400)}`); return body; };
  return {
    async list(filters = "") {
      const rows = []; let next = `https://api.baserow.io/api/database/rows/table/${tableId}/?user_field_names=true&size=200${filters}`;
      while (next) { const page = await request(next); rows.push(...(page.results || [])); next = page.next || ""; }
      return rows;
    },
    async findAllByCanonicalKey(key) { const url = `https://api.baserow.io/api/database/rows/table/${tableId}/?user_field_names=true&size=3&filter__canonical_key__equal=${encodeURIComponent(key)}`; return (await request(url)).results || []; },
    async findByCanonicalKey(key) {
      const rows = await this.findAllByCanonicalKey(key);
      if (rows.length > 1) throw new Error(`Duplicate Observed Products canonical_key detected: ${key}`);
      return rows[0] || null;
    },
    async update(id, fields) { return request(`https://api.baserow.io/api/database/rows/table/${tableId}/${id}/?user_field_names=true`, { method: "PATCH", body: JSON.stringify(fields) }); },
    async upsert(record) {
      // External monitoring is a single-writer workflow. Baserow does not expose a
      // unique text constraint, so parallel writers are forbidden and duplicates fail.
      const existing = await this.findByCanonicalKey(record.canonical_key);
      if (existing) return this.update(existing.id, record);
      const created = await request(`https://api.baserow.io/api/database/rows/table/${tableId}/?user_field_names=true`, { method: "POST", body: JSON.stringify(record) });
      const verified = await this.findAllByCanonicalKey(record.canonical_key);
      if (verified.length !== 1 || Number(verified[0].id) !== Number(created.id)) throw new Error(`Observed Product idempotency verification failed for ${record.canonical_key}`);
      return created;
    },
  };
}
