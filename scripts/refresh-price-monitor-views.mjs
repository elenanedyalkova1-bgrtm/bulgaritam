#!/usr/bin/env node
import { createGoogleSheetsHistory, createObservedProductStore } from "../src/lib/price-monitor/index.mjs";
import { deriveMaterializedViews, refreshMaterializedViews } from "../src/lib/price-monitor/materialized-views.mjs";
try { process.loadEnvFile?.(); } catch (error) { if (error?.code !== "ENOENT") throw error; }
const started = Date.now();
const progress = (stage, details = {}) => console.error(JSON.stringify({ stage, elapsed_ms: Date.now() - started, ...details }));
const request = async (url, options = {}) => {
  const host = new URL(url).hostname;
  const stage = host === "oauth2.googleapis.com" ? "authentication" : host === "sheets.googleapis.com" ? "google_sheets_request" : "baserow_pagination";
  const t = Date.now(); progress(`${stage}:start`);
  try { const response = await fetch(url, options); progress(`${stage}:response`, { status: response.status, duration_ms: Date.now() - t }); return response; }
  catch (error) { progress(`${stage}:error`, { duration_ms: Date.now() - t, error: error.message }); throw error; }
};
const client = createGoogleSheetsHistory({ spreadsheetId: process.env.GOOGLE_PRICE_MONITOR_SPREADSHEET_ID, serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, fetchImpl: request });
progress("baserow_pagination:start");
const observed = await createObservedProductStore({ token: process.env.BASEROW_API_TOKEN, tableId: process.env.BASEROW_OBSERVED_PRODUCTS_TABLE_ID, fetchImpl: request }).list();
progress("baserow_pagination:complete", { products: observed.length });
if (process.argv.includes("--apply")) {
  progress("refresh:start");
  console.log(JSON.stringify(await refreshMaterializedViews({ historyWriter: client, observedProducts: observed }), null, 2));
  progress("refresh:complete");
} else {
  progress("history_retrieval:start");
  const rows = (await client.getValues("Price History!A:S")).values || [];
  progress("history_retrieval:complete", { observations: rows.length - 1 });
  progress("product_reconciliation_and_view_derivation:start");
  const v = deriveMaterializedViews(rows.slice(1), observed);
  progress("product_reconciliation_and_view_derivation:complete", { products: v.product_count });
  console.log(JSON.stringify({ mode: "dry-run", observations: rows.length - 1, products: v.product_count, dates: v.dates, reliable_observations: v.reliable_observations }, null, 2));
}
