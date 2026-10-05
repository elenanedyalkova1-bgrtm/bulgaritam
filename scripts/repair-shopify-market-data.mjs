#!/usr/bin/env node
import fs from "node:fs/promises";
import { baserowUrl } from "./lib/baserow-url.mjs";
import {
  buildPersistencePlan, createBaserowCurrentStatePersistence, createGoogleSheetsHistory, createObservedProductStore,
  isReliableDetectedObservation, monitorProduct, PRICE_HISTORY_HEADERS, trustedOfferCurrency,
} from "../src/lib/price-monitor/index.mjs";

try { process.loadEnvFile?.(); } catch (error) { if (error?.code !== "ENOENT") throw error; }
const write = process.argv.includes("--write-monitor-results");
const CONFIRMED_DOMAINS = new Set(["aurababy.bg", "witchcraftbotanicals.com", "dvetestudio.com", "affectbg.com", "goud.bg"]);
const EXPECTED_BAD_HISTORY = 120;
const EXPECTED_ACTIVE_OBSERVED = 99;
const token = process.env.BASEROW_API_TOKEN;
const observedTableId = process.env.BASEROW_OBSERVED_PRODUCTS_TABLE_ID;
const productsTableId = process.env.BASEROW_TABLE_ID || "906650";
if (!token || !observedTableId) throw new Error("Baserow configuration is required");

const history = createGoogleSheetsHistory({
  spreadsheetId: process.env.GOOGLE_PRICE_MONITOR_SPREADSHEET_ID,
  serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
});
const observedStore = createObservedProductStore({ token, tableId: observedTableId });
const catalogWriter = createBaserowCurrentStatePersistence({ token, productsTableId });
const domain = (value) => { try { return new URL(String(value || "")).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
const reliableRepair = (result) => ["verified", "changed", "redirected"].includes(result.status)
  && ["high", "medium"].includes(result.confidence) && result.currency === "EUR"
  && result.evidence?.shopify_market?.valid === true && result.evidence.shopify_market.shopify_country === "BG"
  && result.evidence.shopify_market.shopify_active_currency === "EUR"
  && (!result.regular_price || result.regular_price_currency === "EUR");

async function baserowRows(tableId) {
  const rows = []; let next = `https://api.baserow.io/api/database/rows/table/${tableId}/?user_field_names=true&size=200`;
  while (next) {
    const response = await fetch(baserowUrl(next), { headers: { Authorization: `Token ${token}` } });
    if (!response.ok) throw new Error(`Baserow read failed (${response.status})`);
    const page = await response.json(); rows.push(...(page.results || [])); next = page.next || "";
  }
  return rows;
}

const [observedRows, catalogRows, brandRows, sheetValues] = await Promise.all([
  observedStore.list(), baserowRows(productsTableId), baserowRows(process.env.BASEROW_BRANDS_TABLE_ID || "1133942"), history.getValues("Price History!A2:S"),
]);
const brandsById = new Map(brandRows.map((row) => [String(row.id), String(row.brand_name || "").trim()]));
const observedCohort = observedRows.filter((row) => row.is_active === true && String(row.currency).toUpperCase() === "USD" && CONFIRMED_DOMAINS.has(domain(row.source_url || row.canonical_url)));
if (observedCohort.length !== EXPECTED_ACTIVE_OBSERVED) throw new Error(`STOP: expected ${EXPECTED_ACTIVE_OBSERVED} active USD Observed Products, found ${observedCohort.length}`);

const rawHistory = sheetValues.values || [];
const historyRows = rawHistory.map((values, index) => ({ values, sheetRow: index + 2, row: Object.fromEntries(PRICE_HISTORY_HEADERS.map((header, column) => [header, values[column] ?? ""])) }));
const invalidations = historyRows.filter(({ row }) => String(row.currency).toUpperCase() === "USD"
  && CONFIRMED_DOMAINS.has(domain(row.product_url)) && isReliableDetectedObservation(row));
if (invalidations.length !== EXPECTED_BAD_HISTORY) throw new Error(`STOP: expected ${EXPECTED_BAD_HISTORY} wrong-market history rows, found ${invalidations.length}`);

const repaired = []; const failures = [];
for (const row of observedCohort) {
  const brandName = brandsById.get(String(row.brand_id));
  if (!brandName) throw new Error(`STOP: unresolved canonical brand for Observed Product ${row.id}`);
  const result = await monitorProduct({ entity_type: "observed_product", entity_id: row.id, product_id: null, product_name: row.title, brand_name: brandName, product_url: row.canonical_url || row.source_url }, { timeoutMs: 30_000 });
  if (reliableRepair(result)) repaired.push({ row, result });
  else failures.push({ entity_type: "observed_product", entity_id: row.id, url: row.source_url, status: result.status, reason: result.error_reason, currency: result.currency, market: result.evidence?.shopify_market || null });
}

const affect = catalogRows.find((row) => Number(row.id) === 566);
if (!affect) throw new Error("STOP: catalog Product 566 not found");
const affectResult = await monitorProduct({
  entity_type: "catalog_product", entity_id: "566", product_id: 566, product_name: affect.name_bg, brand_name: affect.brand_name,
  product_url: affect.product_url, offer_price_amount: affect.offer_price_amount ?? affect.exact_price_no_discount ?? null,
  offer_price_currency: trustedOfferCurrency(affect.offer_price_currency, affect.currency), offer_price_status: affect.offer_price_status,
}, { timeoutMs: 30_000 });
if (!reliableRepair(affectResult)) failures.push({ entity_type: "catalog_product", entity_id: 566, url: affect.product_url, status: affectResult.status, reason: affectResult.error_reason, currency: affectResult.currency, market: affectResult.evidence?.shopify_market || null });

const report = {
  generated_at: new Date().toISOString(), mode: write ? "write-monitor-results" : "dry-run", writes_performed: false,
  cohort: { active_observed: observedCohort.length, historical_invalidations: invalidations.length, catalog_products: 1 },
  successful_refetches: repaired.length + (reliableRepair(affectResult) ? 1 : 0), failures,
  samples: repaired.map(({ row, result }) => ({ id: row.id, domain: domain(row.source_url), title: row.title, old: { current: row.current_price, currency: row.currency, regular: row.regular_price, regular_currency: row.regular_price_currency }, fresh: { current: result.detected_price, currency: result.currency, regular: result.regular_price, regular_currency: result.regular_price_currency, method: result.extraction_method, market: result.evidence?.shopify_market } })),
  affect_566: { current: affectResult.detected_price, currency: affectResult.currency, regular: affectResult.regular_price, status: affectResult.status, market: affectResult.evidence?.shopify_market },
  invalidated_observation_ids: invalidations.map(({ row }) => row.observation_id),
};

if (write) {
  const updates = invalidations.map(({ values, sheetRow, row }) => {
    const cells = Array.from({ length: 10 }, (_, offset) => values[7 + offset] ?? "");
    cells[0] = "invalidated_currency_market";
    let existing = cells[9];
    try { existing = existing ? JSON.parse(existing) : null; } catch {}
    cells[9] = JSON.stringify({ original_evidence: existing, invalidation: { reason: "shopify_market_not_pinned_us_presentment", invalidated_at: report.generated_at } });
    return { range: `Price History!H${sheetRow}:Q${sheetRow}`, majorDimension: "ROWS", values: [cells] };
  });
  await history.batchUpdateValues(updates, "RAW");
  const correctedResults = repaired.map(({ result }) => result);
  if (reliableRepair(affectResult)) correctedResults.push(affectResult);
  report.history_append = await history.append(correctedResults);
  for (const { row, result } of repaired) {
    await observedStore.update(row.id, {
      current_price: result.detected_price, currency: result.currency, regular_price: result.regular_price,
      regular_price_currency: result.regular_price_currency, last_checked_at: result.checked_at,
      reader_status: result.extraction_status || result.status, reader_error: result.error_reason,
    });
  }
  if (reliableRepair(affectResult)) await catalogWriter.write(buildPersistencePlan(affectResult));
  report.writes_performed = true;
}

await fs.writeFile("/tmp/shopify-market-repair-report.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ report: "/tmp/shopify-market-repair-report.json", mode: report.mode, cohort: report.cohort, successful_refetches: report.successful_refetches, failures: report.failures.length, affect_566: report.affect_566, history_append: report.history_append || null, writes_performed: report.writes_performed }, null, 2));
