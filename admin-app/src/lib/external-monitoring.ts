import { listRows, updateRow } from "./baserow";
import { createGoogleSheetsHistory, evaluateDiscounts, PRICE_HISTORY_HEADERS } from "../../../src/lib/price-monitor/index.mjs";

const env = (name: string) => import.meta.env?.[name] || process.env?.[name] || "";
export const OBSERVED_PRODUCTS_TABLE = env("BASEROW_OBSERVED_PRODUCTS_TABLE_ID");
export const externalGlobalEnabled = ["1", "true", "yes"].includes(env("EXTERNAL_MONITORING_ENABLED").toLowerCase());
export async function listObservedProducts() { return OBSERVED_PRODUCTS_TABLE ? (await listRows(OBSERVED_PRODUCTS_TABLE)).filter((row: any) => String(row.canonical_key || "").trim()) : []; }
export async function setBrandExternalPause(brandId: number, paused: boolean) { return updateRow(env("BASEROW_BRANDS_TABLE_ID") || "1133942", brandId, { external_monitoring_paused: paused }); }

export async function loadExternalHistory() {
  const spreadsheetId = env("GOOGLE_PRICE_MONITOR_SPREADSHEET_ID"); const email = env("GOOGLE_SERVICE_ACCOUNT_EMAIL"); const key = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  if (!spreadsheetId || !email || !key) return [];
  const client = createGoogleSheetsHistory({ spreadsheetId, serviceAccountEmail: email, privateKey: key } as any);
  return (await client.getValues("Price History!A2:S")).values || [];
}

export function externalOperations(observed: any[], history: any[], brands: any[], dailyBudget = 500) {
  const rows = history.map((values: any[]) => Object.fromEntries(PRICE_HISTORY_HEADERS.map((header: string, index: number) => [header, values[index] ?? ""])))
    .filter((row: any) => (row.entity_type || (row.product_id ? "catalog_product" : "")) === "observed_product");
  const latest = new Map<string, any>();
  for (const row of rows) if (!latest.has(String(row.entity_id)) || Date.parse(row.checked_at) > Date.parse(latest.get(String(row.entity_id)).checked_at)) latest.set(String(row.entity_id), row);
  const start = new Date(); start.setUTCHours(0, 0, 0, 0); const checksToday = rows.filter((row: any) => Date.parse(row.checked_at) >= start.getTime()).length;
  const evaluations = evaluateDiscounts(rows, { week_start: new Date(Date.now() - 7 * 86400000).toISOString(), week_end: new Date(Date.now() + 86400000).toISOString() });
  const deals = evaluations.filter((row: any) => row.weekly_discount_eligible);
  const review = evaluations.filter((row: any) => row.active_sale || row.verified_price_drop);
  const brandMap = new Map(brands.map((brand: any) => [String(brand.id), brand]));
  const cards = (items: any[]) => items.map((deal: any) => { const product = observed.find((row) => String(row.id) === String(deal.entity_id)); return product ? { ...deal, product, brand: brandMap.get(String(product.brand_id)) } : null; }).filter(Boolean);
  const dealCards = cards(deals); const reviewCards = cards(review);
  const latestRows = [...latest.values()]; const count = (status: string) => latestRows.filter((row: any) => row.status === status).length;
  return {
    summary: { observed: observed.length, active: observed.filter((row) => row.is_active !== false).length, successful: latestRows.filter((row: any) => ["verified", "changed", "redirected"].includes(row.status)).length, failed: latestRows.filter((row: any) => ["error", "dead_url"].includes(row.status)).length, blocked: count("blocked"), ambiguous: count("ambiguous"), notDetected: count("not_detected"), deals: dealCards.length, matched: observed.filter((row) => row.bulgaritam_product_id).length, unmatched: observed.filter((row) => !row.bulgaritam_product_id).length, checksToday, remainingBudget: Math.max(0, dailyBudget - checksToday) },
    latest, dealCards, reviewCards,
  };
}
