import { loadConsumerDeals } from "../../../src/lib/weekly-discounts";
import { publicDealsPayload } from "../../../src/lib/public-deal-contract.mjs";

export const CONSUMER_DEALS_CACHE_TTL_MS = 10 * 60_000;
export const CONSUMER_DEALS_MAX_STALE_MS = 7 * 24 * 60 * 60_000;

type Snapshot = ReturnType<typeof publicDealsPayload>;
type Loader = (now: Date) => Promise<{ deals: unknown[] }>;

export function createConsumerDealsService({ load = loadConsumerDeals as Loader, ttlMs = CONSUMER_DEALS_CACHE_TTL_MS, maxStaleMs = CONSUMER_DEALS_MAX_STALE_MS } = {}) {
  let cached: Snapshot | null = null; let cachedAt = 0; let refresh: Promise<Snapshot> | null = null;
  let lastAttemptAt = 0; let lastSuccessAt = 0; let lastErrorAt = 0; let lastError = ""; let lastRefreshStatus = "not_attempted";
  return {
    async get(now = new Date()) {
      const timestamp = now.getTime();
      if (cached && timestamp - cachedAt < ttlMs) { lastRefreshStatus = "cache_hit"; return { ...cached, cache: "fresh" as const }; }
      try {
        lastAttemptAt = timestamp; lastRefreshStatus = "refreshing";
        refresh ||= Promise.resolve(load(now)).then((result) => {
          const payload = publicDealsPayload(result.deals || [], now, false);
          cached = payload; cachedAt = timestamp; lastSuccessAt = timestamp; lastError = ""; lastRefreshStatus = "success";
          console.info(JSON.stringify({ event: "consumer_deals_refresh", status: "success", generated_at: payload.generated_at, deal_count: payload.count }));
          return payload;
        }).finally(() => { refresh = null; });
        return { ...await refresh, cache: "refreshed" as const };
      } catch (error) {
        lastErrorAt = timestamp; lastError = error instanceof Error ? error.message : "unknown error"; lastRefreshStatus = "error";
        console.error(JSON.stringify({ event: "consumer_deals_refresh", status: "error", attempted_at: now.toISOString(), error: lastError }));
        if (cached && timestamp - cachedAt <= maxStaleMs) { lastRefreshStatus = "stale_if_error"; return { ...cached, stale: true, cache: "stale-if-error" as const }; }
        throw error;
      }
    },
    inspect(now = new Date()) { return { hasSnapshot: Boolean(cached), lastAttemptAt, lastSuccessAt, lastErrorAt, lastError, lastRefreshStatus,
      dealCount: cached?.count ?? 0, lkgAgeMs: cachedAt ? Math.max(0, now.getTime() - cachedAt) : null, ttlMs, maxStaleMs }; },
  };
}

export const consumerDealsService = createConsumerDealsService();

export async function runConsumerDealsLkgSmokeTest(now = new Date(), load: Loader = loadConsumerDeals as Loader) {
  let fail = false;
  const service = createConsumerDealsService({ load: async (at) => { if (fail) throw new Error("controlled_smoke_upstream_failure"); return load(at); }, ttlMs: 0 });
  const healthy = await service.get(now); fail = true;
  const failedAt = new Date(now.getTime() + 1);
  const fallback = await service.get(failedAt); const health = service.inspect(failedAt);
  return { passed: fallback.cache === "stale-if-error" && fallback.count === healthy.count && fallback.generated_at === healthy.generated_at,
    healthy_status: 200, fallback_status: 200, healthy_count: healthy.count, fallback_count: fallback.count,
    fallback_cache: fallback.cache, fallback_stale: fallback.stale === true, lkg_age_ms: health.lkgAgeMs,
    generated_at_preserved: fallback.generated_at === healthy.generated_at, last_refresh_status: health.lastRefreshStatus };
}
