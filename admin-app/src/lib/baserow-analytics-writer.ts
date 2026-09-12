import { baserowUrl } from "./baserow";
import type { AnalyticsEventInsert } from "./supabase-analytics";

/**
 * Rollback-only copy of the Phase 2 Baserow Analytics Events writer.
 * It is intentionally not imported by the live endpoint and must not be used
 * alongside Supabase as a dual writer.
 */
export function mapAnalyticsInsertToBaserowRow(event: AnalyticsEventInsert) {
  return {
    event_name: event.event_name,
    occurred_at: event.occurred_at,
    anonymous_session_id: event.anonymous_session_id || "",
    anonymous_journey_id: event.anonymous_journey_id || "",
    product_id: event.product_id || "",
    product_name: event.product_name || "",
    brand_id: event.brand_id || "",
    brand_name: event.brand_name || "",
    category: event.category || "",
    subcategory: event.subcategory || "",
    product_type: event.product_type || "",
    search_term: event.search_term || "",
    search_results_count: event.search_results_count || 0,
    collection_id: event.collection_id || "",
    source_context: event.source_context || "",
    destination_domain: event.destination_domain || "",
    payload_json: JSON.stringify(event.metadata),
  };
}

export async function writeAnalyticsEventToBaserow(event: AnalyticsEventInsert) {
  const tableId = import.meta.env.BASEROW_ANALYTICS_EVENTS_TABLE_ID;
  const token = import.meta.env.BASEROW_API_TOKEN;
  if (!tableId || !token) throw new Error("Baserow analytics storage is not configured.");

  const response = await fetch(baserowUrl(`/database/rows/table/${encodeURIComponent(tableId)}/?user_field_names=true`), {
    method: "POST",
    headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(mapAnalyticsInsertToBaserowRow(event)),
  });
  if (!response.ok) throw new Error(`Baserow analytics write failed (${response.status}).`);
}
