import assert from "node:assert/strict";
import { deriveAnalyticsDomain, loadDerivedAnalytics, productIdentity, type DiscoveryResultRow, type DiscoveryStateRow } from "../src/lib/analytics-derived";
import type { AnalyticsEvent } from "../src/lib/analytics";

let id = 0;
const event = (name: string, overrides: Partial<AnalyticsEvent> & { payload?: Record<string, unknown> } = {}): AnalyticsEvent => ({
  id: ++id, eventId: `e-${id}`, event: name, at: new Date(`2026-09-01T10:00:${String(id).padStart(2,"0")}Z`),
  sessionId: "s1", journeyId: "v1", productId: "p1", productName: "One", productSlug: "one",
  brandId: "b1", brandName: "Brand One", brandSlug: "brand-one", category: "cat", subcategory: "", productType: "",
  searchTerm: "soap", resultCount: 2, collectionId: "", sourceContext: "", listContext: "", referrerDomain: "",
  utmSource: "", utmMedium: "", utmCampaign: "", searchId: "q1", pagePath: "/", pageType: "home",
  giftRecipient: "", giftOccasion: "", sequenceNumber: id, acquisitionChannel: "direct", landingPage: "/",
  discoveryStateId: "d1", searchRevision: 1, payload: {}, ...overrides,
});
const state = (overrides: Partial<DiscoveryStateRow> = {}): DiscoveryStateRow => ({ discovery_state_id:"d1",occurred_at:"2026-09-01T10:00:00Z",anonymous_session_id:"s1",anonymous_journey_id:"v1",surface_type:"search_results",page_path:"/",search_id:"q1",query:"soap",result_count:2,...overrides });
const members: DiscoveryResultRow[] = [
  { discovery_state_id:"d1",entity_type:"product",product_id:"p1",brand_id:"b1",position:1 },
  { discovery_state_id:"d1",entity_type:"product",product_id:"p2",brand_id:"b2",position:2 },
];

const normal = deriveAnalyticsDomain([
  event("product_impression",{payload:{source_surface:"search_results",source_discovery_state_id:"d1",source_search_id:"q1",source_position:1}}),
  event("product_impression",{eventId:"e-repeat",payload:{source_surface:"search_results",source_discovery_state_id:"d1",source_search_id:"q1",source_position:1}}),
  event("view_product",{payload:{view_stage:"selection_click",source_surface:"search_results",source_discovery_state_id:"d1",source_search_id:"q1",source_position:1,last_discovery_state_id:"old"}}),
  event("view_product",{payload:{view_stage:"page_load",source_surface:"product_page"}}),
  event("save_product",{payload:{source_surface:"product_page"}}),
  event("outbound_product_click",{payload:{source_surface:"product_page"}}),
  event("outbound_brand_click",{productId:"",productSlug:"",payload:{source_surface:"brand_page"}}),
], [state()], members);

assert.equal(normal.summary.uniqueVisitors,1);
assert.equal(normal.summary.sessions,1);
assert.equal(normal.summary.canonicalDiscoveryOpportunities,1);
assert.equal(normal.summary.eligibleProductOpportunities,2);
assert.equal(normal.summary.qualifiedProductExposures,2,"raw distinct impression events remain countable");
assert.equal(normal.summary.productSelections,1);
assert.equal(normal.summary.productPageViews,1);
assert.equal(normal.summary.considerationActions,1);
assert.equal(normal.summary.productOutboundIntents,1);
assert.equal(normal.summary.brandOutboundIntents,1);
const p1=normal.productFunnel.find(row=>row.product.productId==="p1")!;
assert.equal(p1.eligible,1); assert.equal(p1.exposed,1,"opportunity-normalized repeated impressions deduplicate");
assert.equal(p1.selectionRate,1); assert.equal(p1.pageViewRate,1); assert.equal(p1.considerationRate,1); assert.equal(p1.outboundRate,1);
assert.equal(normal.productFunnel.find(row=>row.product.productId==="p2")!.exposed,0,"eligible but unexposed remains represented");
assert.equal(normal.searchEpisodes[0].successLevel,4);
assert.equal(normal.productSelections[0].directSurface,"search_results");
assert.equal(normal.productSelections[0].influencedStateId,"old","stale last state is preserved separately");

const sameIdDifferentBrands = deriveAnalyticsDomain([
  event("product_impression",{productId:"shared",brandId:"a",brandSlug:"a"}),
  event("product_impression",{productId:"shared",brandId:"b",brandSlug:"b"}),
]);
assert.equal(sameIdDifferentBrands.productFunnel.length,2,"composite product identity separates brands");
assert.notEqual(productIdentity({productId:"shared",brandId:"a"})!.key,productIdentity({productId:"shared",brandId:"b"})!.key);

const returning = deriveAnalyticsDomain([
  event("page_view"),
  event("view_product",{sessionId:"s2",at:new Date("2026-09-02T10:00:00Z"),payload:{view_stage:"page_load"}}),
  event("view_product",{sessionId:"s2",at:new Date("2026-09-02T10:00:01Z"),payload:{view_stage:"page_load"}}),
  event("view_product",{sessionId:"s2",at:new Date("2026-09-02T10:00:02Z"),payload:{}}),
]);
assert.equal(returning.summary.returningAnonymousVisitors,1);
assert.equal(returning.productPageViews.length,2,"repeated page loads remain raw facts");
assert.equal(returning.legacyUndifferentiatedProductViews.length,1,"legacy views are retained conservatively");

const reformulation = deriveAnalyticsDomain([], [
  state({discovery_state_id:"q-a",query:"soap",search_id:"qa",result_count:0}),
  state({discovery_state_id:"q-b",occurred_at:"2026-09-01T10:01:00Z",query:"natural soap",search_id:"qb",result_count:3}),
], []);
assert.equal(reformulation.searchEpisodes[0].resultCount,0);
assert.equal(reformulation.searchEpisodes[0].reformulationCandidate,true);

const related = deriveAnalyticsDomain([
  event("view_product",{payload:{view_stage:"selection_click",source_surface:"related_products",origin_product_id:"origin",last_discovery_state_id:"stale-search"}}),
  event("product_impression",{collectionId:"safe",payload:{source_surface:"named_collection",source_position:3}}),
]);
assert.equal(related.productSelections[0].directSurface,"related_products");
assert.equal(related.productSelections[0].influencedStateId,"stale-search");
assert.equal(related.surfaces.find(s=>s.surface==="named_collection")!.exposed,1);

let calls:string[]=[];
const loaded=await loadDerivedAnalytics({
  async loadEvents(){calls.push("events");return [event("page_view")]},
  async loadDiscoveryStates(){calls.push("states");return [state()]},
  async loadDiscoveryResults(ids){calls.push(`results:${ids.join(",")}`);return members},
},new Date("2026-09-01"),new Date("2026-09-02"));
assert.equal(loaded.summary.eligibleProductOpportunities,2);
assert.deepEqual(calls,["events","states","results:d1"],"repository data is loaded once before metrics derive");

console.log("Analytics V2 derived domain tests passed");
