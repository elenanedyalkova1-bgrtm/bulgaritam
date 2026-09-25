import assert from "node:assert/strict";
import test from "node:test";
import { calculateDailyTarget, calculateRunCapacity, dueIntervalDays, isTransientResult, runDomainThrottled, scheduledRunSummary, selectAllMonitorableProducts, selectDueProducts, withTransientRetry } from "../src/lib/price-monitor/index.mjs";

const now = Date.parse("2026-09-17T12:00:00Z");
const daysAgo = (days) => new Date(now - days * 86_400_000).toISOString();
const product = (id, domain, status, days) => ({ id, product_url: `https://${domain}/p/${id}`, price_check_status: status, price_last_checked_at: days == null ? null : daysAgo(days) });

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
  assert.equal(result.selected[0].id,1,"changed product has highest priority");
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
  assert.equal(result.daily_target,17); assert.equal(result.selected.length,17); assert.equal(result.deferred_due,97);
  assert.ok(result.selected.filter((item)=>item.domain==="large.test").length <= 15,"100-product domain is capped at ceil(100/7) per day");
  assert.ok(new Set(result.selected.map((item)=>item.domain)).size > 1,"domain round-robin preserves diversity");
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
  assert.deepEqual(summary,{checked:8,verified:1,changed:1,ambiguous:1,not_detected:1,blocked:1,dead:1,redirected:1,errors:1,duration_ms:250});
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
