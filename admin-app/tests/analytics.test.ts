import assert from "node:assert/strict";
import { buildBrandRows, buildProductRows, buildSearchRows, metricSummary, parseEvent, resolvePeriod } from "../src/lib/analytics";

const rows = [
  {id:1,event_name:"search",occurred_at:"2026-08-15T10:00:00Z",anonymous_session_id:"s1",anonymous_journey_id:"j1",search_term:"обеци",search_results_count:5,payload_json:'{"utm_source":"newsletter"}'},
  {id:2,event_name:"view_product",occurred_at:"2026-08-15T10:01:00Z",anonymous_session_id:"s1",product_id:"p1",product_name:"Обеци",brand_id:"b1",brand_name:"Марка",payload_json:'{"product_slug":"obeci","brand_slug":"marka","search_term":"обеци"}'},
  {id:3,event_name:"save_product",occurred_at:"2026-08-15T10:02:00Z",anonymous_session_id:"s1",product_id:"p1",product_name:"Обеци",brand_id:"b1",brand_name:"Марка",payload_json:'{"search_term":"обеци"}'},
  {id:4,event_name:"outbound_product_click",occurred_at:"2026-08-15T10:03:00Z",anonymous_session_id:"s1",product_id:"p1",product_name:"Обеци",brand_id:"b1",brand_name:"Марка",payload_json:'{"search_term":"обеци"}'},
  {id:5,event_name:"search",occurred_at:"2026-08-15T11:00:00Z",anonymous_session_id:"s2",search_term:"несъществуващо",search_results_count:0,payload_json:"{}"},
].map(parseEvent).filter(Boolean) as any[];

const search = buildSearchRows(rows);
assert.equal(search.find(row=>row.query==="обеци")?.outbound,1);
assert.equal(search.find(row=>row.query==="несъществуващо")?.zero,1);
const product = buildProductRows(rows)[0];
assert.equal(product.views,1);assert.equal(product.saves,1);assert.equal(product.outbound,1);
const brand = buildBrandRows(rows)[0];assert.equal(brand.productViews,1);assert.equal(brand.productOutbound,1);
const metrics = metricSummary(rows,[]);assert.equal(metrics.find(row=>row.key==="sessions")?.value,2);
const yesterday = resolvePeriod(new URL("https://admin.test/analytics/?period=yesterday"));
assert.equal(yesterday.end.getTime() - yesterday.start.getTime(), 86_400_000);
const custom = resolvePeriod(new URL("https://admin.test/analytics/?period=custom&from=2026-08-01&to=2026-08-03"));
assert.equal(custom.from,"2026-08-01");assert.equal(custom.to,"2026-08-03");
console.log("analytics aggregation tests passed");
