import assert from "node:assert/strict";
import { buildHistoricalParityReport, planHistoricalMigration, runMigrationPlan } from "../src/lib/analytics-migration";
import { mapSupabaseRowToAnalyticsEvent, type SupabaseAnalyticsRow } from "../src/lib/supabase-analytics";
import { loadBaserowAnalyticsRows, migrationArgs } from "../scripts/analytics-migration-runtime";

const row = (id: number, occurred_at: string, event_id?: string) => ({
  id, event_name: "page_view", occurred_at, anonymous_session_id: "session-1",
  payload_json: JSON.stringify({ ...(event_id ? { event_id } : {}), page_path: "/" }),
});
const cutoff = new Date("2026-09-12T12:00:00.000Z");
const plan = planHistoricalMigration([
  row(1, "2026-09-12T11:59:59.000Z", "event-1"),
  row(2, "2026-09-12T12:00:00.000Z"),
  row(3, "2026-09-12T12:00:00.001Z", "after-cutoff"),
  row(4, "invalid", "bad-time"),
  { ...row(5, "2026-09-12T10:00:00.000Z"), payload_json: "{" },
  row(1, "2026-09-12T09:00:00.000Z", "duplicate-row"),
  row(6, "2026-09-12T08:00:00.000Z", "event-1"),
], cutoff);
assert.equal(plan.stats.scanned, 7);
assert.equal(plan.stats.eligible, 3);
assert.equal(plan.stats.skippedAfterCutoff, 1);
assert.equal(plan.stats.missingEventId, 1);
assert.equal(plan.stats.missingOrInvalidTimestamp, 1);
assert.equal(plan.stats.malformedPayloadJson, 1);
assert.equal(plan.stats.duplicateBaserowRowIds, 1);
assert.equal(plan.stats.duplicateEventIds, 1);
assert.equal(plan.stats.plannedUniqueInserts, 2);
assert.equal(plan.inserts[0].legacy_baserow_row_id, 1);
assert.equal(plan.inserts[0].event_id, "event-1");
assert.equal(plan.inserts[1].legacy_baserow_row_id, 2);
assert.equal(plan.inserts[1].event_id, null);

let writes = 0;
const dryRun = await runMigrationPlan(plan, { eventIds: new Set(), legacyIds: new Set() }, false, async () => { writes++; });
assert.equal(dryRun.executed, false);
assert.equal(writes, 0);

const retryPlan = await runMigrationPlan(plan, { eventIds: new Set(["event-1"]), legacyIds: new Set([2]) }, true, async (pending) => { writes++; return pending.length; });
assert.equal(retryPlan.pending.length, 0);
assert.equal(retryPlan.result, 0);
assert.equal(writes, 1);

assert.throws(() => migrationArgs([]), /cutoff/);
assert.throws(() => migrationArgs(["--execute"]), /cutoff/);
assert.equal(migrationArgs(["--cutoff=2026-09-12T12:00:00Z"]).execute, false);
assert.equal(migrationArgs(["--execute", "--cutoff=2026-09-12T12:00:00Z"]).execute, true);

const expected = plan.inserts;
const actual = expected.map((insert, index) => ({ id: index + 100, ...insert })) as SupabaseAnalyticsRow[];
assert.equal(buildHistoricalParityReport(expected, actual).pass, true);
const mismatched = actual.map((item) => ({ ...item }));
mismatched[0] = { ...mismatched[0], event_name: "view_product" };
const failedParity = buildHistoricalParityReport(expected, mismatched);
assert.equal(failedParity.pass, false);
assert.ok(failedParity.eventNameCounts.some((count) => count.difference !== 0));

const entityInsert = (legacyId: number, eventId: string, productId: string, brandId: string) => ({
  ...expected[0],
  legacy_baserow_row_id: legacyId,
  event_id: eventId,
  event_name: "view_product",
  product_id: productId,
  product_slug: `slug-${productId}`,
  product_name: `Product ${productId}`,
  brand_id: brandId,
  brand_slug: `slug-${brandId}`,
  brand_name: `Brand ${brandId}`,
  metadata: { event_id: eventId },
});
const tiedExpected = [entityInsert(20, "entity-a", "483", "brand-a"), entityInsert(21, "entity-b", "484", "brand-a")];
const tiedActual = [
  { id: 501, ...tiedExpected[1] },
  { id: 500, ...tiedExpected[0] },
] as SupabaseAnalyticsRow[];
const reorderedParity = buildHistoricalParityReport(tiedExpected, tiedActual);
assert.equal(reorderedParity.pass, true, "equal product rows in a different order must pass");
assert.equal(reorderedParity.summaryMatches.products, true);
assert.equal(reorderedParity.summaryMatches.brands, true, "nested brand products in a different order must pass");

const metricDifference = tiedActual.map((item) => ({ ...item }));
metricDifference[0] = { ...metricDifference[0], product_id: "483", product_slug: "slug-483", product_name: "Product 483" };
const metricDifferenceParity = buildHistoricalParityReport(tiedExpected, metricDifference);
assert.equal(metricDifferenceParity.pass, false);
assert.equal(metricDifferenceParity.summaryMatches.products, false);

const missingProductParity = buildHistoricalParityReport(tiedExpected, tiedActual.slice(0, 1));
assert.equal(missingProductParity.pass, false);
assert.equal(missingProductParity.summaryMatches.products, false);

const missingBrand = tiedActual.map((item) => ({ ...item }));
missingBrand[0] = { ...missingBrand[0], brand_id: "brand-b", brand_slug: "slug-brand-b", brand_name: "Brand brand-b" };
const missingBrandParity = buildHistoricalParityReport(tiedExpected, missingBrand);
assert.equal(missingBrandParity.pass, false);
assert.equal(missingBrandParity.summaryMatches.brands, false);

const normalizedA = mapSupabaseRowToAnalyticsEvent(actual[0]);
const normalizedB = mapSupabaseRowToAnalyticsEvent({ ...actual[0], id: 999_999 });
assert.deepEqual({ ...normalizedA, id: 0 }, { ...normalizedB, id: 0 });

const logText = JSON.stringify({ ...plan.stats, issues: plan.issues });
assert.equal(logText.includes("BASEROW_API_TOKEN"), false);
assert.equal(logText.includes("SUPABASE_SERVICE_ROLE_KEY"), false);

const previousBaserowTable = process.env.BASEROW_ANALYTICS_EVENTS_TABLE_ID;
const previousBaserowToken = process.env.BASEROW_API_TOKEN;
process.env.BASEROW_ANALYTICS_EVENTS_TABLE_ID = "test-table";
process.env.BASEROW_API_TOKEN = "must-not-be-logged";
const sourceRequests: Array<{ url: string; authorization: string }> = [];
const pages = [
  { results: [row(10, "2026-09-10T00:00:00Z", "p1")], next: "https://api.baserow.io/api/next-page" },
  { results: [row(11, "2026-09-11T00:00:00Z", "p2")], next: null },
];
const originalLog = console.log;
const progressLogs: string[] = [];
console.log = (...args: unknown[]) => { progressLogs.push(args.map(String).join(" ")); };
try {
  const sourceRows = await loadBaserowAnalyticsRows(async (input, init) => {
    sourceRequests.push({ url: String(input), authorization: String(new Headers(init?.headers).get("authorization")) });
    return new Response(JSON.stringify(pages.shift()), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  assert.equal(sourceRows.length, 2);
  assert.equal(sourceRequests.length, 2);
  assert.ok(sourceRequests[1].url.endsWith("/next-page"));
} finally {
  console.log = originalLog;
  if (previousBaserowTable === undefined) delete process.env.BASEROW_ANALYTICS_EVENTS_TABLE_ID;
  else process.env.BASEROW_ANALYTICS_EVENTS_TABLE_ID = previousBaserowTable;
  if (previousBaserowToken === undefined) delete process.env.BASEROW_API_TOKEN;
  else process.env.BASEROW_API_TOKEN = previousBaserowToken;
}
assert.equal(progressLogs.join("\n").includes("must-not-be-logged"), false);

console.log("analytics migration and parity tests passed");
