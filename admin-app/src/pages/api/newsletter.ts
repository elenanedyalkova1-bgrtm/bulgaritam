import type { APIRoute } from "astro";
import { baserowUrl } from "../../lib/baserow";

const NEWSLETTER_TABLE = import.meta.env?.BASEROW_NEWSLETTER_SUBSCRIBERS_TABLE_ID || "1154960";
const ALLOWED_ORIGINS = new Set([
  "https://bulgaritam.bg",
  "https://www.bulgaritam.bg",
  "http://localhost:4321",
  "http://localhost:4322",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);
const recentByIp = new Map<string, number[]>();
const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://bulgaritam.bg",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
  "Vary": "Origin",
});
const json = (body: Record<string, unknown>, status: number, origin: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" },
  });

export const OPTIONS: APIRoute = ({ request }) => {
  const origin = request.headers.get("origin") || "";
  return ALLOWED_ORIGINS.has(origin)
    ? new Response(null, { status: 204, headers: cors(origin) })
    : json({ error: "Forbidden" }, 403, origin);
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const origin = request.headers.get("origin") || "";
  if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Forbidden" }, 403, origin);

  const token = import.meta.env?.BASEROW_API_TOKEN;
  if (!token || !NEWSLETTER_TABLE) {
    return json({ error: "Newsletter storage is not configured" }, 503, origin);
  }

  const raw = await request.text();
  if (!raw || raw.length > 8_000) return json({ error: "Невалидни данни." }, 400, origin);

  let input: Record<string, unknown>;
  try { input = JSON.parse(raw); }
  catch { return json({ error: "Невалидни данни." }, 400, origin); }

  const name = clean(input.name, 160);
  const email = clean(input.email, 254).toLowerCase();
  const discounts = input.discounts_opt_in === true;
  const newFinds = input.new_finds_opt_in === true;
  const brandInsights = input.brand_insights_opt_in === true;

  if (!name) return json({ error: "Името е задължително." }, 400, origin);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Въведи валиден имейл адрес." }, 400, origin);
  }
  if (!discounts && !newFinds && !brandInsights) {
    return json({ error: "Избери поне една тема." }, 400, origin);
  }

  const ip = clientAddress || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const attempts = (recentByIp.get(ip) || []).filter((time) => now - time < 10 * 60_000);
  if (attempts.length >= 5) return json({ error: "Твърде много опити. Опитай отново по-късно." }, 429, origin);
  recentByIp.set(ip, [...attempts, now]);

  const response = await fetch(
    baserowUrl(`/database/rows/table/${encodeURIComponent(NEWSLETTER_TABLE)}/?user_field_names=true`),
    {
      method: "POST",
      headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        Name: name,
        email,
        discounts_opt_in: discounts,
        new_finds_opt_in: newFinds,
        brand_insights_opt_in: brandInsights,
        created_at: new Date().toISOString(),
        consent_source: "newsletter_popup",
        is_active: true,
      }),
    }
  );

  if (!response.ok) {
    console.error(`Newsletter signup failed: Baserow ${response.status}`);
    return json({ error: "Записването временно не е достъпно. Опитай отново." }, 502, origin);
  }

  return json({ accepted: true }, 201, origin);
};
