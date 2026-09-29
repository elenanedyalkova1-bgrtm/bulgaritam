import assert from "node:assert/strict";
import test from "node:test";
import { buildDealCard, createObservedProductStore, discoverBrandProducts, evaluateDiscounts, extractProductMetadata, historyObservation, matchObservedToCatalog, nextObservedLifecycle, normalizeExternalProductUrl, observedCanonicalKey, observedProductRecord } from "../src/lib/price-monitor/index.mjs";
import fs from "node:fs";

test("bounded discovery prefers product sitemap and rejects listing URLs", async () => {
  const pages = new Map([
    ["https://brand.test", { ok:true,status:200,final_url:"https://brand.test/",body:'<html><a href="/shop/">Shop</a></html>',content_type:"text/html" }],
    ["https://brand.test/robots.txt", { ok:true,status:200,final_url:"https://brand.test/robots.txt",body:"Sitemap: https://brand.test/product-sitemap.xml" }],
    ["https://brand.test/product-sitemap.xml", { ok:true,status:200,final_url:"https://brand.test/product-sitemap.xml",body:"<urlset><url><loc>https://brand.test/shop/</loc></url><url><loc>https://brand.test/product/one/</loc></url></urlset>" }],
  ]);
  const result = await discoverBrandProducts({ brand_id:1,brand_url:"https://brand.test" },{ fetchPage:async(url)=>pages.get(url)||{ok:false,status:404,final_url:url,body:""},maxSitemaps:4 });
  assert.deepEqual(result.candidates.map((x)=>x.normalized_url),["https://brand.test/product/one"]); assert.equal(result.product_sitemap_found,true); assert.ok(result.request_count<=7);
});

test("bounded discovery reports truncation so lifecycle does not mark unseen products missing", async () => {
  const pages = new Map([
    ["https://brand.test", { ok:true,status:200,final_url:"https://brand.test/",body:"",content_type:"text/html" }],
    ["https://brand.test/robots.txt", { ok:true,status:200,final_url:"https://brand.test/robots.txt",body:"Sitemap: https://brand.test/product-sitemap.xml" }],
    ["https://brand.test/product-sitemap.xml", { ok:true,status:200,final_url:"https://brand.test/product-sitemap.xml",body:"<urlset><url><loc>https://brand.test/product/one/</loc></url><url><loc>https://brand.test/product/two/</loc></url></urlset>" }],
  ]);
  const result = await discoverBrandProducts({ brand_id:1,brand_url:"https://brand.test" }, { fetchPage:async(url)=>pages.get(url)||{ok:false,status:404,final_url:url,body:""}, maxProducts:1 });
  assert.equal(result.candidates.length, 1); assert.equal(result.capacity_reached, true);
});

test("custom single-segment shop indexes are rejected as discovery candidates", async () => {
  const result = await discoverBrandProducts({ brand_id: 1, brand_url: "https://brand.test" }, { fetchPage: async (url) => {
    if (url === "https://brand.test") return { ok: true, status: 200, final_url: url, body: '<a href="/brand-shop/">Shop</a>', content_type: "text/html" };
    if (url.endsWith("product-sitemap.xml")) return { ok: true, status: 200, final_url: url, body: "<urlset><url><loc>https://brand.test/brand-shop/</loc></url></urlset>" };
    if (url.endsWith("robots.txt")) return { ok: true, status: 200, final_url: url, body: "Sitemap: https://brand.test/product-sitemap.xml" };
    return { ok: false, status: 404, final_url: url, body: "" };
  } });
  assert.equal(result.candidates.length, 0);
});

test("metadata uses Product JSON-LD deterministically", () => {
  const html='<title>Fallback</title><link rel="canonical" href="https://www.brand.test/product/one/?utm_source=x"><script type="application/ld+json">{"@type":"Product","name":"One","sku":"SKU-1","productID":"P-1","image":"/one.jpg","offers":{"availability":"https://schema.org/InStock"}}</script>';
  assert.deepEqual(extractProductMetadata(html,{url:"https://brand.test/product/one"}),{title:"One",image_url:"https://brand.test/one.jpg",canonical_url:"https://brand.test/product/one",availability:"in_stock",sku:"SKU-1",external_product_id:"P-1",metadata_method:"json_ld_product"});
});

test("observed identity deduplicates tracking parameters and matching never uses title", () => {
  assert.equal(normalizeExternalProductUrl("https://www.brand.test/p/?utm_source=x#z"),"https://brand.test/p"); assert.equal(observedCanonicalKey({brand_id:7,source_url:"https://brand.test/p/"}),"7|https://brand.test/p");
  assert.deepEqual(matchObservedToCatalog({brand_id:7,source_url:"https://brand.test/p/?ref=x",canonical_url:"https://brand.test/p"},[{id:42,brand_id:7,product_url:"https://brand.test/p/",name_bg:"Different"}]),{product_id:42,method:"canonical_url"});
});

test("observed matching resolves the live Baserow brand_ref relation", () => {
  const match = matchObservedToCatalog(
    { brand_id: 43, source_url: "https://brand.test/product/one" },
    [{ id: 900, brand_ref: [{ id: 43, value: "Brand" }], product_url: "https://brand.test/product/one/" }],
  );
  assert.deepEqual(match, { product_id: 900, method: "source_url" });
});

test("legacy and observed history share evaluator without ID collision", () => {
  const base={checked_at:"2026-09-29T10:00:00Z",product_url:"https://brand.test/p",detected_price:49,currency:"EUR",status:"verified",confidence:"high",regular_price:59,regular_price_currency:"EUR",regular_price_method:"json_ld_list_price"};
  const catalog=historyObservation({...base,product_id:"12",product_name:"Catalog",brand_name:"Brand"}); const observed=historyObservation({...base,entity_type:"observed_product",entity_id:"12",product_id:null,product_name:"External",brand_name:"Brand"});
  const out=evaluateDiscounts([catalog,observed],{week_start:"2026-09-29",week_end:"2026-10-06"}); assert.equal(out.length,2); assert.deepEqual(out.map((x)=>x.entity_type).sort(),["catalog_product","observed_product"]);
});

test("external deal card and lifecycle remain conservative", () => {
  const card=buildDealCard({entity_type:"observed_product",entity_id:"o1",weekly_discount_eligible:true,brand:"Brand",current_price:49,regular_price:59,discount_percent:16.95,last_verified_at:"now"},{title:"One",image_url:"https://brand.test/x.jpg",canonical_url:"https://brand.test/p"}); assert.equal(card.destination_label,"Към магазина");
  let state={lifecycle_status:"active",is_active:true}; state={...state,...nextObservedLifecycle(state,"dead_url")}; assert.equal(state.is_active,true); state={...state,...nextObservedLifecycle(state,"dead_url")}; assert.equal(state.lifecycle_status,"recheck"); state={...state,...nextObservedLifecycle(state,"dead_url")}; assert.equal(state.is_active,false); assert.equal(nextObservedLifecycle({lifecycle_status:"active",is_active:true},"blocked").is_active,true);
});

test("observed record retains discovery provenance", () => {
  const row=observedProductRecord({brand_id:1,source_url:"https://brand.test/p",normalized_url:"https://brand.test/p",discovery_method:"product_sitemap",discovery_confidence:"high"},{checked_at:"now",detected_price:10,currency:"EUR",title:"P",image_url:"https://brand.test/p.jpg",status:"verified"},"first"); assert.equal(row.canonical_key,"1|https://brand.test/p"); assert.equal(row.current_price,10);
});

test("Observed Products pagination upgrades Baserow next URLs to HTTPS without losing auth", async () => {
  const calls = [];
  const store = createObservedProductStore({ token: "secret", tableId: "1", fetchImpl: async (url, init) => {
    calls.push({ url, authorization: init.headers.Authorization });
    return { ok: true, json: async () => calls.length === 1 ? { results: [{ id: 1 }], next: "http://api.baserow.io/api/database/rows/table/1/?page=2" } : { results: [{ id: 2 }], next: null } };
  } });
  assert.deepEqual((await store.list()).map((row) => row.id), [1, 2]);
  assert.equal(calls[1].url.startsWith("https://api.baserow.io/"), true);
  assert.equal(calls[1].authorization, "Token secret");
});

test("internal external-deal review exposes semantic confidence without changing the consumer UI", () => {
  const operations = fs.readFileSync("admin-app/src/lib/external-monitoring.ts", "utf8");
  const admin = fs.readFileSync("admin-app/src/pages/external-monitoring.astro", "utf8");
  const consumer = fs.readFileSync("src/components/HomepageProductCard.astro", "utf8");
  assert.match(operations, /reviewCards/);
  assert.match(admin, /promotion_confidence/);
  assert.match(admin, /not consumer eligible/);
  assert.doesNotMatch(consumer, /promotion_confidence|VERIFIED_PRICE_DROP|REFERENCE_VALUE_SAVING/);
});
