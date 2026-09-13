import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseEvent, type AnalyticsEvent } from "./analytics";
import type { DiscoveryResultMember, DiscoveryStateInsert } from "./analytics-discovery";
import { loadAllPages, type DiscoveryResultRow, type DiscoveryStateRow } from "./analytics-derived";

const TABLE = "analytics_events";
const READ_PAGE_SIZE = 1_000;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type AnalyticsEventInsert = {
  event_id: string | null;
  occurred_at: string;
  received_at: string;
  event_name: string;
  anonymous_session_id: string | null;
  anonymous_journey_id: string | null;
  sequence_number: number | null;
  page_path: string | null;
  page_title: string | null;
  page_type: string | null;
  language: string | null;
  device_type: string | null;
  product_id: string | null;
  product_slug: string | null;
  product_name: string | null;
  brand_id: string | null;
  brand_slug: string | null;
  brand_name: string | null;
  category: string | null;
  subcategory: string | null;
  product_type: string | null;
  search_id: string | null;
  search_term: string | null;
  search_results_count: number | null;
  discovery_state_id: string | null;
  search_revision: number | null;
  collection_id: string | null;
  source_context: string | null;
  list_context: string | null;
  list_name: string | null;
  position: number | null;
  destination_domain: string | null;
  landing_page: string | null;
  referrer_domain: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  acquisition_channel: string | null;
  gift_recipient: string | null;
  gift_occasion: string | null;
  tracking_version: number | null;
  source_surface: string | null;
  source_discovery_state_id: string | null;
  source_position: number | null;
  source_search_id: string | null;
  last_discovery_state_id: string | null;
  metadata: Record<string, Json>;
  legacy_baserow_row_id: number | null;
};

export type SupabaseAnalyticsRow = AnalyticsEventInsert & { id: number };

const text = (value: unknown) => String(value ?? "").trim();
const optionalText = (value: unknown) => text(value) || null;
const optionalInteger = (value: unknown) => {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const asMetadata = (value: unknown): Record<string, Json> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, Json>;
};

export function mapAnalyticsPayloadToInsert(
  input: Record<string, unknown>,
  options: { receivedAt?: string; legacyBaserowRowId?: number | null } = {},
): AnalyticsEventInsert {
  const eventName = text(input.event_name);
  const occurredAt = text(input.occurred_at || input.occurred_at_client);
  if (!eventName) throw new Error("Analytics event_name is required.");
  if (!occurredAt || Number.isNaN(new Date(occurredAt).getTime())) throw new Error("Analytics occurred_at must be a valid timestamp.");

  const metadata = asMetadata(input);
  const receivedAt = text(options.receivedAt || input.received_at || input.received_at_server) || new Date().toISOString();
  if (Number.isNaN(new Date(receivedAt).getTime())) throw new Error("Analytics received_at must be a valid timestamp.");

  return {
    event_id: optionalText(input.event_id),
    occurred_at: occurredAt,
    received_at: receivedAt,
    event_name: eventName,
    anonymous_session_id: optionalText(input.anonymous_session_id),
    anonymous_journey_id: optionalText(input.anonymous_journey_id),
    sequence_number: optionalInteger(input.sequence_number),
    page_path: optionalText(input.page_path),
    page_title: optionalText(input.page_title),
    page_type: optionalText(input.page_type),
    language: optionalText(input.language),
    device_type: optionalText(input.device_type),
    product_id: optionalText(input.product_id),
    product_slug: optionalText(input.product_slug),
    product_name: optionalText(input.product_name),
    brand_id: optionalText(input.brand_id),
    brand_slug: optionalText(input.brand_slug),
    brand_name: optionalText(input.brand_name),
    category: optionalText(input.category),
    subcategory: optionalText(input.subcategory),
    product_type: optionalText(input.product_type),
    search_id: optionalText(input.search_id),
    search_term: optionalText(input.search_term || input.query),
    search_results_count: optionalInteger(input.search_results_count ?? input.result_count),
    discovery_state_id: optionalText(input.discovery_state_id),
    search_revision: optionalInteger(input.search_revision),
    collection_id: optionalText(input.collection_id),
    source_context: optionalText(input.source_context),
    list_context: optionalText(input.list_context),
    list_name: optionalText(input.list_name),
    position: optionalInteger(input.position),
    destination_domain: optionalText(input.destination_domain),
    landing_page: optionalText(input.landing_page),
    referrer_domain: optionalText(input.referrer_domain),
    utm_source: optionalText(input.utm_source),
    utm_medium: optionalText(input.utm_medium),
    utm_campaign: optionalText(input.utm_campaign),
    acquisition_channel: optionalText(input.acquisition_channel),
    gift_recipient: optionalText(input.gift_recipient),
    gift_occasion: optionalText(input.gift_occasion),
    tracking_version: optionalInteger(input.tracking_version),
    source_surface: optionalText(input.source_surface),
    source_discovery_state_id: optionalText(input.source_discovery_state_id),
    source_position: optionalInteger(input.source_position),
    source_search_id: optionalText(input.source_search_id),
    last_discovery_state_id: optionalText(input.last_discovery_state_id),
    metadata,
    legacy_baserow_row_id: options.legacyBaserowRowId ?? null,
  };
}

export function mapBaserowAnalyticsRowToInsert(row: Record<string, unknown>): AnalyticsEventInsert {
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(text(row.payload_json) || "{}"); } catch {}
  const merged = { ...payload, ...Object.fromEntries(Object.entries(row).filter(([, value]) => value !== "" && value != null)) };
  return {
    ...mapAnalyticsPayloadToInsert(merged, {
      receivedAt: optionalText(payload.received_at_server) || undefined,
      legacyBaserowRowId: optionalInteger(row.id),
    }),
    metadata: asMetadata(payload),
  };
}

export function mapSupabaseRowToAnalyticsEvent(row: SupabaseAnalyticsRow): AnalyticsEvent {
  const metadata = asMetadata(row.metadata);
  const parsed = parseEvent({
    ...row,
    payload_json: JSON.stringify({
      ...metadata,
      ...(row.sequence_number == null ? {} : { sequence_number: row.sequence_number }),
      ...(row.search_revision == null ? {} : { search_revision: row.search_revision }),
    }),
  });
  if (!parsed) throw new Error(`Invalid analytics row ${row.id}.`);
  return parsed;
}

export class AnalyticsRepositoryError extends Error {
  constructor(operation: string, cause: unknown) {
    const detail = cause && typeof cause === "object" && "message" in cause ? String(cause.message) : "unknown error";
    const underlying = cause && typeof cause === "object" && "cause" in cause && cause.cause ? cause.cause : cause;
    super(`Supabase analytics ${operation} failed: ${detail}`, { cause: underlying });
    this.name = "AnalyticsRepositoryError";
  }
}

const diagnosticText = (value: unknown) => typeof value === "string" ? value : undefined;
const diagnosticNumber = (value: unknown) => typeof value === "number" ? value : undefined;

export function safeAnalyticsErrorDiagnostics(error: unknown) {
  const outer = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const cause = outer.cause && typeof outer.cause === "object" ? outer.cause as Record<string, unknown> : {};
  return {
    name: diagnosticText(outer.name),
    message: diagnosticText(outer.message),
    cause: {
      name: diagnosticText(cause.name),
      code: diagnosticText(cause.code),
      message: diagnosticText(cause.message),
      errno: diagnosticNumber(cause.errno),
      syscall: diagnosticText(cause.syscall),
      hostname: diagnosticText(cause.hostname),
    },
  };
}

export function createDiagnosticFetch(baseFetch: typeof fetch = globalThis.fetch): typeof fetch {
  return async (input, init) => {
    try {
      return await baseFetch(input, init);
    } catch (error) {
      // Never log input/init: they can contain the service-role URL and headers.
      console.error("Supabase analytics network request failed", safeAnalyticsErrorDiagnostics(error));
      throw error;
    }
  };
}

export class SupabaseAnalyticsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async insert(event: AnalyticsEventInsert): Promise<{ duplicateIgnored: boolean }> {
    const { data, error } = await this.client
      .from(TABLE)
      .upsert(event, { onConflict: "event_id", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (error) throw new AnalyticsRepositoryError("insert", error);
    return { duplicateIgnored: !data };
  }

  async insertSnapshot(state: DiscoveryStateInsert, results: DiscoveryResultMember[]): Promise<void> {
    const { error } = await this.client.rpc("insert_analytics_discovery_state", {
      p_state: state,
      p_results: results,
    });
    if (error) throw new AnalyticsRepositoryError("discovery snapshot insert", error);
  }

  async listRange(start: Date, end: Date): Promise<AnalyticsEvent[]> {
    if (start >= end) throw new Error("Analytics range start must be before end.");
    const events: AnalyticsEvent[] = [];
    for (let from = 0; ; from += READ_PAGE_SIZE) {
      const { data, error } = await this.client
        .from(TABLE)
        .select("*")
        .gte("occurred_at", start.toISOString())
        .lt("occurred_at", end.toISOString())
        .order("occurred_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + READ_PAGE_SIZE - 1);
      if (error) throw new AnalyticsRepositoryError("read", error);
      const rows = data || [];
      events.push(...rows.map((row) => mapSupabaseRowToAnalyticsEvent(row as SupabaseAnalyticsRow)));
      if (rows.length < READ_PAGE_SIZE) return events;
    }
  }

  loadEvents(start: Date, end: Date) { return this.listRange(start, end); }
  loadLookbackEvents(start: Date, end: Date) { return this.listRange(start, end); }

  async loadDiscoveryStates(start: Date, end: Date): Promise<DiscoveryStateRow[]> {
    if (start >= end) throw new Error("Analytics range start must be before end.");
    return loadAllPages(async (from, to) => {
      const { data, error } = await this.client.from("analytics_discovery_states")
        .select("discovery_state_id,occurred_at,anonymous_session_id,anonymous_journey_id,surface_type,page_path,search_id,query,category,subcategory,product_type,sort_value,result_count")
        .gte("occurred_at", start.toISOString()).lt("occurred_at", end.toISOString())
        .order("occurred_at", { ascending: true }).order("discovery_state_id", { ascending: true }).range(from, to);
      if (error) throw new AnalyticsRepositoryError("discovery state read", error);
      return (data || []) as DiscoveryStateRow[];
    }, READ_PAGE_SIZE);
  }

  async loadDiscoveryResults(stateIds: string[]): Promise<DiscoveryResultRow[]> {
    const rows: DiscoveryResultRow[] = [];
    for (let chunkStart = 0; chunkStart < stateIds.length; chunkStart += 50) {
      const ids = stateIds.slice(chunkStart, chunkStart + 50);
      rows.push(...await loadAllPages(async (from, to) => {
        const { data, error } = await this.client.from("analytics_discovery_results")
          .select("discovery_state_id,entity_type,product_id,brand_id,position")
          .in("discovery_state_id", ids).order("discovery_state_id", { ascending: true })
          .order("position", { ascending: true }).range(from, to);
        if (error) throw new AnalyticsRepositoryError("discovery result read", error);
        return (data || []) as DiscoveryResultRow[];
      }, READ_PAGE_SIZE));
    }
    return rows;
  }
}

export type AnalyticsPeriodWindows = {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
};

export async function loadAnalyticsPeriodWindows(
  repository: Pick<SupabaseAnalyticsRepository, "listRange">,
  period: AnalyticsPeriodWindows,
) {
  const all = await repository.listRange(period.previousStart, period.end);
  const inRange = (event: AnalyticsEvent, start: Date, end: Date) => event.at >= start && event.at < end;
  return {
    selected: all.filter((event) => inRange(event, period.start, period.end)),
    previous: all.filter((event) => inRange(event, period.previousStart, period.previousEnd)),
  };
}

const runtimeEnv = (name: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") =>
  import.meta.env?.[name] || (typeof process !== "undefined" ? process.env?.[name] : undefined);

export function createServerSupabaseAnalyticsRepository() {
  if (typeof window !== "undefined") throw new Error("The Supabase analytics repository is server-only.");
  const url = text(runtimeEnv("SUPABASE_URL"));
  const serviceRoleKey = text(runtimeEnv("SUPABASE_SERVICE_ROLE_KEY"));
  if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase analytics.");
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: createDiagnosticFetch() },
  });
  return new SupabaseAnalyticsRepository(client);
}
