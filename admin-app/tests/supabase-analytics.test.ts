import assert from "node:assert/strict";
import {
  AnalyticsRepositoryError,
  createDiagnosticFetch,
  loadAnalyticsPeriodWindows,
  mapAnalyticsPayloadToInsert,
  mapBaserowAnalyticsRowToInsert,
  mapSupabaseRowToAnalyticsEvent,
  safeAnalyticsErrorDiagnostics,
  SupabaseAnalyticsRepository,
  type AnalyticsEventInsert,
} from "../src/lib/supabase-analytics";
import { metricSummary } from "../src/lib/analytics";

const payload = {
  event_name: "search",
  event_id: "evt-1",
  occurred_at: "2026-09-12T10:00:00.000Z",
  anonymous_session_id: "session-1",
  anonymous_journey_id: "journey-1",
  sequence_number: "3",
  query: "обеци",
  result_count: "2",
  search_id: "search-1",
  returned_products_json: '[["p1","b1",1]]',
  materials: '["сребро"]',
};

const insert = mapAnalyticsPayloadToInsert(payload, { receivedAt: "2026-09-12T10:00:01.000Z" });
assert.equal(insert.event_name, "search");
assert.equal(insert.search_term, "обеци");
assert.equal(insert.search_results_count, 2);
assert.equal(insert.sequence_number, 3);
assert.equal(insert.metadata.returned_products_json, payload.returned_products_json);

const historical = mapBaserowAnalyticsRowToInsert({
  id: 42,
  event_name: "view_product",
  occurred_at: "2026-09-11T09:00:00.000Z",
  product_id: "p1",
  payload_json: JSON.stringify({
    event_id: "legacy-event",
    product_slug: "silver-earrings",
    page_path: "/p/silver-earrings",
    received_at_server: "2026-09-11T09:00:01.000Z",
  }),
});
assert.equal(historical.legacy_baserow_row_id, 42);
assert.equal(historical.event_id, "legacy-event");
assert.equal(historical.product_id, "p1");
assert.equal(historical.product_slug, "silver-earrings");

const normalized = mapSupabaseRowToAnalyticsEvent({ id: 7, ...insert });
assert.equal(normalized.eventId, "evt-1");
assert.equal(normalized.searchTerm, "обеци");
assert.equal(normalized.searchId, "search-1");
assert.equal(normalized.payload.materials, '["сребро"]');

const precedence = mapSupabaseRowToAnalyticsEvent({
  id: 8,
  ...insert,
  product_id: "promoted-product",
  sequence_number: 12,
  search_revision: 4,
  metadata: { ...insert.metadata, product_id: "metadata-product", sequence_number: 99, search_revision: 88 },
});
assert.equal(precedence.productId, "promoted-product");
assert.equal(precedence.sequenceNumber, 12);
assert.equal(precedence.searchRevision, 4);

const fallback = mapSupabaseRowToAnalyticsEvent({
  id: 9,
  ...insert,
  product_id: null,
  product_slug: null,
  gift_recipient: null,
  sequence_number: null,
  metadata: { ...insert.metadata, product_id: "metadata-product", product_slug: "metadata-slug", gift_recipient: "майка", sequence_number: 6 },
});
assert.equal(fallback.productId, "metadata-product");
assert.equal(fallback.productSlug, "metadata-slug");
assert.equal(fallback.giftRecipient, "майка");
assert.equal(fallback.sequenceNumber, 6);
assert.equal(fallback.brandSlug, "");

function mockClient(responses: Array<{ data: unknown; error: unknown }>) {
  const calls: Array<{ operation: string; args: unknown[] }> = [];
  const terminal = async () => responses.shift() || { data: null, error: null };
  const chain: any = {
    upsert: (...args: unknown[]) => { calls.push({ operation: "upsert", args }); return chain; },
    select: (...args: unknown[]) => { calls.push({ operation: "select", args }); return chain; },
    maybeSingle: terminal,
    gte: (...args: unknown[]) => { calls.push({ operation: "gte", args }); return chain; },
    lt: (...args: unknown[]) => { calls.push({ operation: "lt", args }); return chain; },
    order: (...args: unknown[]) => { calls.push({ operation: "order", args }); return chain; },
    range: (...args: unknown[]) => { calls.push({ operation: "range", args }); return chain; },
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => terminal().then(resolve, reject),
  };
  return { client: { from: () => chain } as any, calls };
}

const duplicateMock = mockClient([{ data: null, error: null }]);
const duplicateResult = await new SupabaseAnalyticsRepository(duplicateMock.client).insert(insert);
assert.equal(duplicateResult.duplicateIgnored, true);
const upsert = duplicateMock.calls.find((call) => call.operation === "upsert");
assert.deepEqual((upsert?.args[1] as object), { onConflict: "event_id", ignoreDuplicates: true });

const insertMock = mockClient([{ data: { id: 9 }, error: null }]);
assert.equal((await new SupabaseAnalyticsRepository(insertMock.client).insert(insert)).duplicateIgnored, false);

const networkCause = Object.assign(new Error("getaddrinfo ENOTFOUND example.supabase.co"), {
  name: "Error",
  code: "ENOTFOUND",
  errno: -3008,
  syscall: "getaddrinfo",
  hostname: "example.supabase.co",
});
const networkError = new TypeError("fetch failed", { cause: networkCause });
const originalConsoleError = console.error;
const networkLogs: unknown[][] = [];
console.error = (...args: unknown[]) => { networkLogs.push(args); };
try {
  const diagnosticFetch = createDiagnosticFetch(async () => { throw networkError; });
  await assert.rejects(() => diagnosticFetch("https://example.supabase.co/rest/v1/analytics_events", {
    headers: { apikey: "must-not-be-logged", Authorization: "Bearer must-not-be-logged" },
  }), networkError);
} finally {
  console.error = originalConsoleError;
}
assert.deepEqual(networkLogs, [[
  "Supabase analytics network request failed",
  {
    name: "TypeError",
    message: "fetch failed",
    cause: {
      name: "Error",
      code: "ENOTFOUND",
      message: "getaddrinfo ENOTFOUND example.supabase.co",
      errno: -3008,
      syscall: "getaddrinfo",
      hostname: "example.supabase.co",
    },
  },
]]);
assert.equal(JSON.stringify(networkLogs).includes("must-not-be-logged"), false);

const failureMock = mockClient([{ data: null, error: networkError }]);
await assert.rejects(
  () => new SupabaseAnalyticsRepository(failureMock.client).insert(insert),
  (error: unknown) => {
    assert.ok(error instanceof AnalyticsRepositoryError);
    assert.equal(error.cause, networkCause);
    assert.deepEqual(safeAnalyticsErrorDiagnostics(error), {
      name: "AnalyticsRepositoryError",
      message: "Supabase analytics insert failed: fetch failed",
      cause: {
        name: "Error",
        code: "ENOTFOUND",
        message: "getaddrinfo ENOTFOUND example.supabase.co",
        errno: -3008,
        syscall: "getaddrinfo",
        hostname: "example.supabase.co",
      },
    });
    return true;
  },
);

const readRow: AnalyticsEventInsert & { id: number } = { id: 9, ...insert };
const readMock = mockClient([{ data: [readRow], error: null }]);
const events = await new SupabaseAnalyticsRepository(readMock.client).listRange(
  new Date("2026-09-12T00:00:00.000Z"),
  new Date("2026-09-13T00:00:00.000Z"),
);
assert.equal(events.length, 1);
assert.equal(events[0].event, "search");
assert.deepEqual(readMock.calls.filter((call) => call.operation === "order").map((call) => call.args), [
  ["occurred_at", { ascending: true }],
  ["id", { ascending: true }],
]);
assert.deepEqual(readMock.calls.filter((call) => call.operation === "range").map((call) => call.args), [[0, 999]]);

const pagedMock = mockClient([
  { data: Array.from({ length: 1_000 }, (_, index) => ({ ...readRow, id: index + 1, event_id: `page-1-${index}` })), error: null },
  { data: [{ ...readRow, id: 1_001, event_id: "page-2" }], error: null },
]);
const pagedEvents = await new SupabaseAnalyticsRepository(pagedMock.client).listRange(
  new Date("2026-09-12T00:00:00.000Z"),
  new Date("2026-09-13T00:00:00.000Z"),
);
assert.equal(pagedEvents.length, 1_001);
assert.deepEqual(pagedMock.calls.filter((call) => call.operation === "range").map((call) => call.args), [[0, 999], [1_000, 1_999]]);

const periodRows = [
  mapSupabaseRowToAnalyticsEvent({ id: 101, ...insert, occurred_at: "2026-09-10T12:00:00.000Z", event_name: "page_view", event_id: "previous" }),
  mapSupabaseRowToAnalyticsEvent({ id: 202, ...insert, occurred_at: "2026-09-11T12:00:00.000Z", event_name: "page_view", event_id: "selected-1" }),
  mapSupabaseRowToAnalyticsEvent({ id: 303, ...insert, occurred_at: "2026-09-11T13:00:00.000Z", event_name: "page_view", event_id: "selected-2" }),
];
const requestedRanges: Array<[Date, Date]> = [];
const windows = await loadAnalyticsPeriodWindows({
  async listRange(start, end) { requestedRanges.push([start, end]); return periodRows; },
}, {
  previousStart: new Date("2026-09-10T00:00:00.000Z"),
  previousEnd: new Date("2026-09-11T00:00:00.000Z"),
  start: new Date("2026-09-11T00:00:00.000Z"),
  end: new Date("2026-09-12T00:00:00.000Z"),
});
assert.deepEqual(requestedRanges, [[new Date("2026-09-10T00:00:00.000Z"), new Date("2026-09-12T00:00:00.000Z")]]);
assert.deepEqual(windows.previous.map((event) => event.eventId), ["previous"]);
assert.deepEqual(windows.selected.map((event) => event.eventId), ["selected-1", "selected-2"]);
const periodMetrics = metricSummary(windows.selected, windows.previous).find((row) => row.key === "page_view");
assert.equal(periodMetrics?.value, 2);
assert.equal(periodMetrics?.previous, 1);
assert.equal(periodMetrics?.change, 100);

const differentIdentityId = mapSupabaseRowToAnalyticsEvent({ id: 999999, ...insert });
assert.deepEqual(
  metricSummary([normalized], []).map(({ key, value }) => ({ key, value })),
  metricSummary([differentIdentityId], []).map(({ key, value }) => ({ key, value })),
);

const readFailure = mockClient([{ data: null, error: { message: "read unavailable", secret: "must-not-leak" } }]);
await assert.rejects(
  () => new SupabaseAnalyticsRepository(readFailure.client).listRange(new Date("2026-09-11"), new Date("2026-09-12")),
  (error: unknown) => error instanceof AnalyticsRepositoryError && error.message === "Supabase analytics read failed: read unavailable" && !error.message.includes("must-not-leak"),
);

assert.throws(
  () => mapAnalyticsPayloadToInsert({ event_name: "search", occurred_at: "invalid" }),
  /valid timestamp/,
);

console.log("Supabase analytics repository tests passed");
