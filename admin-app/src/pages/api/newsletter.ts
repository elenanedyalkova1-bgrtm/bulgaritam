import type { APIRoute } from "astro";

const RESEND_URL = import.meta.env?.RESEND_API_URL || process.env.RESEND_API_URL || "https://api.resend.com/emails";
const ALLOWED_ORIGINS = new Set([
  "https://bulgaritam.bg", "https://www.bulgaritam.bg",
  "http://localhost:4321", "http://localhost:4322", "http://localhost:4173", "http://127.0.0.1:4173",
]);
const WINDOW = 10 * 60_000;
const recentByIp = new Map<string, number[]>();
type Notification = { at: number; body: string; key: string; acceptedId?: string; pending?: Promise<string | null> };
const notifications = new Map<string, Notification>();
const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
}[character] || character));
const digest = async (value: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://bulgaritam.bg",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400", "Cache-Control": "no-store", "Vary": "Origin",
});
const json = (body: Record<string, unknown>, status: number, origin: string) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" } });
const sourcePage = (request: Request) => {
  try {
    const url = new URL(request.headers.get("referer") || "");
    // Do not copy query strings, fragments or untrusted hosts into the notification.
    return ALLOWED_ORIGINS.has(url.origin) ? clean(url.origin + url.pathname, 500) : "Не е предоставена";
  } catch { return "Не е предоставена"; }
};

export const OPTIONS: APIRoute = ({ request }) => {
  const origin = request.headers.get("origin") || "";
  return ALLOWED_ORIGINS.has(origin)
    ? new Response(null, { status: 204, headers: cors(origin) })
    : json({ error: "Forbidden" }, 403, origin);
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const origin = request.headers.get("origin") || "";
  if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Forbidden" }, 403, origin);
  const raw = await request.text();
  if (!raw || raw.length > 8_000) return json({ error: "Невалидни данни." }, 400, origin);
  let input: Record<string, unknown>;
  try { input = JSON.parse(raw); } catch { return json({ error: "Невалидни данни." }, 400, origin); }
  if (!input || typeof input !== "object" || Array.isArray(input) || clean(input.company, 100)) {
    return json({ error: "Невалидни данни." }, 400, origin);
  }
  const name = clean(input.name, 160);
  const email = clean(input.email, 254).toLowerCase();
  const discounts = input.discounts_opt_in === true;
  const newFinds = input.new_finds_opt_in === true;
  const brandInsights = input.brand_insights_opt_in === true;
  if (!name) return json({ error: "Името е задължително." }, 400, origin);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Въведи валиден имейл адрес." }, 400, origin);
  if (!discounts && !newFinds && !brandInsights) return json({ error: "Избери поне една тема." }, 400, origin);

  const now = Date.now();
  for (const [key, entry] of notifications) if (!entry.pending && now - entry.at > WINDOW) notifications.delete(key);
  for (const [key, times] of recentByIp) if (times.every(time => now - time > WINDOW)) recentByIp.delete(key);
  const page = sourcePage(request);
  const payloadKey = await digest(JSON.stringify({ name, email, discounts, newFinds, brandInsights, page }));
  let notification = notifications.get(payloadKey);
  if (!notification?.acceptedId && !notification?.pending) {
    const ip = clientAddress || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const attempts = (recentByIp.get(ip) || []).filter(time => now - time < WINDOW);
    if (attempts.length >= 5) return json({ error: "Твърде много опити. Опитай отново по-късно." }, 429, origin);
    recentByIp.set(ip, [...attempts, now]);
    if (!notification) {
      const fields = [
        ["Име", name], ["Имейл", email], ["Подадено на (UTC)", new Date(now).toISOString()],
        ["Източник", "newsletter_popup / bulgaritam-newsletter"], ["Страница (Referer, ако е налична)", page],
        ["Отстъпки", discounts ? "Да" : "Не"], ["Нови български находки", newFinds ? "Да" : "Не"],
        ["От брандовете", brandInsights ? "Да" : "Не"],
        ["Съгласие", "Изпратен формуляр с изрично избрани теми. Съгласието се отнася само до темите с „Да“."],
        ["Текст при изпращане", "С изпращането се съгласяваш да използваме данните ти за избраните известия. Можеш да се отпишеш по всяко време."],
        ["Обработка", "Временен email-only режим: вътрешно известие за ръчно обработване; не е добавян абонат в маркетингов списък."],
      ];
      const text = ["Нов newsletter абонамент", ...fields.map(([label, value]) => `${label}:\n${value}`)].join("\n\n");
      const rows = fields.map(([label, value]) => `<tr><th style="padding:10px;text-align:left;vertical-align:top;border-bottom:1px solid #e7e1da">${escapeHtml(label)}</th><td style="padding:10px;white-space:pre-wrap;border-bottom:1px solid #e7e1da">${escapeHtml(value)}</td></tr>`).join("");
      const body = JSON.stringify({ from: "Bulgaritam <applications@bulgaritam.bg>", to: ["info@bulgaritam.bg"],
        reply_to: email, subject: "Нов newsletter абонамент — Българитъм", text,
        html: `<div style="font-family:Arial,sans-serif;color:#1c1c1c"><h1 style="font-size:22px">Нов newsletter абонамент</h1><table style="width:100%;max-width:720px;border-collapse:collapse">${rows}</table></div>`,
      });
      // Keep the exact timestamp/body/key for retries in this warm instance.
      // A new instance has a new receipt timestamp; cross-instance deduplication is best effort.
      notification = { at: now, body, key: `newsletter-${payloadKey}-${crypto.randomUUID()}` };
      notifications.set(payloadKey, notification);
    }
    const entry = notification;
    entry.pending = (async () => {
      try {
        const apiKey = import.meta.env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
        if (!apiKey) throw new Error("Resend is not configured");
        const response = await fetch(RESEND_URL, { method: "POST", signal: AbortSignal.timeout(15_000),
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": entry.key },
          body: entry.body,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || typeof result.id !== "string" || !result.id) {
          console.error(`Newsletter notification failed: Resend ${response.status}`);
          return null;
        }
        entry.acceptedId = result.id;
        return result.id;
      } catch {
        console.error("Newsletter notification request failed");
        return null;
      }
    })();
  }
  const entry = notification!;
  const pending = entry.pending;
  const id = entry.acceptedId || (pending ? await pending : null);
  if (entry.pending === pending) entry.pending = undefined;
  if (!id) return json({ error: "Записването временно не е достъпно. Данните ти остават във формата — опитай отново.", code: "notification_unavailable" }, 503, origin);
  return json({ accepted: true, submission_id: id, notification_status: "sent" }, 202, origin);
};
