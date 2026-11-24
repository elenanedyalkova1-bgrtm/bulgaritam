import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createGoogleSheetsHistory, observedIdentityCompatible, observedPriceUpdate, matchObservedToCatalog, extractProductMetadata, observedProductRecord } from "../src/lib/price-monitor/index.mjs";
import { prepareRecovery } from "../scripts/prepare-external-history-recovery.mjs";

test("conflicting canonical pages require corroborating identity", () => {
  const existing = { source_url: "https://brand.test/p/one", sku: "one" };
  assert.equal(observedIdentityCompatible(existing, { source_url: "https://brand.test/p/two" }, { sku: "two" }), false);
  assert.equal(observedIdentityCompatible(existing, { source_url: "https://brand.test/p/alias" }, { sku: "one" }), true);
  assert.equal(matchObservedToCatalog({ brand_id: 1, source_url: "https://brand.test/p/two", canonical_url: "https://brand.test/p/one" }, [{ id: 9, brand_id: 1, product_url: "https://brand.test/p/one" }]), null);
});

test("failed, ambiguous and missing prices never overwrite the reliable price", () => {
  for (const status of ["blocked", "ambiguous", "not_detected", "error"]) assert.deepEqual(observedPriceUpdate({ status, confidence: "low", detected_price: null }), {});
  assert.deepEqual(observedPriceUpdate({ status: "verified", confidence: "high", detected_price: 20, currency: "EUR" }), { current_price: 20, currency: "EUR", regular_price: null, regular_price_currency: null });
});

test("valid history is saved alongside a rejected invalid observation and duplicate input", async () => {
  const valid = { entity_type: "observed_product", entity_id: "42", checked_at: "2026-11-23T00:00:00Z", product_url: "https://brand.test/p/one", status: "verified", confidence: "high", detected_price: 20, currency: "EUR" };
  const requests = [];
  const writer = createGoogleSheetsHistory({ spreadsheetId: "s", serviceAccountEmail: "x", privateKey: "x", tokenProvider: async () => "token", fetchImpl: async (url, init) => { requests.push({ url, init }); return new Response(JSON.stringify(url.includes("M2%3AM") ? { values: [] } : {}), { status: 200 }); } });
  const result = await writer.append([valid, valid, { ...valid, entity_id: "" }]);
  assert.equal(result.appended, 1); assert.equal(result.duplicates, 1); assert.equal(result.invalid.length, 1);
  assert.equal(JSON.parse(requests.find((r) => r.url.includes(":append")).init.body).values.length, 1);
});

test("missing or site-wide canonical URL does not create a shared undefined identity", () => {
  const metadata = extractProductMetadata("<title>One</title>", { url: "https://brand.test/product/one" });
  assert.equal(metadata.canonical_url, "https://brand.test/product/one");
  const record = observedProductRecord({ brand_id: 2, source_url: "https://brand.test/product/one" }, { canonical_url: "https://brand.test/", status: "blocked" });
  assert.equal(record.canonical_key, "2|https://brand.test/product/one");
  assert.equal(record.current_price, null);
});

test("recovery preserves timestamp for language aliases and leaves variants unresolved", () => {
  const common = { entity_type: "observed_product", entity_id: "1", checked_at: "2026-11-23T01:00:00Z", status: "verified", confidence: "high", detected_price: 9, currency: "EUR" };
  const alias = { ...common, product_url: "https://brand.test/en/product/one", canonical_url: "https://brand.test/product/one" };
  const kept = { ...common, checked_at: "2026-11-23T02:00:00Z", product_url: "https://brand.test/product/one", canonical_url: "https://brand.test/product/one" };
  const variant = { ...common, entity_id: "2", product_url: "https://brand.test/product/two?color=red", canonical_url: "https://brand.test/product/two" };
  const recovery = prepareRecovery({ discovery_observations: [alias, kept, variant, { ...variant, product_url: "https://brand.test/product/two?color=blue" }] });
  assert.equal(recovery.recoverable.length, 1); assert.equal(recovery.recoverable[0].checked_at, alias.checked_at);
  assert.equal(recovery.unresolved.length, 1);
});

test("ambiguous Sheets append failure rechecks IDs before retrying", async () => {
  const valid = { entity_type: "observed_product", entity_id: "42", checked_at: "2026-11-23T00:00:00Z", product_url: "https://brand.test/p/one", status: "verified", confidence: "high", detected_price: 20, currency: "EUR" };
  let stored = []; let appends = 0;
  const writer = createGoogleSheetsHistory({ spreadsheetId: "s", serviceAccountEmail: "x", privateKey: "x", tokenProvider: async () => "token", fetchImpl: async (url, init) => {
    if (url.includes("M2%3AM")) return new Response(JSON.stringify({ values: [stored] }), { status: 200 });
    appends++; stored = JSON.parse(init.body).values.map((row) => row[12]); return new Response(JSON.stringify({ error: "unavailable" }), { status: 503 });
  } });
  const result = await writer.append([valid]);
  assert.equal(appends, 1); assert.equal(result.duplicates, 1); assert.equal(stored.length, 1);
});

test("fatal startup error leaves a non-success summary artifact", () => {
  const output = `/tmp/external-summary-test-${process.pid}.json`;
  const env = { ...process.env, EXTERNAL_MONITORING_ENABLED: "false" };
  const child = spawnSync(process.execPath, ["scripts/run-external-price-monitor.mjs", "monitor", `--output=${output}`], { env, encoding: "utf8" });
  assert.notEqual(child.status, 0);
  const summary = JSON.parse(fs.readFileSync(output, "utf8")); fs.unlinkSync(output);
  assert.equal(summary.errors[0].stage, "infrastructure");
});
