import { productDomain } from "./scheduler.mjs";

const DAY = 86_400_000;
const text = (value) => String(value ?? "").trim();
const select = (value) => text(value && typeof value === "object" ? value.value : value);
const dateMs = (value) => { const parsed = Date.parse(text(value)); return Number.isFinite(parsed) ? parsed : null; };

export const EXTERNAL_CADENCE_DAYS = Object.freeze({
  active_deal: 2,
  recent_change: 2,
  recheck: 1,
  normal: 5,
  blocked: 30,
  inactive: 45,
});

export function externalMonitoringEnabled(env = process.env) {
  return ["1", "true", "yes"].includes(text(env.EXTERNAL_MONITORING_ENABLED).toLowerCase());
}

export function observedMonitoringState(row) {
  const lifecycle = select(row.lifecycle_status).toLowerCase();
  const reader = select(row.reader_status).toLowerCase();
  if (row.is_active === false || ["inactive", "dead"].includes(lifecycle)) return "inactive";
  if (["blocked", "browser_required"].includes(reader)) return "blocked";
  if (["recheck", "not_seen"].includes(lifecycle) || ["ambiguous", "not_detected", "error"].includes(reader)) return "recheck";
  if (row.active_deal === true || Number(row.regular_price) > Number(row.current_price) && Number(row.current_price) > 0) return "active_deal";
  if (["changed", "redirected"].includes(reader)) return "recent_change";
  return "normal";
}

export function dueObservedProduct(row, now = Date.now(), cadence = EXTERNAL_CADENCE_DAYS) {
  const state = observedMonitoringState(row); const checked = dateMs(row.last_checked_at);
  const dueAt = checked == null ? 0 : checked + cadence[state] * DAY;
  const priority = ({ active_deal: 600, recent_change: 500, recheck: 400, normal: 300, blocked: 100, inactive: 50 })[state];
  return { ...row, external_state: state, external_due_at_ms: dueAt, external_overdue_ms: Math.max(0, now - dueAt), external_priority: priority, domain: productDomain(row.canonical_url || row.source_url) };
}

export function selectExternalDue(rows, { now = Date.now(), budget = 500, perDomainCap = 50 } = {}) {
  const queues = new Map();
  for (const row of rows.map((item) => dueObservedProduct(item, now)).filter((item) => item.external_due_at_ms <= now && item.domain !== "invalid")) {
    if (!queues.has(row.domain)) queues.set(row.domain, []);
    queues.get(row.domain).push(row);
  }
  for (const queue of queues.values()) queue.sort((a, b) => b.external_priority - a.external_priority || b.external_overdue_ms - a.external_overdue_ms || Number(a.id) - Number(b.id));
  const selected = []; const domainSelected = new Map();
  while (selected.length < budget) {
    const domains = [...queues.keys()].filter((domain) => queues.get(domain).length && (domainSelected.get(domain) || 0) < perDomainCap)
      .sort((a, b) => { const aa = queues.get(a)[0]; const bb = queues.get(b)[0]; return bb.external_priority - aa.external_priority || bb.external_overdue_ms - aa.external_overdue_ms || (domainSelected.get(a) || 0) - (domainSelected.get(b) || 0) || a.localeCompare(b); });
    if (!domains.length) break;
    for (const domain of domains) {
      if (selected.length >= budget) break;
      selected.push(queues.get(domain).shift()); domainSelected.set(domain, (domainSelected.get(domain) || 0) + 1);
    }
  }
  const totalDue = [...queues.values()].reduce((sum, queue) => sum + queue.length, 0) + selected.length;
  return { selected, total_due: totalDue, deferred_due: totalDue - selected.length, budget, remaining_budget: Math.max(0, budget - selected.length), by_domain: Object.fromEntries(domainSelected) };
}

export function scaleBenchmark({ products, cadenceDays, averageRequestMs = 4_500, globalConcurrency = 6, domainDelayMs = 2_000, retryRate = 0.05, jobTimeoutMinutes = 30 } = {}) {
  const checksPerDay = Math.ceil(products / cadenceDays); const requestsPerDay = Math.ceil(checksPerDay * (1 + retryRate));
  const diverseRuntimeMs = requestsPerDay * averageRequestMs / globalConcurrency;
  const concentratedRuntimeMs = requestsPerDay * Math.max(averageRequestMs, domainDelayMs);
  const timeoutMs = jobTimeoutMinutes * 60_000;
  return { products, cadence_days: cadenceDays, checks_per_day: checksPerDay, approximate_requests_per_day: requestsPerDay,
    diverse_domains_runtime_minutes: Number((diverseRuntimeMs / 60_000).toFixed(1)), single_domain_worst_case_minutes: Number((concentratedRuntimeMs / 60_000).toFixed(1)),
    fits_existing_30m_worker_diverse: diverseRuntimeMs <= timeoutMs, per_domain_bottleneck: "one in-flight request/domain; max(request latency, domain delay)" };
}
