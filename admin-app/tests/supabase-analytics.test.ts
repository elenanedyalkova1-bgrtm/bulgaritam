import assert from "node:assert/strict";
import {
  AnalyticsRepositoryError,
  createDiagnosticFetch,
  mapAnalyticsPayloadToInsert,
  mapBaserowAnalyticsRowToInsert,
  mapSupabaseRowToAnalyticsEvent,
  safeAnalyticsErrorDiagnostics,
  SupabaseAnalyticsRepository,
  type AnalyticsEventInsert,
} from "../src/lib/supabase-analytics";

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

function mockClient(responses: Array<{ data: unknown; error: unknown }>) {
  const calls: Array<{ operation: string; args: unknown[] }> = [];
  const terminal = async () => responses.shift() || { data: null, error: null };
  const chain: any = {
    upsert: (...args: unknown[]) => { calls.push({ operation: "upsert", args }); return chain; },
    select: (...args: unknown[]) => { calls.push({ operation: "select", args }); return chain; },
    maybeSingle: terminal,
    gte: (...args: unknown[]) => { calls.push({ operation: "gte", args }); return chain; },
    lt: (...args: unknown[]) => { calls.push({ operation: "lt", args }); return chain; },
    order: (...args: unknown[]) => { calls.push({ operation: "order", args }); return terminal(); },
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

assert.throws(
  () => mapAnalyticsPayloadToInsert({ event_name: "search", occurred_at: "invalid" }),
  /valid timestamp/,
);

console.log("Supabase analytics repository tests passed");
