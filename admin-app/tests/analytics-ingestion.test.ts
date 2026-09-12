import assert from "node:assert/strict";
import { handleAnalyticsEventPost, sanitizeAnalyticsEvent, type AnalyticsInsertRepository } from "../src/lib/analytics-ingestion";
import type { AnalyticsEventInsert } from "../src/lib/supabase-analytics";

const endpoint = "https://admin.bulgaritam.bg/api/events/";
const origin = "https://bulgaritam.bg";
const request = (body: unknown, requestOrigin = origin) => new Request(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: requestOrigin },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

const inserted: AnalyticsEventInsert[] = [];
const repository: AnalyticsInsertRepository = {
  async insert(event) { inserted.push(event); return { duplicateIgnored: false }; },
};

const fullPayload = {
  event_name: "search",
  event_id: "event-123",
  occurred_at: "2026-09-12T12:00:00.000Z",
  occurred_at_client: "2026-09-12T12:00:00.000Z",
  sequence_number: "17",
  anonymous_session_id: "session-123",
  anonymous_journey_id: "journey-123",
  product_id: "product-1",
  product_slug: "silver-earrings",
  product_name: "Сребърни обеци",
  brand_id: "brand-1",
  brand_slug: "brand-slug",
  brand_name: "Марка",
  search_id: "search-123",
  discovery_state_id: "state-123",
  query: "обеци",
  result_count: 2,
  filter_name: "product_constraints",
  materials: '["сребро"]',
  acquisition_channel: "Organic Search",
  referrer_domain: "google.com",
  returned_products_json: '[["product-1","brand-1",1]]',
  returned_brands_json: '[["brand-1",1]]',
};

const accepted = await handleAnalyticsEventPost(request(fullPayload), () => repository);
assert.equal(accepted.status, 202);
assert.equal(accepted.headers.get("access-control-allow-origin"), origin);
assert.equal(inserted.length, 1);
assert.equal(inserted[0].event_id, "event-123");
assert.equal(inserted[0].occurred_at, fullPayload.occurred_at);
assert.equal(inserted[0].anonymous_session_id, "session-123");
assert.equal(inserted[0].anonymous_journey_id, "journey-123");
assert.equal(inserted[0].sequence_number, 17);
assert.equal(inserted[0].product_slug, "silver-earrings");
assert.equal(inserted[0].brand_slug, "brand-slug");
assert.equal(inserted[0].search_id, "search-123");
assert.equal(inserted[0].discovery_state_id, "state-123");
assert.equal(inserted[0].metadata.returned_products_json, fullPayload.returned_products_json);
assert.equal(inserted[0].metadata.returned_brands_json, fullPayload.returned_brands_json);
assert.equal(inserted[0].metadata.referrer_domain, "google.com");

const sanitized = sanitizeAnalyticsEvent({
  ...fullPayload,
  email: "person@example.com",
  phone: "+359888123456",
  name: "Person",
  collection_name: "Private collection",
  destination_url: "https://shop.test/private/path?token=secret",
  page_location: "https://bulgaritam.bg/?private=1",
  nested: { secret: true },
  long_value: "x".repeat(300),
});
assert.ok(sanitized);
for (const forbidden of ["email", "phone", "name", "collection_name", "destination_url", "page_location", "nested"]) {
  assert.equal(Object.hasOwn(sanitized.metadata, forbidden), false);
}
assert.equal(String(sanitized.metadata.long_value).length, 240);
assert.equal(String(sanitized.metadata.returned_products_json).length, fullPayload.returned_products_json.length);

assert.equal((await handleAnalyticsEventPost(request({ event_name: "not_allowed" }), () => repository)).status, 400);
assert.equal((await handleAnalyticsEventPost(request("not-json"), () => repository)).status, 400);
assert.equal((await handleAnalyticsEventPost(request(fullPayload, "https://attacker.example"), () => repository)).status, 403);

const duplicateRepository: AnalyticsInsertRepository = {
  async insert() { return { duplicateIgnored: true }; },
};
assert.equal((await handleAnalyticsEventPost(request(fullPayload), () => duplicateRepository)).status, 202);

const originalError = console.error;
console.error = () => {};
try {
  const failingRepository: AnalyticsInsertRepository = {
    async insert() { throw new Error("Supabase unavailable"); },
  };
  const failed = await handleAnalyticsEventPost(request(fullPayload), () => failingRepository);
  assert.equal(failed.status, 502);
  assert.equal(await failed.text(), "Storage unavailable");

  const unconfigured = await handleAnalyticsEventPost(request(fullPayload), () => { throw new Error("Missing environment"); });
  assert.equal(unconfigured.status, 503);
  assert.equal(await unconfigured.text(), "Analytics storage is not configured");
} finally {
  console.error = originalError;
}

console.log("analytics ingestion tests passed");
