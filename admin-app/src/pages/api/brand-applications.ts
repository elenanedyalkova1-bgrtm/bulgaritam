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
const acceptedEmails = new Map<string, { at: number; submissionId: string }>();
const inFlightEmails = new Map<string, Promise<string | null>>();
const clean = (value: unknown, max = 500) => String(value ?? "").trim().replace(/\r\n/g, "\n").slice(0, max);
const cleanList = (value: unknown, allowed: Set<string>, maxItems = 20) =>
  (Array.isArray(value) ? value : []).map((item) => clean(item, 160)).filter((item) => allowed.has(item)).slice(0, maxItems);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
}[character] || character));
const validUrl = (value: string) => {
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
};
const normalizeUrl = (value: unknown, max = 500) => {
  const cleaned = clean(value, max);
  if (!cleaned || /^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)) return cleaned;
  return `https://${cleaned.replace(/^\/\//, "")}`;
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

  const raw = await request.text();
  if (!raw || raw.length > 18_000) return json({ error: "Invalid payload" }, 400, origin);
  let input: Record<string, unknown>;
  try { input = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400, origin); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return json({ error: "Invalid payload" }, 400, origin);
  if (clean(input.company, 100)) return json({ error: "Invalid payload" }, 400, origin);

  const startedAt = Number(input.started_at || 0);
  const elapsed = Date.now() - startedAt;
  if (!startedAt || elapsed < 2500 || elapsed > 86_400_000) return json({ error: "Invalid form session" }, 400, origin);

  const brandName = clean(input.brand_name, 160);
  const contactName = clean(input.contact_name, 160);
  const email = clean(input.email, 240).toLowerCase();
  const phone = clean(input.phone, 80);
  const website = normalizeUrl(input.website);
  const instagram = normalizeUrl(input.instagram);
  const facebook = normalizeUrl(input.facebook);
  const physicalAddress = clean(input.physical_address, 500);
  const brandStory = clean(input.brand_story, 3000);
  const contributionOptions = new Set(["Дизайн", "Разработка", "Производство", "Ръчна изработка", "Персонализация", "Друг съществен принос"]);
  const ownContribution = cleanList(input.own_contribution, contributionOptions, 8);
  const ownContributionOther = clean(input.own_contribution_other, 300);
  const deliversOutsideBulgaria = clean(input.delivers_outside_bulgaria, 3);
  if (!brandName || !contactName || !/^\S+@\S+\.\S+$/.test(email) || !brandStory || !ownContribution.length || !["Да", "Не"].includes(deliversOutsideBulgaria)) {
    return json({ error: "Please complete the required fields" }, 400, origin);
  }
  if (![website, instagram, facebook].some(Boolean)) return json({ error: "Provide a website, Instagram or Facebook profile" }, 400, origin);
  if (website && !validUrl(website)) return json({ error: "Invalid website URL" }, 400, origin);
  if (facebook && !validUrl(facebook)) return json({ error: "Invalid Facebook URL" }, 400, origin);
  if (instagram && !validUrl(instagram)) return json({ error: "Invalid Instagram URL" }, 400, origin);
  if (input.consent !== true) return json({ error: "Consent is required" }, 400, origin);
  if (ownContribution.includes("Друг съществен принос") && !ownContributionOther) return json({ error: "Please describe the other contribution" }, 400, origin);

  const startBudgetOptions = new Set(["До €250", "€250–500", "€500–1 500", "€1 500–2 500", "€2 500–5 000", "€5 000–10 000", "€10 000+", "Предпочитам да не отговарям"]);
  const marketingBudgetOptions = new Set(["€0", "До €50", "€50–150", "€150–250", "€250–500", "€500–1 000", "€1 000+", "Предпочитам да не отговарям"]);
  const startBudget = clean(input.founder_start_budget, 80);
  const marketingBudget = clean(input.founder_marketing_budget, 80);
  if ((startBudget && !startBudgetOptions.has(startBudget)) || (marketingBudget && !marketingBudgetOptions.has(marketingBudget))) return json({ error: "Invalid budget option" }, 400, origin);
  const optional = {
    startYear: clean(input.founder_start_year, 4), startBudget,
    firstOrderTime: clean(input.founder_first_order_time, 100), firstOrderChannel: clean(input.founder_first_order_channel, 100),
    currentChannel: clean(input.founder_current_channel, 100), marketingBudget,
    advice: clean(input.founder_advice, 500), hardestPart: clean(input.founder_hardest_part, 500),
  };
  const supplierRecommendations = (Array.isArray(input.supplier_recommendations) ? input.supplier_recommendations : []).slice(0, 5).map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return { name: clean(row.name, 160), type: clean(row.type, 80), reason: clean(row.reason, 200) };
  }).filter((item) => item.name || item.type || item.reason);
  const hasOptionalAnswers = Object.values(optional).some(Boolean) || supplierRecommendations.length > 0;
  if (hasOptionalAnswers && input.optional_consent !== true) return json({ error: "Optional answer consent is required" }, 400, origin);

  const monthlyEmailOptIn = input.monthly_email === true;
  const sanitizedPayload = {
    started_at: startedAt, brand_name: brandName, website, instagram, facebook, physical_address: physicalAddress,
    delivers_outside_bulgaria: deliversOutsideBulgaria, brand_story: brandStory, own_contribution: ownContribution,
    own_contribution_other: ownContributionOther, contact_name: contactName, email, phone,
    consent: true, monthly_email: monthlyEmailOptIn, optional_consent: input.optional_consent === true,
    founder_start_year: optional.startYear, founder_start_budget: optional.startBudget,
    founder_first_order_time: optional.firstOrderTime, founder_first_order_channel: optional.firstOrderChannel,
    founder_current_channel: optional.currentChannel, founder_marketing_budget: optional.marketingBudget,
    founder_advice: optional.advice, founder_hardest_part: optional.hardestPart,
    supplier_recommendations: supplierRecommendations,
  };
  // Email-only hotfix: newsletter intent is preserved for manual follow-up.
  // No Baserow operation may delay or prevent the application email.
  const newsletterStatus = monthlyEmailOptIn ? "manual_follow_up" : "not_requested";
  const payloadKey = await digest(JSON.stringify(sanitizedPayload));
  const applicationId = payloadKey;

  const fields = [
    ["Име на бранда", brandName],
    ["Лице за контакт", contactName],
    ["Email", email],
    ["Телефон", phone || "—"],
    ["Сайт", website || "—"],
    ["Instagram", instagram || "—"],
    ["Facebook", facebook || "—"],
    ["Физически адрес", physicalAddress || "—"],
    ["Доставка извън България", deliversOutsideBulgaria],
    ["История на бранда", brandStory],
    ["Собствен принос", [...ownContribution, ownContributionOther && `Уточнение: ${ownContributionOther}`].filter(Boolean).join("\n")],
    ["Съгласие за обработка и контакт", "Да"],
    ["Application ID", applicationId],
    ["Newsletter sync", newsletterStatus],
    ["Месечен имейл", monthlyEmailOptIn ? "Да — заявка за ръчно добавяне" : "Не"],
    ["Съгласие за допълнителните отговори", input.optional_consent === true ? "Да" : "Не"],
    ["Начало на попълване", new Date(startedAt).toISOString()],
  ];
  if (hasOptionalAnswers) fields.push(
    ["Година на стартиране", optional.startYear || "—"], ["Начален бюджет", optional.startBudget || "—"],
    ["Време до първа поръчка", optional.firstOrderTime || "—"], ["Канал на първата поръчка", optional.firstOrderChannel || "—"],
    ["Основен канал днес", optional.currentChannel || "—"], ["Начален маркетинг бюджет", optional.marketingBudget || "—"],
    ["Съвет към нов бранд", optional.advice || "—"], ["Най-трудното в началото", optional.hardestPart || "—"],
    ["Препоръчани доставчици", supplierRecommendations.length ? supplierRecommendations.map((item, index) => `${index + 1}. ${item.name || "—"} | ${item.type || "—"} | ${item.reason || "—"}`).join("\n") : "—"],
  );
  const textBody = ["Нова кандидатура от формуляра „Стани партньор“", "", ...fields.map(([label, value]) => `${label}:\n${value}`)].join("\n\n");
  const htmlRows = fields.map(([label, value]) =>
    `<tr><th style="padding:10px;text-align:left;vertical-align:top;border-bottom:1px solid #e7e1da">${escapeHtml(label)}</th><td style="padding:10px;white-space:pre-wrap;border-bottom:1px solid #e7e1da">${escapeHtml(value)}</td></tr>`
  ).join("");

  const now = Date.now();
  for (const [key, entry] of acceptedEmails) if (now - entry.at > 10 * 60_000) acceptedEmails.delete(key);
  let submissionId = acceptedEmails.get(payloadKey)?.submissionId;
  if (!submissionId) {
    let pending = inFlightEmails.get(payloadKey);
    if (!pending) {
      const ip = clientAddress || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const attempts = (recentByIp.get(ip) || []).filter((time) => now - time < 10 * 60_000);
      if (attempts.length >= 3) return json({ error: "Too many applications" }, 429, origin);
      recentByIp.set(ip, [...attempts, now]);
      for (const [key, times] of recentByIp) if (times.every((time) => now - time > 10 * 60_000)) recentByIp.delete(key);
      pending = (async () => {
        try {
          if (!apiKey) throw new Error("Resend is not configured");
          const response = await fetch(RESEND_URL, {
            method: "POST",
            signal: AbortSignal.timeout(15_000),
            headers: {
              Authorization: `Bearer ${apiKey}`,
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
          const body = await response.json().catch(() => ({}));
          if (!response.ok || typeof body.id !== "string" || !body.id) {
            console.error(`Brand application email failed: Resend ${response.status}`);
            return null;
          }
          acceptedEmails.set(payloadKey, { at: Date.now(), submissionId: body.id });
          return body.id;
        } catch {
          console.error("Brand application email request failed");
          return null;
        }
      })();
      inFlightEmails.set(payloadKey, pending);
      void pending.finally(() => inFlightEmails.delete(payloadKey));
    }
    submissionId = (await pending) || undefined;
  }
  if (!submissionId) {
    return json({ error: "Application email is temporarily unavailable", code: "notification_unavailable", notification_status: "failed" }, 503, origin);
  }
  return json({ accepted: true, application_id: applicationId, submission_id: submissionId, notification_status: "sent", newsletter_status: newsletterStatus }, 202, origin);
};
