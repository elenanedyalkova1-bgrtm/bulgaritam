import { PRICE_HISTORY_HEADERS, PRICES_HEADERS, isReliableDetectedObservation } from "./google-sheets-history.mjs";
import { normalizeExternalProductUrl } from "./product-metadata.mjs";

const text = (v) => String(v ?? "").trim();
const record = (r) => Array.isArray(r) ? Object.fromEntries(PRICE_HISTORY_HEADERS.map((k, i) => [k, r[i] ?? ""])) : r;
const time = (r) => Date.parse(text(r.checked_at)) || 0;
const languageAlias = (a,b) => {
  if (!a || !b) return false;
  const x = new URL(a); const y = new URL(b);
  return x.hostname === y.hostname && !x.search && !y.search && x.pathname.replace(/^\/en(?=\/)/i, "") === y.pathname.replace(/^\/en(?=\/)/i, "");
};

// Derive both views in one pass, with unambiguous exact URL/explicit catalog links.
export function deriveMaterializedViews(rawHistory, observedProducts = []) {
  const history = rawHistory.map(record);
  const urls = new Map();
  for (const r of history) if (text(r.product_id) && r.entity_type !== "observed_product") {
    const u = normalizeExternalProductUrl(r.product_url); if (!u) continue;
    if (!urls.has(u)) urls.set(u, new Set()); urls.get(u).add(text(r.product_id));
  }
  const observed = new Map(observedProducts.map((r) => [text(r.id), r]));
  const groups = new Map(); const dates = new Set(); let reliableObservations = 0;
  for (const r of history) {
    if (!time(r)) continue;
    const external = r.entity_type === "observed_product"; const oid = text(r.entity_id);
    const known = external ? observed.get(oid) : null; const u = normalizeExternalProductUrl(r.product_url);
    const knownSource = normalizeExternalProductUrl(known?.source_url);
    const knownCanonical = normalizeExternalProductUrl(known?.canonical_url);
    const sameSource = u && (u === knownSource || u === knownCanonical || languageAlias(u, knownCanonical));
    const matched = u && urls.get(u)?.size === 1 ? [...urls.get(u)][0] : "";
    const catalog = text(r.product_id) || (external && sameSource ? text(known?.bulgaritam_product_id) : "") || matched;
    const id = catalog ? `catalog:${catalog}` : external && oid ? (known && !sameSource ? `url:${u}` : `observed:${oid}`) : "";
    if (!id) continue;
    if (!groups.has(id)) groups.set(id, { id, latest: r, title: null, titleAt: 0, brand: null, brandAt: 0, rows: [], daily: new Map() });
    const g = groups.get(id); if (time(r) > time(g.latest)) g.latest = r;
    const title = text(r.product_name) || (sameSource ? text(known?.title) : "");
    if (title && time(r) >= g.titleAt) { g.title = title; g.titleAt = time(r); }
    if (text(r.brand) && time(r) >= g.brandAt) { g.brand = text(r.brand); g.brandAt = time(r); }
    if (!isReliableDetectedObservation(r) || !text(r.currency)) continue;
    reliableObservations++; g.rows.push(r); const date = text(r.checked_at).slice(0, 10); dates.add(date);
    if (!g.daily.has(date) || time(r) > time(g.daily.get(date))) g.daily.set(date, r);
  }
  const periods = [...dates].sort(); const products = [...groups.values()].sort((a,b) => a.id.localeCompare(b.id));
  const prices = [PRICES_HEADERS]; const timeline = [["product_id", "Product", "Brand", "Product URL", ...periods]];
  for (const g of products) {
    g.rows.sort((a,b) => time(b)-time(a)); const [current, previous] = g.rows; const amount = current ? Number(current.detected_price) : null; const previousAmount = previous ? Number(previous.detected_price) : null;
    const name = g.title || text(g.latest.product_url); const brand = g.brand || ""; const url = text(g.latest.product_url);
    prices.push([g.id,name,brand,url,amount ?? "",previousAmount ?? "",amount != null && previousAmount != null && text(current.currency) === text(previous.currency) ? Math.round((amount-previousAmount)*10000)/10000 : "",text(current?.currency),text(g.latest.checked_at),text(g.latest.status),text(current?.extraction_method),text(current?.confidence),amount ?? ""]);
    timeline.push([g.id,name,brand,url,...periods.map((d) => { const row=g.daily.get(d); return row ? `${row.detected_price} ${text(row.currency)}` : ""; })]);
  }
  return { prices, timeline, product_count: products.length, reliable_observations: reliableObservations, dates: periods.length };
}

export function viewBatchRequests(metadata, views) {
  const byName = new Map(metadata.sheets.map((s) => [s.properties.title, s.properties]));
  const requests = [];
  for (const [title, values] of [["Prices", views.prices], ["Price Timeline", views.timeline]]) {
    const sheet = byName.get(title); if (!sheet) throw new Error(`Missing view sheet: ${title}`);
    const rowCount = Math.max(sheet.gridProperties.rowCount, values.length);
    const columnCount = Math.max(sheet.gridProperties.columnCount, ...values.map((r) => r.length));
    if (rowCount !== sheet.gridProperties.rowCount || columnCount !== sheet.gridProperties.columnCount) requests.push({ updateSheetProperties: { properties: { sheetId: sheet.sheetId, gridProperties: { rowCount, columnCount } }, fields: "gridProperties(rowCount,columnCount)" } });
    requests.push({ repeatCell: { range: { sheetId: sheet.sheetId, startColumnIndex: 0, ...(title === "Prices" ? { endColumnIndex: PRICES_HEADERS.length } : {}) }, cell: {}, fields: "userEnteredValue" } });
    const rows = values.map((r) => ({ values: r.map((v) => v === "" || v == null ? {} : { userEnteredValue: typeof v === "number" ? { numberValue: v } : { stringValue: String(v) } }) }));
    requests.push({ updateCells: { start: { sheetId: sheet.sheetId, rowIndex: 0, columnIndex: 0 }, rows, fields: "userEnteredValue" } });
  }
  return requests;
}

export async function refreshMaterializedViews({ historyWriter, observedProducts = [] }) {
  const started = Date.now();
  const [metadata, history] = await Promise.all([historyWriter.metadata(), historyWriter.getValues("Price History!A:S")]);
  const rows = history.values || [];
  if (JSON.stringify((rows[0] || []).slice(0, PRICE_HISTORY_HEADERS.length)) !== JSON.stringify(PRICE_HISTORY_HEADERS)) throw new Error("Price History headers do not match; views were not updated");
  const views = deriveMaterializedViews(rows.slice(1), observedProducts);
  await historyWriter.batchUpdate(viewBatchRequests(metadata, views));
  return { products: views.product_count, reliable_observations: views.reliable_observations, dates: views.dates, sheets_requests: 3, elapsed_ms: Date.now() - started };
}
