import { mapAnalyticsPayloadToInsert, type AnalyticsEventInsert } from "./supabase-analytics";

export const ALLOWED_ANALYTICS_ORIGINS = new Set(["https://bulgaritam.bg", "https://www.bulgaritam.bg"]);
export const ALLOWED_ANALYTICS_EVENTS = new Set([
  "page_view", "product_impression", "brand_impression", "view_product", "view_brand",
  "search", "search_results_view", "search_no_results", "select_category", "select_subcategory",
  "select_product_type", "select_gift_recipient", "select_gift_occasion", "apply_filter",
  "open_gift_discovery", "surprise_me",
  "remove_filter", "clear_filters", "change_sort", "save_product", "remove_saved_product",
  "save_brand", "share_product", "create_collection", "add_to_collection", "remove_from_collection",
  "view_collection", "share_collection", "outbound_product_click", "outbound_brand_click",
  "user_signal",
]);

const FORBIDDEN_KEYS = new Set(["email", "phone", "name", "collection_name", "board_name", "destination_url", "page_location"]);

export type AnalyticsInsertRepository = {
  insert(event: AnalyticsEventInsert): Promise<{ duplicateIgnored: boolean }>;
};

export const analyticsCors = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ANALYTICS_ORIGINS.has(origin) ? origin : "https://bulgaritam.bg",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
  "Vary": "Origin",
});

export const analyticsTextResponse = (body: string, status: number, origin: string) =>
  new Response(body, { status, headers: analyticsCors(origin) });

const clean = (value: unknown, max = 240) => String(value ?? "").trim().slice(0, max);

export function sanitizeAnalyticsEvent(input: Record<string, unknown>, receivedAt = new Date().toISOString()) {
  const eventName = clean(input.event_name, 80);
  if (!ALLOWED_ANALYTICS_EVENTS.has(eventName)) return null;

  const safePayload = Object.fromEntries(
    Object.entries(input).filter(([key, value]) =>
      !FORBIDDEN_KEYS.has(key) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    ).map(([key, value]) => [key, typeof value === "string"
      ? clean(value, ["returned_products_json", "returned_brands_json"].includes(key) ? 20_000 : 240)
      : value])
  );

  // These promoted values deliberately match the former Baserow row mapping,
  // including its field lengths and search/count fallbacks.
  const promoted = {
    ...safePayload,
    event_name: eventName,
    occurred_at: clean(input.occurred_at, 40) || receivedAt,
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
  };

  return {
    ...mapAnalyticsPayloadToInsert(promoted, { receivedAt }),
    metadata: { ...safePayload, received_at_server: receivedAt },
  } satisfies AnalyticsEventInsert;
}

export async function handleAnalyticsEventPost(
  request: Request,
  repositoryFactory: () => AnalyticsInsertRepository,
) {
  const origin = request.headers.get("origin") || "";
  if (!ALLOWED_ANALYTICS_ORIGINS.has(origin)) return analyticsTextResponse("Forbidden", 403, origin);

  let repository: AnalyticsInsertRepository;
  try {
    repository = repositoryFactory();
  } catch (cause) {
    console.error("First-party analytics storage is not configured", cause);
    return analyticsTextResponse("Analytics storage is not configured", 503, origin);
  }

  const raw = await request.text();
  if (!raw || raw.length > 24_000) return analyticsTextResponse("Invalid payload", 400, origin);

  let input: Record<string, unknown>;
  try { input = JSON.parse(raw); } catch { return analyticsTextResponse("Invalid JSON", 400, origin); }

  let event: AnalyticsEventInsert | null;
  try {
    event = sanitizeAnalyticsEvent(input);
  } catch {
    return analyticsTextResponse("Invalid payload", 400, origin);
  }
  if (!event) return analyticsTextResponse("Unknown event", 400, origin);

  try {
    await repository.insert(event);
  } catch (cause) {
    console.error("First-party analytics write failed: Supabase", cause);
    return analyticsTextResponse("Storage unavailable", 502, origin);
  }

  return analyticsTextResponse("", 202, origin);
}
