import type { APIRoute } from "astro";
import { consumerDealsService, runConsumerDealsLkgSmokeTest } from "../../lib/consumer-deals-api";

const ALLOWED_ORIGINS = new Set(["https://bulgaritam.bg", "https://www.bulgaritam.bg", "http://localhost:4321", "http://localhost:4322", "http://localhost:4173", "http://127.0.0.1:4173"]);
const enabled = () => ["1", "true", "yes"].includes(String(import.meta.env.CONSUMER_DEALS_API_ENABLED || "").toLowerCase());
const headers = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://bulgaritam.bg",
  "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400", "Vary": "Origin",
});
const json = (body: unknown, status: number, origin: string, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status, headers: { ...headers(origin), ...extra, "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff" },
});

export const OPTIONS: APIRoute = ({ request }) => {
  const origin = request.headers.get("origin") || "";
  return ALLOWED_ORIGINS.has(origin) ? new Response(null, { status: 204, headers: headers(origin) }) : json({ error: "Forbidden" }, 403, origin);
};

export const GET: APIRoute = async ({ request }) => {
  const origin = request.headers.get("origin") || "";
  if (!enabled()) return json({ error: "Not found" }, 404, origin, { "Cache-Control": "no-store" });
  if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Forbidden" }, 403, origin, { "Cache-Control": "no-store" });
  const url = new URL(request.url);
  if (url.searchParams.get("smoke") === "lkg") {
    const expected = String(import.meta.env.CONSUMER_DEALS_SMOKE_TOKEN || "");
    if (!expected || request.headers.get("x-consumer-deals-smoke-token") !== expected) return json({ error: "Forbidden" }, 403, origin, { "Cache-Control": "no-store" });
    try { return json(await runConsumerDealsLkgSmokeTest(new Date()), 200, origin, { "Cache-Control": "no-store" }); }
    catch (cause) { console.error("Consumer deals LKG smoke failed", cause instanceof Error ? cause.message : "unknown error"); return json({ error: "Smoke failed" }, 503, origin, { "Cache-Control": "no-store" }); }
  }
  try {
    const payload = await consumerDealsService.get(new Date());
    const { cache: _internalCacheState, ...publicPayload } = payload;
    return json(publicPayload, 200, origin, {
      "Cache-Control": "public, max-age=60, s-maxage=600, stale-while-revalidate=1200, stale-if-error=86400",
      "CDN-Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200, stale-if-error=86400",
    });
  } catch (cause) {
    console.error("Consumer deals dataset unavailable", cause instanceof Error ? cause.message : "unknown error");
    return json({ error: "Deals temporarily unavailable" }, 503, origin, { "Cache-Control": "no-store" });
  }
};
