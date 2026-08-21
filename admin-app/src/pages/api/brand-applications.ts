import type { APIRoute } from "astro";

const RESEND_URL = import.meta.env?.RESEND_API_URL || process.env.RESEND_API_URL || "https://api.resend.com/emails";
const FROM = "Bulgaritam <applications@bulgaritam.bg>";
const TO = "info@bulgaritam.bg";
const ALLOWED_ORIGINS = new Set([
  "https://bulgaritam.bg",
  "https://www.bulgaritam.bg",
  "http://localhost:4321",
  "http://localhost:4322",
]);
const recentByIp = new Map<string, number[]>();
const recentPayloads = new Map<string, number>();
const clean = (value: unknown, max = 500) => String(value ?? "").trim().replace(/\r\n/g, "\n").slice(0, max);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
}[character] || character));
const validUrl = (value: string) => {
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
};
const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://bulgaritam.bg",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
  "Vary": "Origin",
});
const json = (body: Record<string, unknown>, status: number, origin: string) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" } });
const digest = async (value: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const OPTIONS: APIRoute = ({ request }) => {
  const origin = request.headers.get("origin") || "";
  return ALLOWED_ORIGINS.has(origin) ? new Response(null, { status: 204, headers: cors(origin) }) : json({ error: "Forbidden" }, 403, origin);
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const origin = request.headers.get("origin") || "";
  if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Forbidden" }, 403, origin);
  const apiKey = import.meta.env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) return json({ error: "Email service is not configured" }, 503, origin);

  const raw = await request.text();
  if (!raw || raw.length > 18_000) return json({ error: "Invalid payload" }, 400, origin);
  let input: Record<string, unknown>;
  try { input = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400, origin); }
  if (clean(input.company, 100)) return json({ accepted: true }, 202, origin);

  const startedAt = Number(input.started_at || 0);
  const elapsed = Date.now() - startedAt;
  if (!startedAt || elapsed < 2500 || elapsed > 86_400_000) return json({ error: "Invalid form session" }, 400, origin);

  const brandName = clean(input.brand_name, 160);
  const contactName = clean(input.contact_name, 160);
  const email = clean(input.email, 240).toLowerCase();
  const phone = clean(input.phone, 80);
  const website = clean(input.website, 500);
  const instagram = clean(input.instagram, 500);
  const categories = clean(input.categories, 800);
  const message = clean(input.message, 3000);
  if (!brandName || !contactName || !/^\S+@\S+\.\S+$/.test(email) || !website || !validUrl(website) || !categories) {
    return json({ error: "Please complete the required fields" }, 400, origin);
  }
  if (instagram && !validUrl(instagram)) return json({ error: "Invalid Instagram URL" }, 400, origin);
  if (input.consent !== true) return json({ error: "Consent is required" }, 400, origin);

  const ip = clientAddress || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const attempts = (recentByIp.get(ip) || []).filter((time) => now - time < 10 * 60_000);
  if (attempts.length >= 3) return json({ error: "Too many applications" }, 429, origin);

  const payloadKey = await digest([brandName, email, website, categories, message].join("|"));
  const previous = recentPayloads.get(payloadKey);
  if (previous && now - previous < 10 * 60_000) return json({ error: "Duplicate application" }, 409, origin);
  recentByIp.set(ip, [...attempts, now]);
  recentPayloads.set(payloadKey, now);
  for (const [key, time] of recentPayloads) if (now - time > 10 * 60_000) recentPayloads.delete(key);

  const fields = [
    ["Име на бранда", brandName],
    ["Лице за контакт", contactName],
    ["Email", email],
    ["Телефон", phone || "—"],
    ["Сайт", website],
    ["Instagram", instagram || "—"],
    ["Категории и типове продукти", categories],
    ["Информация за бранда", message || "—"],
    ["Съгласие за обработка и контакт", "Да"],
  ];
  const textBody = ["Нова кандидатура от формуляра „Стани партньор“", "", ...fields.map(([label, value]) => `${label}:\n${value}`)].join("\n\n");
  const htmlRows = fields.map(([label, value]) =>
    `<tr><th style="padding:10px;text-align:left;vertical-align:top;border-bottom:1px solid #e7e1da">${escapeHtml(label)}</th><td style="padding:10px;white-space:pre-wrap;border-bottom:1px solid #e7e1da">${escapeHtml(value)}</td></tr>`
  ).join("");

  const resendResponse = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `brand-application-${payloadKey}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      reply_to: email,
      subject: `Нова кандидатура: ${brandName}`,
      text: textBody,
      html: `<div style="font-family:Arial,sans-serif;color:#1c1c1c"><h1 style="font-size:22px">Нова кандидатура от „Стани партньор“</h1><table style="width:100%;max-width:720px;border-collapse:collapse">${htmlRows}</table></div>`,
    }),
  });
  const resendBody = await resendResponse.json().catch(() => ({}));
  if (!resendResponse.ok || !resendBody.id) {
    recentPayloads.delete(payloadKey);
    console.error(`Brand application email failed: Resend ${resendResponse.status}`);
    return json({ error: "Email delivery failed" }, 502, origin);
  }
  return json({ accepted: true, submission_id: resendBody.id }, 202, origin);
};
