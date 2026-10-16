#!/usr/bin/env node
import { monitoringCoverageMetrics, productDomain, selectDueProducts } from "../src/lib/price-monitor/index.mjs";

const DAY_MS = 86_400_000;
const start = Date.parse("2026-10-01T02:17:00.000Z");
const isoDaysAgo = (now, days) => new Date(now - days * DAY_MS).toISOString();

function syntheticCatalog() {
  const rows = [];
  const add = (count, cohort, status, options = {}) => {
    for (let index = 0; index < count; index += 1) {
      const id = rows.length + 1;
      const checkedDays = options.never ? null : (index % (options.checkedSpread || 10)) + (options.checkedBase || 1);
      const row = {
        id, cohort, is_active: true, product_url: `https://brand-${id % 40}.example/products/${id}`,
        price_check_status: status, price_last_checked_at: checkedDays == null ? null : isoDaysAgo(start, checkedDays),
      };
      if (options.offerAge != null) {
        row.offer_price_status = "verified_current";
        row.offer_price_verified_at = isoDaysAgo(start, options.offerAge + (index % (options.offerSpread || 1)));
      }
      rows.push(row);
    }
  };
  add(800, "unchanged", "verified", { checkedSpread: 10, offerAge: 1, offerSpread: 13 });
  add(80, "changed", "changed", { checkedBase: 3, checkedSpread: 8 });
  add(80, "blocked", "blocked", { checkedSpread: 35, offerAge: 5, offerSpread: 12 });
  add(80, "ambiguous", "ambiguous", { checkedSpread: 12 });
  add(40, "transient_error", "error", { checkedBase: 3, checkedSpread: 8 });
  add(40, "never_checked", "unmonitored", { never: true });
  add(44, "expired_offer", "verified", { checkedSpread: 3, offerAge: 15, offerSpread: 5 });
  return rows;
}

function legacySelection(catalog, now) {
  const intervals = { changed: 3, error: 3, not_detected: 7, ambiguous: 7, browser_required: 30, blocked: 30, dead_url: 45, redirected: 7, verified: 7 };
  const priorities = { changed: 100, error: 90, not_detected: 75, ambiguous: 70, redirected: 60, verified: 50, browser_required: 35, blocked: 25, dead_url: 10 };
  const dailyTarget = Math.ceil(catalog.length / 7);
  const due = catalog.map((row) => {
    const checkedAt = Date.parse(row.price_last_checked_at || "");
    const dueAt = Number.isFinite(checkedAt) ? checkedAt + (intervals[row.price_check_status] || 7) * DAY_MS : 0;
    return { ...row, domain: productDomain(row.product_url), dueAt, overdue: Math.max(0, now - dueAt), priority: priorities[row.price_check_status] || 80 };
  }).filter((row) => row.dueAt <= now);
  const groups = new Map(); const domainCounts = new Map();
  for (const row of catalog) { const domain = productDomain(row.product_url); domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1); }
  for (const row of due) { if (!groups.has(row.domain)) groups.set(row.domain, []); groups.get(row.domain).push(row); }
  for (const rows of groups.values()) rows.sort((a, b) => b.priority - a.priority || b.overdue - a.overdue || a.id - b.id);
  const domains = [...groups.keys()].sort((a, b) => groups.get(b)[0].priority - groups.get(a)[0].priority || groups.get(b)[0].overdue - groups.get(a)[0].overdue || a.localeCompare(b));
  const selected = []; const selectedByDomain = new Map();
  while (selected.length < dailyTarget && domains.some((domain) => groups.get(domain).length && (selectedByDomain.get(domain) || 0) < Math.ceil(domainCounts.get(domain) / 7))) {
    for (const domain of domains) {
      if ((selectedByDomain.get(domain) || 0) >= Math.ceil(domainCounts.get(domain) / 7)) continue;
      const row = groups.get(domain).shift();
      if (row && selected.length < dailyTarget) { selected.push(row); selectedByDomain.set(domain, (selectedByDomain.get(domain) || 0) + 1); }
    }
  }
  return { selected, total_due: due.length, deferred_due: due.length - selected.length, run_capacity: Math.ceil(dailyTarget * 1.25) };
}

function simulate({ explicitLimit = null, legacy = false } = {}) {
  const catalog = syntheticCatalog();
  const initiallyNever = new Set(catalog.filter((row) => row.price_last_checked_at == null).map((row) => row.id));
  const firstCheckedDay = new Map(); const daily = []; const unique = new Set();
  let totalProductsChecked = 0; let totalHttpAttempts = 0; let maximumBacklog = 0; let maximumDomainSelection = 0;
  for (let day = 0; day < 30; day += 1) {
    const now = start + day * DAY_MS;
    const selection = legacy ? legacySelection(catalog, now) : selectDueProducts(catalog, { now, ...(explicitLimit == null ? {} : { limit: explicitLimit }) });
    maximumBacklog = Math.max(maximumBacklog, selection.total_due);
    const perDomain = new Map();
    for (const selected of selection.selected) {
      totalProductsChecked += 1; unique.add(selected.id);
      perDomain.set(selected.domain, (perDomain.get(selected.domain) || 0) + 1);
      if (initiallyNever.has(selected.id) && !firstCheckedDay.has(selected.id)) firstCheckedDay.set(selected.id, day);
      const row = catalog.find((candidate) => candidate.id === selected.id);
      row.price_last_checked_at = new Date(now).toISOString();
      if (row.cohort === "transient_error") totalHttpAttempts += 3;
      else totalHttpAttempts += 1;
      if (["unchanged", "expired_offer"].includes(row.cohort)) {
        row.price_check_status = "verified";
        row.offer_price_status = "verified_current";
        row.offer_price_verified_at = new Date(now).toISOString();
      } else if (row.cohort === "never_checked") row.price_check_status = "verified";
    }
    maximumDomainSelection = Math.max(maximumDomainSelection, ...perDomain.values(), 0);
    daily.push({ day: day + 1, due: selection.total_due, selected: selection.selected.length, deferred: selection.deferred_due, capacity: selection.run_capacity });
  }
  const end = start + 29 * DAY_MS;
  const finalSelection = legacy ? legacySelection(catalog, end) : selectDueProducts(catalog, { now: end, ...(explicitLimit == null ? {} : { limit: explicitLimit }) });
  const metrics = monitoringCoverageMetrics(catalog, { now: end, selected: finalSelection.selected, plannedCapacity: finalSelection.run_capacity });
  return {
    catalogue: catalog.length,
    days: 30,
    scheduler: legacy ? "legacy" : "expiry_aware",
    configured_limit: explicitLimit,
    product_checks: totalProductsChecked,
    estimated_http_attempts: totalHttpAttempts,
    unique_products_checked: unique.size,
    initially_never_checked: initiallyNever.size,
    never_checked_selected: firstCheckedDay.size,
    worst_time_to_first_check_days: Math.max(...firstCheckedDay.values()),
    maximum_daily_backlog: maximumBacklog,
    final_due_backlog: finalSelection.total_due,
    final_deferred_backlog: finalSelection.deferred_due,
    maximum_products_from_one_domain_per_day: maximumDomainSelection,
    daily,
    final_metrics: metrics,
  };
}

console.log(JSON.stringify({ legacy_baseline: simulate({ legacy: true }), expiry_aware: simulate(), constrained_capacity: simulate({ explicitLimit: 100 }) }, null, 2));
