import assert from "node:assert/strict";
import { buildBrandRows, buildBrandSearchRows, buildFilterRows, buildFunnel, buildPageRows, buildProductRows, buildSearchRows, buildUnmetRows, metricSummary, parseEvent, resolvePeriod } from "../src/lib/analytics";

const rows = [
  {id:1,event_name:"search",occurred_at:"2026-08-15T10:00:00Z",anonymous_session_id:"s1",anonymous_journey_id:"j1",search_term:"обеци",search_results_count:5,payload_json:'{"utm_source":"newsletter"}'},
  {id:2,event_name:"view_product",occurred_at:"2026-08-15T10:01:00Z",anonymous_session_id:"s1",product_id:"p1",product_name:"Обеци",brand_id:"b1",brand_name:"Марка",payload_json:'{"product_slug":"obeci","brand_slug":"marka","search_term":"обеци"}'},
  {id:3,event_name:"save_product",occurred_at:"2026-08-15T10:02:00Z",anonymous_session_id:"s1",product_id:"p1",product_name:"Обеци",brand_id:"b1",brand_name:"Марка",payload_json:'{"search_term":"обеци"}'},
  {id:4,event_name:"outbound_product_click",occurred_at:"2026-08-15T10:03:00Z",anonymous_session_id:"s1",product_id:"p1",product_name:"Обеци",brand_id:"b1",brand_name:"Марка",payload_json:'{"search_term":"обеци"}'},
  {id:5,event_name:"search",occurred_at:"2026-08-15T11:00:00Z",anonymous_session_id:"s2",search_term:"несъществуващо",search_results_count:0,payload_json:"{}"},
].map(parseEvent).filter(Boolean) as any[];

const search = buildSearchRows(rows);
// Legacy downstream events without search_id remain visible in product totals,
// but are no longer presented as causally attributed to the last session search.
assert.equal(search.find(row=>row.query==="обеци")?.outbound,0);
assert.equal(search.find(row=>row.query==="несъществуващо")?.zero,1);
const product = buildProductRows(rows)[0];
assert.equal(product.views,1);assert.equal(product.saves,1);assert.equal(product.outbound,1);
assert.equal(product.returned,null);
const brand = buildBrandRows(rows)[0];assert.equal(brand.productViews,1);assert.equal(brand.productOutbound,1);
const metrics = metricSummary(rows,[]);assert.equal(metrics.find(row=>row.key==="sessions")?.value,2);
const yesterday = resolvePeriod(new URL("https://admin.test/analytics/?period=yesterday"));
assert.equal(yesterday.end.getTime() - yesterday.start.getTime(), 86_400_000);
const custom = resolvePeriod(new URL("https://admin.test/analytics/?period=custom&from=2026-08-01&to=2026-08-03"));
assert.equal(custom.from,"2026-08-01");assert.equal(custom.to,"2026-08-03");
const lastMonth=resolvePeriod(new URL("https://admin.test/analytics/?period=last_month"),new Date("2026-09-14T09:00:00Z"));assert.equal(lastMonth.from,"2026-08-01");assert.equal(lastMonth.to,"2026-08-31");assert.equal(lastMonth.previousStart.toISOString(),"2026-06-30T21:00:00.000Z");assert.equal(lastMonth.previousEnd.toISOString(),"2026-07-31T21:00:00.000Z");
const january=resolvePeriod(new URL("https://admin.test/analytics/?period=last_month"),new Date("2026-01-15T09:00:00Z"));assert.equal(january.from,"2025-12-01");assert.equal(january.to,"2025-12-31");
const leapFebruary=resolvePeriod(new URL("https://admin.test/analytics/?period=last_month"),new Date("2024-03-15T09:00:00Z"));assert.equal(leapFebruary.from,"2024-02-01");assert.equal(leapFebruary.to,"2024-02-29");
const lastQuarter=resolvePeriod(new URL("https://admin.test/analytics/?period=last_quarter"),new Date("2026-09-14T09:00:00Z"));assert.equal(lastQuarter.from,"2026-04-01");assert.equal(lastQuarter.to,"2026-06-30");assert.equal(lastQuarter.previousStart.toISOString(),"2025-12-31T22:00:00.000Z");assert.equal(lastQuarter.previousEnd.toISOString(),"2026-03-31T21:00:00.000Z");
const q1Boundary=resolvePeriod(new URL("https://admin.test/analytics/?period=last_quarter"),new Date("2026-02-14T09:00:00Z"));assert.equal(q1Boundary.from,"2025-10-01");assert.equal(q1Boundary.to,"2025-12-31");
const intelligence = [
  {id:10,event_name:"search",occurred_at:"2026-08-15T12:00:00Z",anonymous_session_id:"s3",search_term:"подарък",search_results_count:2,payload_json:JSON.stringify({search_id:"q1",category:"gifts",gift_recipient:"майка",gift_occasion:"рожден ден",price_range:"25-50",returned_products_json:'[["p1","b1",1]]',returned_brands_json:'[["b1",1]]',page_path:"/",page_type:"discovery"})},
  {id:11,event_name:"product_impression",occurred_at:"2026-08-15T12:01:00Z",anonymous_session_id:"s3",product_id:"p1",brand_id:"b1",payload_json:'{"search_id":"q1","page_path":"/"}'},
  {id:12,event_name:"view_product",occurred_at:"2026-08-15T12:02:00Z",anonymous_session_id:"s3",product_id:"p1",product_name:"Подарък",brand_id:"b1",brand_name:"Марка",payload_json:'{"search_id":"q1","search_term":"подарък","page_path":"/p/p1","page_type":"product"}'},
  {id:13,event_name:"outbound_product_click",occurred_at:"2026-08-15T12:03:00Z",anonymous_session_id:"s3",product_id:"p1",brand_id:"b1",payload_json:'{"search_id":"q1"}'},
  {id:14,event_name:"apply_filter",occurred_at:"2026-08-15T11:59:00Z",anonymous_session_id:"s3",payload_json:'{"filter_name":"product_constraints","materials":"памук","colors":"червен","attributes":"ръчно","price_range":"25-50"}'},
  {id:15,event_name:"search",occurred_at:"2026-08-15T13:00:00Z",anonymous_session_id:"s4",search_term:"липса",search_results_count:0,payload_json:'{"category":"home"}'},
].map(parseEvent).filter(Boolean) as any[];
assert.equal(buildProductRows(intelligence).find(x=>x.id==="p1")?.returned,1);
assert.equal(buildBrandRows(intelligence).find(x=>x.id==="b1")?.returned,2);
assert.equal(buildBrandSearchRows(intelligence,"b1")[0]?.query,"подарък");
assert.equal(buildUnmetRows(intelligence).find(x=>x.query==="липса")?.zero,1);
assert.ok(buildFilterRows(intelligence).some(x=>x.key==="materials"&&x.value==="памук"));
assert.equal(buildPageRows(intelligence).find(x=>x.path==="/p/p1")?.productViews,1);
const funnel=buildFunnel(intelligence);assert.equal(funnel.returns,2);assert.equal(funnel.impressions,1);assert.equal(funnel.views,1);assert.equal(funnel.outbound,1);
console.log("analytics aggregation tests passed");
