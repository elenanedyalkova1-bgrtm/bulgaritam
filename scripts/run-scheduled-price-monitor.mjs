#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { baserowUrl } from "./lib/baserow-url.mjs";
import {
  calculateDailyTarget, calculateRunCapacity, createAppsScriptFetchProvider, createBaserowCurrentStatePersistence, createGoogleSheetsHistory, isActiveMonitorable, monitorProduct, monitorProductWithAppsScriptFallback, persistMonitorResults, productDomain, runDomainThrottled,
  scheduledRunSummary, selectAllMonitorableProducts, selectDueProducts, withTransientRetry,
} from "../src/lib/price-monitor/index.mjs";

try { process.loadEnvFile?.(); } catch (error) { if (error?.code !== "ENOENT") throw error; }
const argv = process.argv.slice(2); const command = argv[0] || "due";
const args = new Map(argv.slice(1).map((value) => { const at = value.indexOf("="); return at < 0 ? [value, true] : [value.slice(0, at), value.slice(at + 1)]; }));
const arg = (name, fallback = "") => args.get(name) === true ? fallback : args.get(name) || fallback;
const write = args.has("--write-monitor-results"); const token = process.env.BASEROW_API_TOKEN;
const appsScriptFallback = args.has("--apps-script-fallback");
const productsTableId = process.env.BASEROW_TABLE_ID || "906650";
const requestedLimit = args.has("--limit") ? Math.max(1, Number(arg("--limit")) || 1) : null;
const concurrency = Math.min(8, Math.max(1, Number(arg("--concurrency", "6")) || 6));
const domainDelayMs = Math.max(1_000, Number(arg("--domain-delay-ms", "2000")) || 2_000);
const timeoutMs = Math.max(5_000, Number(arg("--timeout-ms", "15000")) || 15_000);
const outputPath = path.resolve(arg("--output", `reports/price-monitor-run-${new Date().toISOString().slice(0, 10)}.json`));
if (!token) throw new Error("BASEROW_API_TOKEN is required");

const clean = (value) => String(value ?? "").trim();
async function fetchProducts() {
  const rows = []; let next = `https://api.baserow.io/api/database/rows/table/${productsTableId}/?user_field_names=true&size=200`;
  while (next) {
    const response = await fetch(baserowUrl(next), { headers: { Authorization: `Token ${token}` } });
    if (!response.ok) throw new Error(`Baserow read failed: ${response.status} ${response.statusText}`);
    const data = await response.json(); rows.push(...(data.results || [])); next = data.next || "";
  }
  return rows.filter((row) => /^https?:\/\//i.test(clean(row.product_url))).map((row) => ({
    ...row, product_id: row.id, product_slug: clean(row.slug), product_name: clean(row.name_bg),
    brand_name: clean(row.brand_name) || clean(row.brand_ref?.[0]?.value), domain: productDomain(row.product_url),
    offer_price_amount: row.offer_price_amount ?? null, offer_price_currency: row.offer_price_currency ?? null,
  }));
}

const catalog = await fetchProducts(); let selection; let dueStats = null;
const dailyTarget = calculateDailyTarget(catalog.filter(isActiveMonitorable).length, 7);
const runCapacity = calculateRunCapacity(dailyTarget);
const manualLimit = Math.min(requestedLimit ?? Math.max(1, dailyTarget), Math.max(1, runCapacity));
if (command === "one") {
  const key = arg("--slug") || arg("--id"); selection = catalog.filter((row) => row.product_slug === key || String(row.id) === String(key)).slice(0, 1);
} else if (command === "domain") {
  const hostname = clean(arg("--domain")).toLowerCase().replace(/^www\./, ""); const brand = clean(arg("--brand")).toLocaleLowerCase("bg");
  if (!hostname && !brand) throw new Error("domain requires --domain=hostname or --brand=name");
  selection = catalog.filter((row) => hostname ? row.domain === hostname : clean(row.brand_name).toLocaleLowerCase("bg") === brand).slice(0, manualLimit);
} else if (command === "batch") {
  selection = catalog.slice().sort((a, b) => Number(a.id) - Number(b.id)).slice(0, manualLimit);
} else if (command === "all-read-only") {
  if (write) throw new Error("all-read-only cannot be used with --write-monitor-results");
  selection = catalog.slice().sort((a, b) => Number(a.id) - Number(b.id));
} else if (command === "all") {
  selection = selectAllMonitorableProducts(catalog);
} else if (command === "due") {
  const due = selectDueProducts(catalog, { limit: requestedLimit ?? undefined, cycleDays: 7 }); selection = due.selected;
  dueStats = { total_due: due.total_due, deferred_due: due.deferred_due, active_monitorable: due.active_monitorable, cycle_days: due.cycle_days, daily_target: due.daily_target, run_capacity: due.run_capacity };
} else throw new Error("Commands: one --slug/--id, domain --domain/--brand, batch --limit, all-read-only, all, due --limit");
if (!selection.length) throw new Error("No matching products to check");

const currentWriter = write ? createBaserowCurrentStatePersistence({ token, productsTableId }) : null;
const historyWriter = write ? createGoogleSheetsHistory({ spreadsheetId: process.env.GOOGLE_PRICE_MONITOR_SPREADSHEET_ID, serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY }) : null;
const fallbackProvider = appsScriptFallback ? createAppsScriptFetchProvider({ endpoint: process.env.APPS_SCRIPT_PRICE_FETCH_URL, secret: process.env.APPS_SCRIPT_PRICE_FETCH_SECRET }) : null;
const startedAt = Date.now(); const retryEvents = [];
const results = await runDomainThrottled(selection, async (product) => {
  if (appsScriptFallback) {
    const run = await monitorProductWithAppsScriptFallback(product, {
      fallbackProvider, timeoutMs, retries: 2,
      onRetry: (event) => retryEvents.push({ product_id: product.id, domain: product.domain, ...event }),
    });
    const result = run.canonical;
    result.attempts = run.direct.attempts;
    result.fetch_provider = run.fallbackPage ? "apps_script_fallback" : "node_direct";
    result.fallback_attempted = run.fallbackAttempted;
    result.normal_node_result = { status: run.directCanonical.status, http_status: run.directCanonical.http_status, error_reason: run.directCanonical.error_reason };
    result.fallback_result = run.fallbackAttempted ? { status: run.fallbackPage ? result.status : "error", http_status: run.fallbackPage?.httpStatus ?? null, error_reason: run.fallbackError } : null;
    return result;
  }
  const { result, attempts } = await withTransientRetry(
    () => monitorProduct(product, { timeoutMs }),
    { retries: 2, baseDelayMs: 1_000, onRetry: (event) => retryEvents.push({ product_id: product.id, domain: product.domain, ...event }) },
  );
  result.attempts = attempts;
  return result;
}, { concurrency, domainDelayMs });
let persistence = null; let persistenceError = null;
try {
  persistence = write ? await persistMonitorResults(results, { write: true, historyWriter, currentWriter }) : await persistMonitorResults(results);
} catch (error) {
  persistenceError = error instanceof Error ? error.message : String(error);
}
const finishedAt = Date.now();
const report = {
  generated_at: new Date(finishedAt).toISOString(), mode: write ? "write-monitor-results" : "dry-run", writes_performed: write && !persistenceError,
  command, configuration: { selected: selection.length, requested_limit: requestedLimit, daily_target: dailyTarget, max_bounded_run: runCapacity, concurrency, per_domain_concurrency: 1, domain_delay_ms: domainDelayMs, timeout_ms: timeoutMs, max_retries: 2, apps_script_fallback: appsScriptFallback },
  due: dueStats, summary: scheduledRunSummary(results, startedAt, finishedAt), persistence, persistence_error: persistenceError, retry_events: retryEvents, results,
};
await fs.mkdir(path.dirname(outputPath), { recursive: true }); await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output: outputPath, mode: report.mode, configuration: report.configuration, due: report.due, summary: report.summary, retries: retryEvents.length }, null, 2));
if (persistenceError) {
  console.error(`Persistence failed after monitoring; diagnostic report preserved at ${outputPath}: ${persistenceError}`);
  process.exitCode = 1;
}
