#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { baserowUrl } from "./lib/baserow-url.mjs";
import {
  createGoogleSheetsHistory, createObservedProductStore, discoverBrandProducts, externalBrandMonitoringEligible, externalMonitoringEnabled,
  matchObservedToCatalog, monitorProduct, nextObservedLifecycle, observedProductRecord, runDomainThrottled,
  selectDiscoveryCandidates, selectExternalDue, withTransientRetry,
} from "../src/lib/price-monitor/index.mjs";

try { process.loadEnvFile?.(); } catch (error) { if (error?.code !== "ENOENT") throw error; }
const argv = process.argv.slice(2); const command = argv[0] || "monitor";
const args = new Map(argv.slice(1).map((item) => { const at = item.indexOf("="); return at < 0 ? [item, true] : [item.slice(0, at), item.slice(at + 1)]; }));
const arg = (name, fallback = "") => args.get(name) === true ? fallback : args.get(name) || fallback;
const write = args.has("--write-monitor-results");
const output = path.resolve(arg("--output", `/tmp/external-monitor-${new Date().toISOString().slice(0, 10)}.json`));
const globalEnabled = externalMonitoringEnabled();
if (!globalEnabled) throw new Error("EXTERNAL_MONITORING_ENABLED is OFF; external discovery and monitoring are disabled");
const token = process.env.BASEROW_API_TOKEN; const observedTableId = process.env.BASEROW_OBSERVED_PRODUCTS_TABLE_ID;
if (!token) throw new Error("BASEROW_API_TOKEN is required");
if (write && !observedTableId) throw new Error("BASEROW_OBSERVED_PRODUCTS_TABLE_ID is required for writes");
const brandsTable = process.env.BASEROW_BRANDS_TABLE_ID || "1133942"; const productsTable = process.env.BASEROW_TABLE_ID || "906650";
const budget = Math.min(10_000, Math.max(1, Number(arg("--daily-budget", process.env.EXTERNAL_MONITOR_DAILY_BUDGET || "500")) || 500));
const perDomainCap = Math.max(1, Number(arg("--per-domain-cap", process.env.EXTERNAL_MONITOR_DOMAIN_DAILY_CAP || "50")) || 50);
const discoveryBudget = Math.min(5_000, Math.max(1, Number(arg("--discovery-budget", process.env.EXTERNAL_DISCOVERY_RUN_BUDGET || "1000")) || 1_000));
const perBrandDiscoveryCap = Math.min(1_000, Math.max(1, Number(arg("--max-products-per-brand", process.env.EXTERNAL_DISCOVERY_BRAND_CAP || "250")) || 250));
const perBrandDiscoveryScanCap = Math.min(10_000, Math.max(perBrandDiscoveryCap, Number(arg("--max-scanned-products-per-brand", process.env.EXTERNAL_DISCOVERY_SCAN_CAP || "1000")) || 1_000));
const timeoutMs = Math.max(5_000, Number(arg("--timeout-ms", "15000")) || 15_000); const concurrency = Math.min(12, Math.max(1, Number(arg("--concurrency", "6")) || 6));
const domainDelayMs = Math.max(1_000, Number(arg("--domain-delay-ms", "2000")) || 2_000);

async function rows(table) { const result=[];let next=`https://api.baserow.io/api/database/rows/table/${table}/?user_field_names=true&size=200`;while(next){const response=await fetch(baserowUrl(next),{headers:{Authorization:`Token ${token}`}});if(!response.ok)throw new Error(`Baserow ${response.status}`);const page=await response.json();result.push(...(page.results||[]));next=page.next||"";}return result; }
const [brands, catalog] = await Promise.all([rows(brandsTable), rows(productsTable)]);
const enabledBrands = brands.filter((brand) => /^https?:\/\//i.test(String(brand.brand_url || ""))
  && externalBrandMonitoringEligible(brand));
const selectedBrandIds = new Set(String(arg("--brand-ids", "")).split(",").map((v) => v.trim()).filter(Boolean));
const selectedBrands = selectedBrandIds.size ? enabledBrands.filter((brand) => selectedBrandIds.has(String(brand.id))) : enabledBrands;
const store = observedTableId ? createObservedProductStore({ token, tableId: observedTableId }) : null;
const existing = store ? await store.list() : [];
const report = { generated_at: new Date().toISOString(), mode: write ? "write" : "dry-run", writes_performed: false, command, global_enabled: true, enabled_brands: selectedBrands.length, discovery: [], discovery_observations: [], monitoring: null, errors: [] };

if (["discover", "all"].includes(command)) {
  let discoveryProcessed = 0;
  for (const brand of selectedBrands) {
    if (discoveryProcessed >= discoveryBudget) break;
    try {
      const brandBudget = Math.min(perBrandDiscoveryCap, discoveryBudget - discoveryProcessed);
      const found = await discoverBrandProducts({ brand_id: brand.id, brand_url: brand.brand_url }, { maxProducts: perBrandDiscoveryScanCap });
      const brandExisting = existing.filter((row) => String(row.brand_id) === String(brand.id));
      const candidateSelection = selectDiscoveryCandidates(found.candidates, brandExisting, brandBudget);
      const seenKeys = candidateSelection.seenCanonicalKeys; let created = 0; let updated = 0;
      for (const candidate of candidateSelection.selected) {
        discoveryProcessed += 1;
        const observation = await monitorProduct({ entity_type: "observed_product", entity_id: `discovery:${brand.id}:${candidate.normalized_url}`, product_id: null, product_name: null, brand_name: brand.brand_name, product_url: candidate.source_url }, { timeoutMs });
        const match = matchObservedToCatalog({ brand_id: brand.id, source_url: candidate.source_url, canonical_url: observation.canonical_url || candidate.normalized_url, external_product_id: observation.external_product_id, sku: observation.sku }, catalog);
        const matchedProduct = match ? catalog.find((row) => String(row.id ?? row.product_id) === String(match.product_id)) : null;
        const provisional = observedProductRecord({ ...candidate, brand_id: brand.id, bulgaritam_product_id: match?.product_id || null, catalog_category: matchedProduct?.category }, observation, report.generated_at);
        const known = store ? await store.findByCanonicalKey(provisional.canonical_key) : existing.find((row) => row.canonical_key === provisional.canonical_key);
        const record = { ...provisional, first_seen_at: known?.first_seen_at || provisional.first_seen_at };
        seenKeys.add(record.canonical_key);
        if (write && known) await store.update(known.id, {
          source_url: record.source_url, canonical_url: record.canonical_url, external_product_id: record.external_product_id, sku: record.sku,
          title: record.title || known.title, image_url: record.image_url || known.image_url, availability: record.availability || known.availability,
          current_price: record.current_price, currency: record.currency, regular_price: record.regular_price, regular_price_currency: record.regular_price_currency,
          last_seen_at: record.last_seen_at, last_checked_at: record.last_checked_at,
          discovery_method: record.discovery_method, discovery_confidence: record.discovery_confidence,
          reader_status: record.reader_status, reader_error: record.reader_error, lifecycle_status: "active", consecutive_not_seen: 0, consecutive_dead: 0, is_active: true,
          bulgaritam_product_id: record.bulgaritam_product_id, deal_category: record.deal_category ?? known.deal_category ?? null,
        });
        else if (write) {
          const saved = await store.upsert(record); observation.entity_id = saved.id;
        }
        if (known) observation.entity_id = known.id;
        report.discovery_observations.push(observation);
        known ? updated++ : created++;
      }
      const missing = found.capacity_reached ? [] : brandExisting.filter((row) => !seenKeys.has(row.canonical_key));
      if (write) for (const row of missing) await store.update(row.id, nextObservedLifecycle(row, "not_seen"));
      report.discovery.push({ brand_id: brand.id, brand: brand.brand_name, status: found.status, discovered: found.candidates.length, processed: candidateSelection.selected.length, unseen_discovered: candidateSelection.unseen, capacity_reached: found.capacity_reached, lifecycle_missing_applied: !found.capacity_reached, created, updated, not_seen: missing.length, requests: found.request_count + candidateSelection.selected.length, run_budget_used: discoveryProcessed, run_budget: discoveryBudget });
    } catch (error) { report.errors.push({ stage: "discovery", brand_id: brand.id, error: String(error?.message || error) }); }
  }
}

if (write && report.discovery_observations.length) {
  const byEntity = new Map();
  for (const row of report.discovery_observations) if (!String(row.entity_id).startsWith("discovery:")) byEntity.set(String(row.entity_id), row);
  const eligible = [...byEntity.values()];
  if (eligible.length) report.discovery_history = await createGoogleSheetsHistory({ spreadsheetId: process.env.GOOGLE_PRICE_MONITOR_SPREADSHEET_ID, serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY }).append(eligible);
}

if (["monitor", "all"].includes(command)) {
  if (!store) throw new Error("Observed Products table is required for monitoring");
  const refreshed = await store.list(); const enabledIds = new Set(selectedBrands.map((brand) => String(brand.id)));
  const selection = selectExternalDue(refreshed.filter((row) => enabledIds.has(String(row.brand_id))), { budget, perDomainCap });
  const retryEvents = []; const results = await runDomainThrottled(selection.selected.map((row) => ({ ...row, product_url: row.canonical_url || row.source_url })), async (row) => {
    const brand = brands.find((item) => String(item.id) === String(row.brand_id));
    const { result, attempts } = await withTransientRetry(() => monitorProduct({ entity_type: "observed_product", entity_id: row.id, product_id: null, product_name: row.title, brand_name: brand?.brand_name, product_url: row.product_url }, { timeoutMs }), { retries: 2, onRetry: (event) => retryEvents.push({ entity_id: row.id, ...event }) });
    result.attempts = attempts;
    if (write) {
      const lifecycleEvent = result.status === "dead_url" ? "dead_url" : ["blocked", "browser_required"].includes(result.status) ? "blocked" : "seen";
      await store.update(row.id, { current_price: result.detected_price, currency: result.currency, regular_price: result.regular_price, regular_price_currency: result.regular_price_currency, title: result.title || row.title, image_url: result.image_url || row.image_url, availability: result.availability || row.availability, canonical_url: result.canonical_url || row.canonical_url, last_checked_at: result.checked_at, reader_status: result.extraction_status || result.status, reader_error: result.error_reason, ...nextObservedLifecycle(row, lifecycleEvent) });
    }
    return result;
  }, { concurrency, domainDelayMs });
  let history = null;
  if (write && results.length) history = await createGoogleSheetsHistory({ spreadsheetId: process.env.GOOGLE_PRICE_MONITOR_SPREADSHEET_ID, serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY }).append(results);
  report.monitoring = { ...selection, selected: selection.selected.length, checked: results.length, history, retries: retryEvents.length, results };
}
report.writes_performed = write && report.errors.length === 0;
await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, mode: report.mode, enabled_brands: report.enabled_brands, discovery: report.discovery, monitoring: report.monitoring && { selected: report.monitoring.selected, checked: report.monitoring.checked, deferred_due: report.monitoring.deferred_due, remaining_budget: report.monitoring.remaining_budget, history: report.monitoring.history }, errors: report.errors }, null, 2));
if (report.errors.length) process.exitCode = 1;
