import { planHistoricalMigration } from "../src/lib/analytics-migration";
import { loadBaserowAnalyticsRows, migrationSupabaseClient } from "./analytics-migration-runtime";

const rows = await loadBaserowAnalyticsRows();
const validTimes = rows.map((row) => new Date(String(row.occurred_at || "")))
  .filter((date) => !Number.isNaN(date.getTime())).sort((a, b) => a.getTime() - b.getTime());
const plan = planHistoricalMigration(rows, new Date(8_640_000_000_000_000));
const fields = [...new Set(rows.flatMap((row) => Object.keys(row)))].sort();
const { data: live, error } = await migrationSupabaseClient().from("analytics_events")
  .select("id,event_id,occurred_at,received_at")
  .is("legacy_baserow_row_id", null)
  .order("occurred_at", { ascending: true })
  .order("id", { ascending: true })
  .limit(1)
  .maybeSingle();
if (error) throw error;

console.log(JSON.stringify({
  baserow: {
    rowCount: rows.length,
    fields,
    earliestOccurredAt: validTimes[0]?.toISOString() || null,
    latestOccurredAt: validTimes.at(-1)?.toISOString() || null,
    ...plan.stats,
    issueSample: plan.issues.slice(0, 50),
  },
  supabase: {
    earliestLiveEvent: live || null,
  },
}, null, 2));
