import assert from "node:assert/strict";
import test from "node:test";
import { calculateDailyTarget, calculateRunCapacity, dueIntervalDays, dueProduct, isTransientResult, monitoringCoverageMetrics, OFFER_RENEWAL_TARGET_DAYS, runDomainThrottled, scheduledRunSummary, selectAllMonitorableProducts, selectDueProducts, selectProductsByIds, withTransientRetry } from "../src/lib/price-monitor/index.mjs";

const now = Date.parse("2026-09-17T12:00:00Z");
const daysAgo = (days) => new Date(now - days * 86_400_000).toISOString();
const product = (id, domain, status, days, extra = {}) => ({ id, product_url: `https://${domain}/p/${id}`, price_check_status: status, price_last_checked_at: days == null ? null : daysAgo(days), ...extra });

test("due intervals prioritize changes and back off blocked/dead URLs", () => {
  assert.equal(dueIntervalDays("changed"), 3); assert.equal(dueIntervalDays("verified"), 7);
  assert.equal(dueIntervalDays("blocked"), 30); assert.equal(dueIntervalDays("dead_url"), 45);
});

test("due selection is bounded and domain-first", () => {
  const catalog = [
    product(1,"a.test","changed",4), product(2,"a.test","verified",15), product(3,"b.test","verified",15),
    product(4,"c.test","blocked",3), product(5,"d.test","verified",1), product(6,"e.test",null,null),
  ];
  const result = selectDueProducts(catalog,{now,limit:3});
  assert.equal(result.total_due,4); assert.equal(result.selected.length,3); assert.equal(result.deferred_due,1);
  assert.equal(new Set(result.selected.map((item)=>item.domain)).size,3,"first pass selects distinct domains");
  assert.equal(result.selected[0].id,6,"never-checked product cannot be starved by repeatedly due changed products");
});

test("daily sizing is catalog-aware and bounded", () => {
  assert.equal(calculateDailyTarget(1_016), 146); assert.equal(calculateDailyTarget(2_000), 286);
  assert.equal(calculateDailyTarget(10_000), 1_429); assert.equal(calculateDailyTarget(25_000), 3_572);
  assert.equal(calculateRunCapacity(3_572), 2_000, "absolute boundary replaces the old 250 limit");
});

test("large domains are spread across the 7-day cycle and backlog remains due", () => {
  const catalog = [
    ...Array.from({length:100},(_,index)=>product(index+1,"large.test","verified",20)),
    ...Array.from({length:14},(_,index)=>product(index+101,`small-${index}.test`,"verified",20)),
  ];
  const result = selectDueProducts(catalog,{now});
  assert.equal(result.daily_target,17); assert.equal(result.run_capacity,25); assert.equal(result.selected.length,25); assert.equal(result.deferred_due,89);
  assert.ok(result.selected.filter((item)=>item.domain==="large.test").length <= 19,"100-product domain is capped at 125% of its seven-day target");
  assert.ok(new Set(result.selected.map((item)=>item.domain)).size > 1,"domain round-robin preserves diversity");
});

test("Offer near expiry receives priority over ordinary due products", () => {
  const nearExpiry = product(2, "risk.test", "verified", 4, { offer_price_status: "verified_current", offer_price_verified_at: daysAgo(12) });
  const ordinary = product(1, "ordinary.test", "changed", 4);
  const result = selectDueProducts([ordinary, nearExpiry], { now, limit: 1 });
  assert.equal(result.selected[0].id, 2);
  assert.equal(result.selected[0].offer_expiring_within_3_days, true);
});

test("authoritative renewal deadline is day 9 and can make an otherwise early check due", () => {
  const row = dueProduct(product(1, "offer.test", "blocked", 1, { offer_price_status: "verified_current", offer_price_verified_at: daysAgo(OFFER_RENEWAL_TARGET_DAYS) }), now);
  assert.equal(row.offer_renewal_due_at_ms, now);
  assert.equal(row.monitoring_due_at_ms, now);
  assert.equal(selectDueProducts([row], { now }).selected.length, 1);
});

test("expired Offers are eligible for prompt rechecking", () => {
  const expired = product(1, "offer.test", "blocked", 4, { offer_price_status: "verified_current", offer_price_verified_at: daysAgo(15) });
  const selected = selectDueProducts([expired], { now, limit: 1 }).selected[0];
  assert.equal(selected.id, 1); assert.equal(selected.offer_expired, true);
});

test("failed renewal attempts use a bounded three-day retry cadence", () => {
  const attemptedYesterday = product(1, "offer.test", "blocked", 1, { offer_price_status: "verified_current", offer_price_verified_at: daysAgo(15) });
  const attemptedThreeDaysAgo = product(2, "offer.test", "blocked", 3, { offer_price_status: "verified_current", offer_price_verified_at: daysAgo(15) });
  assert.equal(selectDueProducts([attemptedYesterday], { now }).selected.length, 0);
  assert.equal(selectDueProducts([attemptedThreeDaysAgo], { now }).selected.length, 1);
});

test("products without authoritative Offers retain normal status intervals", () => {
  assert.equal(selectDueProducts([product(1, "plain.test", "verified", 6)], { now }).selected.length, 0);
  assert.equal(selectDueProducts([product(1, "plain.test", "verified", 7)], { now }).selected.length, 1);
  assert.equal(selectDueProducts([product(2, "plain.test", "blocked", 29)], { now }).selected.length, 0);
});

test("changed products do not starve never-checked or substantially older due products", () => {
  const rows = [
    product(1, "same.test", "changed", 4),
    product(2, "same.test", "verified", 20),
    product(3, "same.test", null, null),
  ];
  assert.deepEqual(selectDueProducts(rows, { now, limit: 2 }).selected.map((row) => row.id), [3, 2]);
});

test("default selection uses bounded spare capacity without exceeding global or domain ceilings", () => {
  const rows = Array.from({ length: 1_164 }, (_, index) => product(index + 1, `domain-${index % 80}.test`, "verified", 20));
  const result = selectDueProducts(rows, { now });
  assert.equal(result.daily_target, 167);
  assert.equal(result.run_capacity, 209);
  assert.equal(result.selected.length, 209);
  assert.ok(Object.entries(result.domain_capacities).every(([domain, cap]) => result.selected.filter((row) => row.domain === domain).length <= cap));
});

test("missing and invalid timestamps fail safe without manufacturing Offer expiry", () => {
  const missing = dueProduct(product(1, "safe.test", "verified", null, { offer_price_status: "verified_current", offer_price_verified_at: "invalid" }), now);
  assert.equal(missing.offer_expires_at_ms, null);
  assert.equal(missing.monitoring_due_at_ms, 0);
  assert.equal(selectDueProducts([missing], { now }).selected.length, 1);
});

test("coverage metrics separate monitoring attempts from authoritative freshness", () => {
  const rows = [
    product(1, "a.test", "verified", 1, { offer_price_status: "verified_current", offer_price_verified_at: daysAgo(1) }),
    product(2, "b.test", "blocked", 1, { offer_price_status: "verified_current", offer_price_verified_at: daysAgo(15) }),
    product(3, "c.test", "ambiguous", 8),
    product(4, "d.test", null, null),
  ];
  const selected = selectDueProducts(rows, { now }).selected;
  const metrics = monitoringCoverageMetrics(rows, { now, selected, plannedCapacity: 25 });
  assert.equal(metrics.monitoring_coverage.total_eligible, 4);
  assert.equal(metrics.monitoring_coverage.unique_checked_last_7_days, 2);
  assert.equal(metrics.monitoring_coverage.never_checked, 1);
  assert.equal(metrics.monitoring_coverage.blocked, 1);
  assert.equal(metrics.monitoring_coverage.ambiguous, 1);
  assert.equal(metrics.authoritative_offer_coverage.fresh, 1);
  assert.equal(metrics.authoritative_offer_coverage.expired, 1);
  assert.equal(metrics.capacity.planned, 25);
});

test("retry only retries transient failures with exponential backoff", async () => {
  const delays=[]; let attempts=0;
  const transient=await withTransientRetry(async()=>{attempts+=1;return attempts<3?{status:"error",http_status:503,error_reason:"http_503"}:{status:"verified"};},{retries:2,baseDelayMs:10,sleep:async(ms)=>delays.push(ms)});
  assert.equal(transient.attempts,3); assert.deepEqual(delays,[10,20]); assert.equal(transient.result.status,"verified");
  let blockedAttempts=0; const blocked=await withTransientRetry(async()=>{blockedAttempts+=1;return {status:"blocked",http_status:403,error_reason:"http_403"};},{sleep:async()=>{throw new Error("must not sleep")}});
  assert.equal(blockedAttempts,1); assert.equal(blocked.attempts,1); assert.equal(isTransientResult(blocked.result),false);
});

test("domain throttling never runs two requests for one domain concurrently", async () => {
  const active=new Map(); let maxSameDomain=0; const starts=[];
  const items=[product(1,"same.test","verified",8),product(2,"same.test","verified",8),product(3,"other.test","verified",8)];
  const results=await runDomainThrottled(items,async(item)=>{const domain=new URL(item.product_url).hostname;active.set(domain,(active.get(domain)||0)+1);maxSameDomain=Math.max(maxSameDomain,active.get(domain));starts.push({domain,at:Date.now()});await new Promise(resolve=>setTimeout(resolve,8));active.set(domain,active.get(domain)-1);return {product_id:item.id,status:"verified",extraction_status:"verified"};},{concurrency:3,domainDelayMs:15});
  assert.equal(maxSameDomain,1); assert.equal(results.length,3);
  const same=starts.filter((entry)=>entry.domain==="same.test"); assert.ok(same[1].at-same[0].at>=12,"same-domain starts respect delay");
});

test("scheduled summary exposes requested operational counts", () => {
  const summary=scheduledRunSummary([{status:"verified"},{status:"changed"},{status:"ambiguous"},{status:"not_detected"},{status:"blocked"},{status:"dead_url"},{status:"error"},{status:"redirected",redirected:true}],100,350);
  assert.deepEqual(summary,{checked:8,verified:1,changed:1,ambiguous:1,not_detected:1,blocked:1,dead:1,redirected:1,errors:1,browser_required:0,other:0,duration_ms:250});
});

test("scheduled summary uses mutually exclusive canonical outcomes", () => {
  const summary=scheduledRunSummary([
    {status:"verified",extraction_status:"verified"},
    {status:"ambiguous",extraction_status:"verified",error_reason:"currency_mismatch"},
    {status:"blocked",extraction_status:null},
    {status:"browser_required",extraction_status:"not_detected"},
    {status:"unexpected",extraction_status:"verified"},
  ],100,200);
  assert.equal(summary.checked,5); assert.equal(summary.verified,1); assert.equal(summary.ambiguous,1);
  assert.equal(summary.blocked,1); assert.equal(summary.browser_required,1); assert.equal(summary.other,1);
  const total=["verified","changed","ambiguous","not_detected","blocked","dead","redirected","errors","browser_required","other"].reduce((sum,key)=>sum+summary[key],0);
  assert.equal(total,summary.checked);
});

test("all selection includes every active monitorable product without capacity truncation in deterministic ID order", () => {
  const catalog = [
    { id: 20, is_active: true, product_url: "https://brand.test/p/20" },
    { id: 3, is_active: "", product_url: "https://brand.test/p/3" },
    { id: 2, is_active: false, product_url: "https://brand.test/p/2" },
    { id: 4, is_active: true, product_url: "not-a-url" },
    { id: 5, is_active: true, product_url: "" },
    ...Array.from({ length: 300 }, (_, index) => ({ id: 1000 + index, is_active: "true", product_url: `https://bulk.test/p/${index}` })),
  ];
  const selected = selectAllMonitorableProducts(catalog);
  assert.equal(selected.length, 302, "all mode is not truncated by daily or run capacity");
  assert.deepEqual(selected.slice(0, 2).map((item) => item.id), [3, 20]);
  assert.equal(selected.some((item) => item.id === 2), false, "inactive product is excluded");
  assert.equal(selected.some((item) => item.id === 4 || item.id === 5), false, "missing or invalid URL is excluded");
  assert.deepEqual(selected.map((item) => item.id), selected.map((item) => item.id).slice().sort((a, b) => a - b));
});

test("explicit ID selection enforces the exact bounded monitorable allowlist", () => {
  const rows = [product(3,"c.test","verified",8),product(47,"a.test","verified",8),product(41,"b.test","verified",8)];
  assert.deepEqual(selectProductsByIds(rows,["47","41","3"]).map((row)=>row.id),[47,41,3]);
  assert.throws(()=>selectProductsByIds(rows,["47","47"]),/duplicates/);
  assert.throws(()=>selectProductsByIds(rows,["47","999"]),/missing products: 999/);
  assert.throws(()=>selectProductsByIds([...rows,{id:9,is_active:false,product_url:"https:\/\/x.test\/p\/9"}],["9"]),/non-monitorable/);
  assert.throws(()=>selectProductsByIds(rows,["not-an-id"]),/numeric product IDs/);
  assert.throws(()=>selectProductsByIds(Array.from({length:26},(_,i)=>product(i+1,"x.test","verified",8)),Array.from({length:26},(_,i)=>String(i+1))),/25-product safety cap/);
});
