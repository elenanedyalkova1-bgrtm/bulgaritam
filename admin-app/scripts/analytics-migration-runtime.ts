import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { planHistoricalMigration } from "../src/lib/analytics-migration";
import { createDiagnosticFetch, safeAnalyticsErrorDiagnostics, type AnalyticsEventInsert, type SupabaseAnalyticsRow } from "../src/lib/supabase-analytics";

const BASEROW_API = "https://api.baserow.io/api";
export const BATCH_SIZE = 200;
const RETRIES = 3;

export function migrationArgs(argv = process.argv.slice(2)) {
  const execute = argv.includes("--execute");
  const cutoffRaw = argv.find((arg) => arg.startsWith("--cutoff="))?.slice("--cutoff=".length) || "";
  if (!cutoffRaw) throw new Error("--cutoff=<ISO timestamp> is required; no cutoff will be guessed.");
  const cutoff = new Date(cutoffRaw);
  if (Number.isNaN(cutoff.getTime())) throw new Error("--cutoff must be a valid ISO timestamp.");
  return { execute, cutoff };
}

const requiredEnv = (name: string) => {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const safeBaserowUrl = (value: string) => {
  const url = new URL(value, `${BASEROW_API}/`);

  if (url.hostname !== "api.baserow.io") {
    throw new Error("Baserow returned an invalid pagination URL.");
  }

  if (url.protocol === "http:") {
    url.protocol = "https:";
  }

  if (url.protocol !== "https:") {
    throw new Error("Baserow returned an invalid pagination URL.");
  }

  return url.toString();
};

const retry = async <T>(label: string, operation: () => Promise<T>) => {
  let last: unknown;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try { return await operation(); }
    catch (error) {
      last = error;
      console.error(`${label} attempt ${attempt}/${RETRIES} failed`, safeAnalyticsErrorDiagnostics(error));
      if (attempt < RETRIES) await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }
  throw last;
};

export async function loadBaserowAnalyticsRows(fetchImpl: typeof fetch = globalThis.fetch) {
  const table = requiredEnv("BASEROW_ANALYTICS_EVENTS_TABLE_ID");
  const token = requiredEnv("BASEROW_API_TOKEN");
  const rows: Record<string, unknown>[] = [];
  let next: string | null = `${BASEROW_API}/database/rows/table/${encodeURIComponent(table)}/?user_field_names=true&size=200`;
  while (next) {
    const url: string = safeBaserowUrl(next);
    const response = await retry("Baserow analytics read", () => fetchImpl(url, { headers: { Authorization: `Token ${token}` } }));
    if (!response.ok) throw new Error(`Baserow analytics read failed (${response.status}).`);
    const page = await response.json();
    rows.push(...(page.results || []));
    next = page.next || null;
    console.log(`Baserow scan progress: ${rows.length} rows`);
  }
  return rows;
}

export function migrationSupabaseClient() {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: createDiagnosticFetch() },
  });
}

const chunks = <T>(items: T[], size = BATCH_SIZE) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

export async function findExistingMigrationKeys(client: SupabaseClient, inserts: AnalyticsEventInsert[]) {
  const eventIds = new Set<string>();
  const legacyIds = new Set<number>();
  for (const batch of chunks(inserts)) {
    const ids = batch.map((row) => row.event_id).filter((id): id is string => Boolean(id));
    if (ids.length) {
      const { data, error } = await client.from("analytics_events").select("event_id").in("event_id", ids);
      if (error) throw error;
      data?.forEach((row) => row.event_id && eventIds.add(row.event_id));
    }
    const sourceIds = batch.map((row) => row.legacy_baserow_row_id).filter((id): id is number => id != null);
    if (sourceIds.length) {
      const { data, error } = await client.from("analytics_events").select("legacy_baserow_row_id").in("legacy_baserow_row_id", sourceIds);
      if (error) throw error;
      data?.forEach((row) => row.legacy_baserow_row_id != null && legacyIds.add(row.legacy_baserow_row_id));
    }
  }
  return { eventIds, legacyIds };
}

export async function executeMigrationBatches(client: SupabaseClient, inserts: AnalyticsEventInsert[]) {
  let inserted = 0, conflicted = 0, failed = 0;
  for (const [index, batch] of chunks(inserts).entries()) {
    for (const group of [batch.filter((row) => row.event_id), batch.filter((row) => !row.event_id)]) {
      if (!group.length) continue;
      const onConflict = group[0].event_id ? "event_id" : "legacy_baserow_row_id";
      try {
        const { data } = await retry("Supabase analytics migration write", async () => {
          const result = await client.from("analytics_events").upsert(group, { onConflict, ignoreDuplicates: true }).select("id");
          if (result.error) throw result.error;
          return result;
        });
        inserted += data?.length || 0;
        conflicted += group.length - (data?.length || 0);
      } catch {
        failed += group.length;
      }
    }
    console.log(`Supabase migration progress: batch ${index + 1}/${chunks(inserts).length}, inserted=${inserted}, conflicted=${conflicted}`);
  }
  return { inserted, alreadyExistingOrConflicted: conflicted, failed };
}

export async function loadMigratedSupabaseRows(client: SupabaseClient, cutoff: Date) {
  const rows: SupabaseAnalyticsRow[] = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await client.from("analytics_events").select("*")
      .not("legacy_baserow_row_id", "is", null).lte("occurred_at", cutoff.toISOString())
      .order("occurred_at", { ascending: true }).order("id", { ascending: true }).range(from, from + 999);
    if (error) throw error;
    rows.push(...((data || []) as SupabaseAnalyticsRow[]));
    if ((data || []).length < 1_000) return rows;
  }
}

export async function buildMigrationPlan(cutoff: Date) {
  return planHistoricalMigration(await loadBaserowAnalyticsRows(), cutoff);
}
