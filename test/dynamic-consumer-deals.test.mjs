import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { publicDealsPayload } from "../src/lib/public-deal-contract.mjs";
import { deriveDealFacets } from "../src/lib/deal-facets.mjs";

const deal = (id, overrides = {}) => ({ entity_type:"observed_product",entity_id:String(id),title:`Deal ${id}`,brand_id:1,brand:"Brand",image_url:"https://brand.test/image.jpg",current_price:49,regular_price:59,currency:"EUR",discount_percent:16.9492,latest_checked_at:"2026-09-30T08:00:00Z",destination_type:"external",destination_url:`https://brand.test/p/${id}`,outbound_url:`https://brand.test/p/${id}`,internal_slug:null,category:"Category",product_type:"Type",materials:["Cotton"],ingredients:[],search_text:`deal ${id} brand`,promotion_confidence:"EXPLICIT_SALE",regular_price_evidence:"private",...overrides });

test("public deal contract is minimal and strips semantic/debug evidence", () => {
  const payload = publicDealsPayload([deal(1)], new Date("2026-09-30T09:00:00Z"));
  assert.equal(payload.count, 1); assert.equal(payload.deals[0].id, "observed_product:1");
  assert.equal("promotion_confidence" in payload.deals[0], false); assert.equal("regular_price_evidence" in payload.deals[0], false);
  assert.equal(JSON.stringify(payload).includes("private"), false);
});

test("invalid destinations and price pairs fail closed", () => {
  assert.equal(publicDealsPayload([deal(1,{destination_url:"javascript:alert(1)"}),deal(2,{regular_price:40}),deal(3,{discount_percent:Number.NaN}),deal(4,{outbound_url:"https://secret:token@brand.test/p/4"})]).count,0);
});

test("dynamic facets add new values, remove vanished values and never infer empty metadata", () => {
  const first = deriveDealFacets([deal(1, { brand_id: 1, brand: "Alpha", materials: ["Cotton", ""], ingredients: [] })]);
  const refreshed = deriveDealFacets([deal(2, { brand_id: 2, brand: "Beta", materials: ["Linen"], ingredients: ["Rose"] })]);
  assert.deepEqual(first, { brand: [["1", "Alpha"]], material: [["Cotton", "Cotton"]], ingredient: [] });
  assert.deepEqual(refreshed, { brand: [["2", "Beta"]], material: [["Linen", "Linen"]], ingredient: [["Rose", "Rose"]] });
});

test("dynamic page path is feature flagged and keeps static snapshot as fetch failure fallback", () => {
  const page=fs.readFileSync("src/pages/namaleniya/index.astro","utf8"); const client=fs.readFileSync("src/scripts/dynamic-consumer-deals.ts","utf8");
  assert.match(page,/PUBLIC_DYNAMIC_DEALS_ENDPOINT/); assert.match(client,/static-snapshot/); assert.match(client,/bulgaritam:deals-refreshed/);
  assert.match(page,/addEventListener\("bulgaritam:deals-refreshed"/);
  assert.doesNotMatch(client,/BASEROW|GOOGLE_SERVICE|promotion_confidence|regular_price_evidence/);
  assert.match(client,/refreshDealFacetOptions/); assert.match(page,/data-deal-facet-options="brand"/);
});

test("admin endpoint is disabled by default, origin restricted and CDN cached", () => {
  const api=fs.readFileSync("admin-app/src/pages/api/consumer-deals.ts","utf8"); const middleware=fs.readFileSync("admin-app/src/middleware.ts","utf8");
  assert.match(api,/CONSUMER_DEALS_API_ENABLED/); assert.match(api,/s-maxage=600/); assert.match(api,/stale-if-error=86400/); assert.match(api,/ALLOWED_ORIGINS/); assert.match(middleware,/consumer-deals/);
  assert.match(middleware,/preserveCache: true/);
  assert.match(api,/publicPayload/); assert.doesNotMatch(api,/json\(payload, 200/);
  assert.match(api,/CONSUMER_DEALS_SMOKE_TOKEN/); assert.match(api,/Cache-Control": "no-store/);
});
