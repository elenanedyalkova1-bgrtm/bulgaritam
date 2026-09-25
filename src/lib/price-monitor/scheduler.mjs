const DAY_MS = 86_400_000;
const TRANSIENT_HTTP = new Set([408, 425, 500, 502, 503, 504]);

const text = (value) => String(value ?? "").trim();
const selectValue = (value) => text(value && typeof value === "object" ? value.value : value);
const time = (value) => { const parsed = Date.parse(text(value)); return Number.isFinite(parsed) ? parsed : null; };
export const productDomain = (value) => { try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); } catch { return "invalid"; } };

export function dueIntervalDays(status) {
  return ({ changed: 3, error: 3, not_detected: 7, ambiguous: 7, browser_required: 30, blocked: 30, dead_url: 45, redirected: 7, verified: 7 })[status] ?? 7;
}

function priority(status) {
  return ({ changed: 100, error: 90, not_detected: 75, ambiguous: 70, redirected: 60, verified: 50, browser_required: 35, blocked: 25, dead_url: 10 })[status] ?? 80;
}

export function dueProduct(product, now = Date.now()) {
  const status = selectValue(product.price_check_status) || "unmonitored";
  const checkedAt = time(product.price_last_checked_at);
  const dueAt = checkedAt == null ? 0 : checkedAt + dueIntervalDays(status) * DAY_MS;
  return { ...product, monitoring_status: status, monitoring_checked_at_ms: checkedAt, monitoring_due_at_ms: dueAt, monitoring_overdue_ms: Math.max(0, now - dueAt), monitoring_priority: priority(status), domain: productDomain(product.product_url) };
}

export function calculateDailyTarget(activeMonitorableProducts, cycleDays = 7) {
  const count = Math.max(0, Number(activeMonitorableProducts) || 0);
  return count ? Math.ceil(count / Math.max(1, Number(cycleDays) || 7)) : 0;
}

export function calculateRunCapacity(dailyTarget, { multiplier = 1.25, minimum = 25, absoluteMaximum = 2_000 } = {}) {
  if (!dailyTarget) return 0;
  return Math.min(absoluteMaximum, Math.max(minimum, Math.ceil(dailyTarget * multiplier)));
}

export function isActiveMonitorable(product) {
  const active = product.is_active == null || text(product.is_active) === "" || ["true", "1", "yes", "y"].includes(text(product.is_active).toLowerCase());
  return active && productDomain(product.product_url) !== "invalid";
}

export function selectAllMonitorableProducts(products) {
  return products.filter(isActiveMonitorable).sort((a, b) => Number(a.id) - Number(b.id));
}

export function selectDueProducts(products, { now = Date.now(), limit, cycleDays = 7 } = {}) {
  const monitorable = products.filter(isActiveMonitorable);
  const dailyTarget = calculateDailyTarget(monitorable.length, cycleDays);
  const runCapacity = calculateRunCapacity(dailyTarget);
  const requestedLimit = limit == null ? dailyTarget : Math.max(1, Number(limit) || dailyTarget);
  const boundedLimit = Math.min(requestedLimit, runCapacity || requestedLimit);
  const due = monitorable.map((product) => dueProduct(product, now)).filter((product) => product.monitoring_due_at_ms <= now);
  const groups = new Map();
  for (const product of due) { if (!groups.has(product.domain)) groups.set(product.domain, []); groups.get(product.domain).push(product); }
  for (const rows of groups.values()) rows.sort((a, b) => b.monitoring_priority - a.monitoring_priority || b.monitoring_overdue_ms - a.monitoring_overdue_ms || Number(a.id) - Number(b.id));
  const domains = [...groups.keys()].sort((a, b) => {
    const aa = groups.get(a)[0]; const bb = groups.get(b)[0];
    return bb.monitoring_priority - aa.monitoring_priority || bb.monitoring_overdue_ms - aa.monitoring_overdue_ms || a.localeCompare(b);
  });
  const selected = [];
  const domainCounts = new Map();
  for (const product of monitorable) domainCounts.set(productDomain(product.product_url), (domainCounts.get(productDomain(product.product_url)) || 0) + 1);
  const domainTargets = new Map(domains.map((domain) => [domain, calculateDailyTarget(domainCounts.get(domain) || 0, cycleDays)]));
  const domainSelected = new Map();
  while (selected.length < boundedLimit && domains.some((domain) => groups.get(domain).length && (domainSelected.get(domain) || 0) < domainTargets.get(domain))) {
    for (const domain of domains) {
      if ((domainSelected.get(domain) || 0) >= domainTargets.get(domain)) continue;
      const product = groups.get(domain).shift();
      if (product && selected.length < boundedLimit) {
        selected.push(product);
        domainSelected.set(domain, (domainSelected.get(domain) || 0) + 1);
      }
    }
  }
  return {
    selected, total_due: due.length, deferred_due: Math.max(0, due.length - selected.length),
    active_monitorable: monitorable.length, cycle_days: cycleDays, daily_target: dailyTarget, run_capacity: runCapacity,
    domain_targets: Object.fromEntries(domainTargets),
  };
}

export function isTransientResult(result) {
  return result?.status === "error" && (TRANSIENT_HTTP.has(result.http_status) || ["timeout", "fetch failed", "network_error"].includes(result.error_reason));
}

export async function withTransientRetry(operation, { retries = 2, baseDelayMs = 1_000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), onRetry } = {}) {
  let result;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    result = await operation(attempt);
    if (!isTransientResult(result) || attempt === retries) return { result, attempts: attempt + 1 };
    const delay = baseDelayMs * (2 ** attempt);
    onRetry?.({ attempt: attempt + 1, delay, result });
    await sleep(delay);
  }
  return { result, attempts: retries + 1 };
}

export async function runDomainThrottled(items, worker, {
  concurrency = 6, domainDelayMs = 2_000, now = () => Date.now(), sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), onProgress,
} = {}) {
  const pending = items.map((item, index) => ({ item, index, domain: item.domain || productDomain(item.product_url) }));
  const results = new Array(items.length); const activeDomains = new Set(); const nextDomainStart = new Map();
  let completed = 0;
  async function runner() {
    while (pending.length) {
      const currentTime = now();
      let index = pending.findIndex((entry) => !activeDomains.has(entry.domain) && (nextDomainStart.get(entry.domain) || 0) <= currentTime);
      if (index < 0) {
        const eligibleTimes = pending.filter((entry) => !activeDomains.has(entry.domain)).map((entry) => nextDomainStart.get(entry.domain) || currentTime);
        await sleep(Math.max(10, Math.min(250, (eligibleTimes.length ? Math.min(...eligibleTimes) : currentTime + 50) - currentTime)));
        continue;
      }
      const [entry] = pending.splice(index, 1); activeDomains.add(entry.domain); nextDomainStart.set(entry.domain, currentTime + domainDelayMs);
      try { results[entry.index] = await worker(entry.item); }
      catch (error) { results[entry.index] = { product_id: entry.item.id, product_url: entry.item.product_url, status: "error", error_reason: String(error?.message || error) }; }
      finally { activeDomains.delete(entry.domain); completed += 1; onProgress?.({ completed, total: items.length, domain: entry.domain }); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length || 1) }, runner));
  return results;
}

export function scheduledRunSummary(results, startedAt, finishedAt = Date.now()) {
  const outcome = (result) => result?.extraction_status || result?.status;
  const count = (value) => results.filter((result) => outcome(result) === value || result?.status === value).length;
  return {
    checked: results.length, verified: count("verified"), changed: count("changed"), ambiguous: count("ambiguous"),
    not_detected: count("not_detected"), blocked: count("blocked"), dead: count("dead_url"),
    redirected: results.filter((result) => result?.redirected || result?.status === "redirected").length,
    errors: count("error"), duration_ms: Math.max(0, finishedAt - startedAt),
  };
}
