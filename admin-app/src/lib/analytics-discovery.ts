import { analyticsTextResponse, ALLOWED_ANALYTICS_ORIGINS } from "./analytics-ingestion";
import { safeAnalyticsErrorDiagnostics } from "./supabase-analytics";

export type DiscoveryResultMember = {
  entity_type: "product" | "brand";
  product_id: string | null;
  brand_id: string | null;
  position: number;
};

export type DiscoveryStateInsert = {
  discovery_state_id: string;
  occurred_at: string;
  anonymous_session_id: string;
  anonymous_journey_id: string;
  surface_type: string;
  page_path: string;
  search_id: string | null;
  query: string | null;
  category: string | null;
  subcategory: string | null;
  product_type: string | null;
  sort_value: string | null;
  price_min_eur: number | null;
  price_max_eur: number | null;
  gift_recipient: string | null;
  gift_occasion: string | null;
  active_filters: unknown[] | Record<string, unknown> | null;
  result_count: number;
  tracking_version: 2;
  metadata: Record<string, string | number | boolean | null>;
};

export type DiscoveryRepository = {
  insertSnapshot(state: DiscoveryStateInsert, results: DiscoveryResultMember[]): Promise<void>;
};

const text = (value: unknown, max = 240) => String(value ?? "").trim().slice(0, max);
const nullableText = (value: unknown, max = 240) => text(value, max) || null;
const nullableNumber = (value: unknown) => {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export function sanitizeDiscoverySnapshot(input: Record<string, unknown>) {
  const rawState = input.state;
  const rawResults = input.results;
  if (!rawState || typeof rawState !== "object" || Array.isArray(rawState) || !Array.isArray(rawResults)) return null;
  const source = rawState as Record<string, unknown>;
  const resultCount = Number(source.result_count);
  const occurredAt = text(source.occurred_at, 40);
  if (!text(source.discovery_state_id, 80) || !text(source.anonymous_session_id, 80) ||
      !text(source.anonymous_journey_id, 80) || !text(source.surface_type, 80) ||
      !text(source.page_path, 240) || !Number.isInteger(resultCount) || resultCount < 0 ||
      Number.isNaN(new Date(occurredAt).getTime()) || resultCount !== rawResults.length) return null;

  const results: DiscoveryResultMember[] = [];
  const seenEntities = new Set<string>();
  for (let index = 0; index < rawResults.length; index += 1) {
    const item = rawResults[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const entityType = text(row.entity_type, 20);
    const productId = nullableText(row.product_id, 80);
    const brandId = nullableText(row.brand_id, 80);
    const position = Number(row.position);
    if ((entityType !== "product" && entityType !== "brand") || position !== index + 1 ||
        (entityType === "product" && !productId) || (entityType === "brand" && (!brandId || productId))) return null;
    const identity = `${entityType}:${productId || ""}:${brandId || ""}`;
    if (seenEntities.has(identity)) return null;
    seenEntities.add(identity);
    results.push({ entity_type: entityType, product_id: productId, brand_id: brandId, position });
  }

  const activeFilters = source.active_filters;
  const safeActiveFilters = Array.isArray(activeFilters) || (activeFilters && typeof activeFilters === "object") ? activeFilters : null;
  const metadataSource = source.metadata && typeof source.metadata === "object" && !Array.isArray(source.metadata)
    ? source.metadata as Record<string, unknown> : {};
  const metadata = Object.fromEntries(Object.entries(metadataSource)
    .filter(([, value]) => value == null || ["string", "number", "boolean"].includes(typeof value))
    .map(([key, value]) => [text(key, 80), typeof value === "string" ? text(value, 240) : value])) as DiscoveryStateInsert["metadata"];

  const state: DiscoveryStateInsert = {
    discovery_state_id: text(source.discovery_state_id, 80), occurred_at: occurredAt,
    anonymous_session_id: text(source.anonymous_session_id, 80),
    anonymous_journey_id: text(source.anonymous_journey_id, 80),
    surface_type: text(source.surface_type, 80), page_path: text(source.page_path, 240),
    search_id: nullableText(source.search_id, 80), query: nullableText(source.query),
    category: nullableText(source.category), subcategory: nullableText(source.subcategory),
    product_type: nullableText(source.product_type), sort_value: nullableText(source.sort_value),
    price_min_eur: nullableNumber(source.price_min_eur), price_max_eur: nullableNumber(source.price_max_eur),
    gift_recipient: nullableText(source.gift_recipient), gift_occasion: nullableText(source.gift_occasion),
    active_filters: safeActiveFilters as DiscoveryStateInsert["active_filters"], result_count: resultCount,
    tracking_version: 2, metadata,
  };
  return { state, results };
}

export async function handleDiscoverySnapshotPost(request: Request, repositoryFactory: () => DiscoveryRepository) {
  const origin = request.headers.get("origin") || "";
  if (!ALLOWED_ANALYTICS_ORIGINS.has(origin)) return analyticsTextResponse("Forbidden", 403, origin);
  const raw = await request.text();
  if (!raw || raw.length > 2_000_000) return analyticsTextResponse("Invalid payload", 400, origin);
  let input: Record<string, unknown>;
  try { input = JSON.parse(raw); } catch { return analyticsTextResponse("Invalid JSON", 400, origin); }
  const snapshot = sanitizeDiscoverySnapshot(input);
  if (!snapshot) return analyticsTextResponse("Invalid payload", 400, origin);
  try {
    await repositoryFactory().insertSnapshot(snapshot.state, snapshot.results);
  } catch (cause) {
    console.error("First-party analytics discovery snapshot failed: Supabase", safeAnalyticsErrorDiagnostics(cause));
    return analyticsTextResponse("Storage unavailable", 502, origin);
  }
  return analyticsTextResponse("", 202, origin);
}
