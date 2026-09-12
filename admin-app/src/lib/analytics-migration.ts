import {
  buildAcquisitionRows,
  buildBrandRows,
  buildCollectionSummary,
  buildFunnel,
  buildPageRows,
  buildProductRows,
  buildSearchRows,
  metricSummary,
  type AnalyticsEvent,
} from "./analytics";
import {
  mapBaserowAnalyticsRowToInsert,
  mapSupabaseRowToAnalyticsEvent,
  type AnalyticsEventInsert,
  type SupabaseAnalyticsRow,
} from "./supabase-analytics";

export type MigrationIssue = { rowId: number | null; reason: string };
export type MigrationPlan = {
  inserts: AnalyticsEventInsert[];
  issues: MigrationIssue[];
  stats: {
    scanned: number;
    eligible: number;
    skippedAfterCutoff: number;
    missingEventId: number;
    missingOrInvalidTimestamp: number;
    malformedPayloadJson: number;
    duplicateEventIds: number;
    duplicateBaserowRowIds: number;
    plannedUniqueInserts: number;
  };
};

export async function runMigrationPlan<T>(
  plan: MigrationPlan,
  existing: { eventIds: Set<string>; legacyIds: Set<number> },
  execute: boolean,
  writer: (inserts: AnalyticsEventInsert[]) => Promise<T>,
) {
  const pending = plan.inserts.filter((row) =>
    !(row.event_id && existing.eventIds.has(row.event_id))
    && !(row.legacy_baserow_row_id != null && existing.legacyIds.has(row.legacy_baserow_row_id))
  );
  if (!execute) return { pending, executed: false as const, result: null };
  return { pending, executed: true as const, result: await writer(pending) };
}

const text = (value: unknown) => String(value ?? "").trim();

export function planHistoricalMigration(rows: Record<string, unknown>[], cutoff: Date): MigrationPlan {
  if (Number.isNaN(cutoff.getTime())) throw new Error("A valid migration cutoff is required.");
  const inserts: AnalyticsEventInsert[] = [];
  const issues: MigrationIssue[] = [];
  const seenEventIds = new Set<string>();
  const seenRowIds = new Set<number>();
  const stats = {
    scanned: rows.length, eligible: 0, skippedAfterCutoff: 0, missingEventId: 0,
    missingOrInvalidTimestamp: 0, malformedPayloadJson: 0, duplicateEventIds: 0,
    duplicateBaserowRowIds: 0, plannedUniqueInserts: 0,
  };

  for (const row of rows) {
    const rowId = Number(row.id);
    const auditRowId = Number.isInteger(rowId) && rowId > 0 ? rowId : null;
    if (auditRowId === null) {
      issues.push({ rowId: null, reason: "missing or invalid Baserow row id" });
      continue;
    }
    if (seenRowIds.has(auditRowId)) {
      stats.duplicateBaserowRowIds++;
      issues.push({ rowId: auditRowId, reason: "duplicate Baserow row id in source" });
      continue;
    }
    seenRowIds.add(auditRowId);

    const rawPayload = text(row.payload_json);
    if (rawPayload) {
      try { JSON.parse(rawPayload); }
      catch {
        stats.malformedPayloadJson++;
        issues.push({ rowId: auditRowId, reason: "malformed payload_json" });
        continue;
      }
    }

    const occurredAt = new Date(text(row.occurred_at));
    if (!text(row.occurred_at) || Number.isNaN(occurredAt.getTime())) {
      stats.missingOrInvalidTimestamp++;
      issues.push({ rowId: auditRowId, reason: "missing or invalid occurred_at" });
      continue;
    }
    if (occurredAt > cutoff) {
      stats.skippedAfterCutoff++;
      continue;
    }
    stats.eligible++;

    let payload: Record<string, unknown> = {};
    if (rawPayload) payload = JSON.parse(rawPayload);
    const eventId = text(row.event_id ?? payload.event_id);
    if (!eventId) stats.missingEventId++;
    if (eventId && seenEventIds.has(eventId)) {
      stats.duplicateEventIds++;
      issues.push({ rowId: auditRowId, reason: `duplicate event_id: ${eventId}` });
      continue;
    }
    if (eventId) seenEventIds.add(eventId);

    try { inserts.push(mapBaserowAnalyticsRowToInsert(row)); }
    catch (error) {
      issues.push({ rowId: auditRowId, reason: error instanceof Error ? error.message : "mapping failed" });
    }
  }
  stats.plannedUniqueInserts = inserts.length;
  return { inserts, issues, stats };
}

const countsBy = (events: AnalyticsEvent[], key: (event: AnalyticsEvent) => string) =>
  Object.fromEntries([...events.reduce((map, event) => {
    const value = key(event) || "(missing)";
    map.set(value, (map.get(value) || 0) + 1);
    return map;
  }, new Map<string, number>()).entries()].sort(([a], [b]) => a.localeCompare(b)));

const comparable = (value: unknown) => JSON.parse(JSON.stringify(value));

const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalValue(item)])
  );
  return value;
};

const canonicalRows = (rows: any[], identity: (row: any) => string, nested?: (row: any) => any) =>
  rows.map((row) => canonicalValue(nested ? nested(row) : row)).sort((a, b) => {
    const left = identity(a);
    const right = identity(b);
    return left.localeCompare(right) || JSON.stringify(a).localeCompare(JSON.stringify(b));
  });

const canonicalProducts = (rows: any[]) => canonicalRows(rows, (row) => String(row.id || row.slug || ""));
const canonicalBrands = (rows: any[]) => canonicalRows(
  rows,
  (row) => String(row.id || row.slug || row.name || ""),
  (row) => ({ ...row, products: canonicalProducts(row.products || []) }),
);

export function buildHistoricalParityReport(expected: AnalyticsEventInsert[], actualRows: SupabaseAnalyticsRow[]) {
  const expectedEvents = expected.map((row, index) => mapSupabaseRowToAnalyticsEvent({ id: index + 1, ...row }));
  const actualEvents = actualRows.map(mapSupabaseRowToAnalyticsEvent);
  const eventNames = [...new Set([...expectedEvents, ...actualEvents].map((event) => event.event))].sort();
  const eventNameCounts = eventNames.map((eventName) => {
    const baserow = expectedEvents.filter((event) => event.event === eventName).length;
    const supabase = actualEvents.filter((event) => event.event === eventName).length;
    return { eventName, baserow, supabase, difference: supabase - baserow };
  });
  const day = (event: AnalyticsEvent) => event.at.toISOString().slice(0, 10);
  const expectedDays = countsBy(expectedEvents, day);
  const actualDays = countsBy(actualEvents, day);
  const expectedMetrics = metricSummary(expectedEvents, []);
  const actualMetrics = metricSummary(actualEvents, []);
  const metricCounts = expectedMetrics.map((metric) => {
    const actual = actualMetrics.find((item) => item.key === metric.key)?.value || 0;
    return { key: metric.key, baserow: metric.value, supabase: actual, difference: actual - metric.value };
  });
  const summaries = {
    collections: [buildCollectionSummary(expectedEvents), buildCollectionSummary(actualEvents)],
    funnel: [buildFunnel(expectedEvents), buildFunnel(actualEvents)],
    products: [buildProductRows(expectedEvents), buildProductRows(actualEvents)],
    brands: [buildBrandRows(expectedEvents), buildBrandRows(actualEvents)],
    searches: [buildSearchRows(expectedEvents), buildSearchRows(actualEvents)],
    acquisition: [buildAcquisitionRows(expectedEvents), buildAcquisitionRows(actualEvents)],
    pages: [buildPageRows(expectedEvents), buildPageRows(actualEvents)],
  };
  const raw = {
    eligibleBaserowRows: expected.length,
    migratedSupabaseRows: actualRows.length,
    distinctLegacyBaserowRowIds: new Set(actualRows.map((row) => row.legacy_baserow_row_id).filter((id) => id != null)).size,
    baserowDistinctEventIds: new Set(expected.map((row) => row.event_id).filter(Boolean)).size,
    supabaseDistinctEventIds: new Set(actualRows.map((row) => row.event_id).filter(Boolean)).size,
  };
  const canonicalSummaries = {
    collections: summaries.collections.map((rows) => canonicalRows(rows, (row) => String(row.event))),
    funnel: summaries.funnel.map(canonicalValue),
    products: summaries.products.map(canonicalProducts),
    brands: summaries.brands.map(canonicalBrands),
    searches: summaries.searches.map((rows) => canonicalRows(rows, (row) => String(row.query))),
    acquisition: summaries.acquisition.map((rows) => canonicalRows(rows, (row) => [row.channel,row.source,row.medium,row.campaign,row.referrer].join("|"))),
    pages: summaries.pages.map((rows) => canonicalRows(rows, (row) => String(row.path))),
  };
  const summaryMatches = Object.fromEntries(Object.entries(canonicalSummaries).map(([name, [a, b]]) =>
    [name, JSON.stringify(comparable(a)) === JSON.stringify(comparable(b))]
  ));
  const pass = raw.eligibleBaserowRows === raw.migratedSupabaseRows
    && raw.distinctLegacyBaserowRowIds === raw.migratedSupabaseRows
    && eventNameCounts.every((row) => row.difference === 0)
    && JSON.stringify(expectedDays) === JSON.stringify(actualDays)
    && metricCounts.every((row) => row.difference === 0)
    && Object.values(summaryMatches).every(Boolean);
  return { pass, raw, eventNameCounts, dailyCounts: { baserow: expectedDays, supabase: actualDays }, metricCounts, summaryMatches, summaries };
}
