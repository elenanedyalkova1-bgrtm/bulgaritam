import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { dueObservedProduct, externalBrandMonitoringEligible, externalMonitoringEnabled, observedMonitoringState, scaleBenchmark, selectExternalDue } from "../src/lib/price-monitor/index.mjs";

test("external monitoring is opt-in and false by default", () => {
  assert.equal(externalMonitoringEnabled({}), false);
  assert.equal(externalMonitoringEnabled({ EXTERNAL_MONITORING_ENABLED: "true" }), true);
});

test("external brand monitoring ignores catalog visibility and respects explicit opt-in and pause", () => {
  assert.equal(externalBrandMonitoringEligible({ is_active: false, external_monitoring_enabled: true }), true);
  assert.equal(externalBrandMonitoringEligible({ is_active: true, external_monitoring_enabled: false }), false);
  assert.equal(externalBrandMonitoringEligible({ is_active: true, external_monitoring_enabled: "" }), false);
  assert.equal(externalBrandMonitoringEligible({ is_active: false, external_monitoring_enabled: true, external_monitoring_paused: true }), false);
});

test("adaptive states preserve blocked and inactive long cadence", () => {
  assert.equal(observedMonitoringState({ reader_status: "verified", current_price: 49, regular_price: 59, is_active: true }), "active_deal");
  assert.equal(observedMonitoringState({ reader_status: "blocked", is_active: true }), "blocked");
  assert.equal(observedMonitoringState({ lifecycle_status: "inactive", is_active: false }), "inactive");
  const blocked = dueObservedProduct({ reader_status: "blocked", last_checked_at: "2026-09-01T00:00:00Z", source_url: "https://a.bg/p/1" }, Date.parse("2026-09-20T00:00:00Z"));
  assert.ok(blocked.external_due_at_ms > Date.parse("2026-09-20T00:00:00Z"));
});

test("external due selection is priority-aware and domain-fair", () => {
  const rows = [
    { id: 1, source_url: "https://large.bg/p/1", reader_status: "verified", current_price: 5, regular_price: 10 },
    { id: 2, source_url: "https://large.bg/p/2", reader_status: "verified", current_price: 5, regular_price: 10 },
    { id: 3, source_url: "https://small.bg/p/3", reader_status: "changed" },
  ];
  const result = selectExternalDue(rows, { budget: 2, perDomainCap: 10 });
  assert.deepEqual(new Set(result.selected.map((row) => row.domain)), new Set(["large.bg", "small.bg"]));
  assert.equal(result.deferred_due, 1);
});

test("scale benchmark exposes current 30-minute worker constraint", () => {
  const small = scaleBenchmark({ products: 5_000, cadenceDays: 7 });
  const large = scaleBenchmark({ products: 50_000, cadenceDays: 1 });
  assert.equal(small.fits_existing_30m_worker_diverse, true);
  assert.equal(large.fits_existing_30m_worker_diverse, false);
});

test("external workflow is independently feature-flagged and cannot deploy", () => {
  const workflow = fs.readFileSync(new URL("../.github/workflows/external-price-monitor.yml", import.meta.url), "utf8");
  const worker = fs.readFileSync(new URL("../scripts/run-external-price-monitor.mjs", import.meta.url), "utf8");
  assert.match(workflow, /vars\.EXTERNAL_MONITORING_ENABLED == 'true'/);
  assert.match(workflow, /external-price-monitor-single-writer/);
  assert.match(workflow, /cron: "43 3 \* \* \*"/);
  assert.match(workflow, /cron: "13 2 \* \* 1"/);
  assert.match(workflow, /github\.event\.schedule == '13 2 \* \* 1' && 'discover'/);
  assert.doesNotMatch(workflow, /apps-script-fallback|deploy|publish-public/);
  assert.match(worker, /externalBrandMonitoringEligible\(brand\)/);
  assert.doesNotMatch(worker, /brand\.is_active\s*===\s*true|EXTERNAL_MONITOR_BRAND_IDS/);
});
