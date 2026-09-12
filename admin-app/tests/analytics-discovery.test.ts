import assert from "node:assert/strict";
import { handleDiscoverySnapshotPost, sanitizeDiscoverySnapshot, type DiscoveryRepository } from "../src/lib/analytics-discovery";
import { AnalyticsRepositoryError, SupabaseAnalyticsRepository } from "../src/lib/supabase-analytics";

const origin = "https://bulgaritam.bg";
const state = {
  discovery_state_id: "state-1", occurred_at: "2026-09-12T12:00:00.000Z",
  anonymous_session_id: "session-1", anonymous_journey_id: "journey-1",
  surface_type: "search_results", page_path: "/", search_id: "search-1",
  query: "подарък", category: "gifts", result_count: 2, tracking_version: 2,
  active_filters: { price: "25-50", occasion: ["birthday"] },
  metadata: { used_fallback: false },
};
const results = [
  { entity_type: "product", product_id: "product-1", brand_id: "brand-1", position: 1 },
  { entity_type: "product", product_id: "product-2", brand_id: "brand-2", position: 2 },
];

const sanitized = sanitizeDiscoverySnapshot({ state, results });
assert.ok(sanitized);
assert.equal(sanitized.state.result_count, 2);
assert.deepEqual(sanitized.results.map(({ product_id, position }) => [product_id, position]), [["product-1", 1], ["product-2", 2]]);

const brandSnapshot = sanitizeDiscoverySnapshot({
  state: { ...state, discovery_state_id: "brand-state", surface_type: "brand_directory_search", result_count: 2 },
  results: [
    { entity_type: "brand", brand_id: "brand-1", position: 1 },
    { entity_type: "brand", brand_id: "brand-2", position: 2 },
  ],
});
assert.ok(brandSnapshot);
assert.deepEqual(brandSnapshot.results.map(({ entity_type, brand_id }) => [entity_type, brand_id]), [["brand", "brand-1"], ["brand", "brand-2"]]);

assert.equal(sanitizeDiscoverySnapshot({ state, results: results.slice(0, 1) }), null, "count mismatch must fail");
assert.equal(sanitizeDiscoverySnapshot({ state, results: [{ ...results[0], position: 2 }, results[1]] }), null, "positions must be ordered and 1-based");
assert.equal(sanitizeDiscoverySnapshot({ state, results: [results[0], { ...results[0], position: 2 }] }), null, "duplicate entities must fail");
assert.ok(sanitizeDiscoverySnapshot({
  state,
  results: [results[0], { ...results[0], brand_id: "brand-2", position: 2 }],
}), "the same product_id from different brands must be allowed");
assert.equal(sanitizeDiscoverySnapshot({
  state: { ...state, surface_type: "brand_directory" },
  results: [
    { entity_type: "brand", brand_id: "brand-1", position: 1 },
    { entity_type: "brand", brand_id: "brand-1", position: 2 },
  ],
}), null, "duplicate brand entities must fail");
assert.equal(sanitizeDiscoverySnapshot({ state, results: [{ entity_type: "brand", brand_id: "", position: 1 }, results[1]] }), null);

const largeResults = Array.from({ length: 1_200 }, (_, index) => ({
  entity_type: "product", product_id: `product-${index}-${"x".repeat(20)}`,
  brand_id: `brand-${index}`, position: index + 1,
}));
const largeBody = JSON.stringify({ state: { ...state, result_count: largeResults.length }, results: largeResults });
assert.ok(largeBody.length > 20_000);
assert.equal(sanitizeDiscoverySnapshot(JSON.parse(largeBody))?.results.length, 1_200, "normalized membership must not use the legacy 20k limit");

const inserted: unknown[] = [];
const repository: DiscoveryRepository = { async insertSnapshot(nextState, nextResults) { inserted.push(nextState, nextResults); } };
const request = (body: string, requestOrigin = origin) => new Request("https://admin.bulgaritam.bg/api/discovery-states/", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: requestOrigin }, body,
});
assert.equal((await handleDiscoverySnapshotPost(request(JSON.stringify({ state, results })), () => repository)).status, 202);
assert.equal(inserted.length, 2);
assert.equal((await handleDiscoverySnapshotPost(request(JSON.stringify({ state, results }), "https://attacker.example"), () => repository)).status, 403);

const rpcCalls: unknown[][] = [];
const rpcClient = { rpc: async (...args: unknown[]) => { rpcCalls.push(args); return { error: null }; } } as any;
await new SupabaseAnalyticsRepository(rpcClient).insertSnapshot(sanitized.state, sanitized.results);
assert.deepEqual(rpcCalls[0], ["insert_analytics_discovery_state", { p_state: sanitized.state, p_results: sanitized.results }]);

const originalError = console.error;
console.error = () => {};
try {
  const failedRepository: DiscoveryRepository = { async insertSnapshot() { throw new AnalyticsRepositoryError("discovery snapshot insert", new Error("down")); } };
  const failed = await handleDiscoverySnapshotPost(request(JSON.stringify({ state, results })), () => failedRepository);
  assert.equal(failed.status, 502);
  assert.equal(await failed.text(), "Storage unavailable");
} finally { console.error = originalError; }

console.log("analytics discovery tests passed");
