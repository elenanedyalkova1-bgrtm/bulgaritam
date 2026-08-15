import type { APIRoute } from "astro";

const BASEROW_API = "https://api.baserow.io/api";
const ALLOWED_ORIGINS = new Set(["https://bulgaritam.bg", "https://www.bulgaritam.bg"]);
const ALLOWED_EVENTS = new Set([
  "page_view", "product_impression", "brand_impression", "view_product", "view_brand",
  "search", "search_results_view", "search_no_results", "select_category", "select_subcategory",
  "select_product_type", "select_gift_recipient", "select_gift_occasion", "apply_filter",
  "remove_filter", "clear_filters", "change_sort", "save_product", "remove_saved_product",
  "save_brand", "share_product", "create_collection", "add_to_collection", "remove_from_collection",
  "view_collection", "share_collection", "outbound_product_click", "outbound_brand_click",
]);
const FORBIDDEN_KEYS = new Set(["email", "phone", "name", "collection_name", "board_name", "destination_url", "page_location"]);

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://bulgaritam.bg",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
  "Vary": "Origin",
});

const text = (body: string, status: number, origin: string) => new Response(body, { status, headers: cors(origin) });
const clean = (value: unknown, max = 240) => String(value ?? "").trim().slice(0, max);

export const OPTIONS: APIRoute = ({ request }) => {
  const origin = request.headers.get("origin") || "";
  return ALLOWED_ORIGINS.has(origin) ? text("", 204, origin) : text("Forbidden", 403, origin);
};

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get("origin") || "";
  if (!ALLOWED_ORIGINS.has(origin)) return text("Forbidden", 403, origin);
  const tableId = import.meta.env.BASEROW_ANALYTICS_EVENTS_TABLE_ID;
  const token = import.meta.env.BASEROW_API_TOKEN;
  if (!tableId || !token) return text("Analytics storage is not configured", 503, origin);

  const raw = await request.text();
  if (!raw || raw.length > 24_000) return text("Invalid payload", 400, origin);
  let input: Record<string, unknown>;
  try { input = JSON.parse(raw); } catch { return text("Invalid JSON", 400, origin); }

  const eventName = clean(input.event_name, 80);
  if (!ALLOWED_EVENTS.has(eventName)) return text("Unknown event", 400, origin);
  for (const key of FORBIDDEN_KEYS) delete input[key];
  const safePayload = Object.fromEntries(
    Object.entries(input).filter(([key, value]) =>
      !FORBIDDEN_KEYS.has(key) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    ).map(([key, value]) => [key, typeof value === "string" ? clean(value) : value])
  );

  const row = {
    event_name: eventName,
    occurred_at: clean(input.occurred_at, 40) || new Date().toISOString(),
    anonymous_session_id: clean(input.anonymous_session_id, 80),
    anonymous_journey_id: clean(input.anonymous_journey_id, 80),
    product_id: clean(input.product_id, 80),
    product_name: clean(input.product_name),
    brand_id: clean(input.brand_id, 80),
    brand_name: clean(input.brand_name),
    category: clean(input.category),
    subcategory: clean(input.subcategory),
    product_type: clean(input.product_type),
    search_term: clean(input.search_term || input.query),
    search_results_count: Number(input.search_results_count ?? input.result_count ?? 0) || 0,
    collection_id: clean(input.collection_id, 100),
    source_context: clean(input.source_context),
    destination_domain: clean(input.destination_domain),
    payload_json: JSON.stringify(safePayload),
  };

  const response = await fetch(`${BASEROW_API}/database/rows/table/${encodeURIComponent(tableId)}/?user_field_names=true`, {
    method: "POST",
    headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    console.error(`First-party analytics write failed: Baserow ${response.status}`);
    return text("Storage unavailable", 502, origin);
  }
  return text("", 202, origin);
};
