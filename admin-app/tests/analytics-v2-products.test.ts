import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import type {AnalyticsEvent} from "../src/lib/analytics";
import {deriveAnalyticsDomain,type DiscoveryResultRow,type DiscoveryStateRow} from "../src/lib/analytics-derived";
import type {AnalyticsV2Load} from "../src/lib/analytics-v2-loader";
import {buildProductPresentation,filterProductRows,productHasExplicitFollowUp,sortProductRows} from "../src/lib/analytics-v2-products";

let nextId=0;
const event=(name:string,extra:Partial<AnalyticsEvent>={}):AnalyticsEvent=>({id:++nextId,eventId:`product-${nextId}`,event:name,at:new Date(`2026-09-14T10:${String(Math.floor(nextId/60)).padStart(2,"0")}:${String(nextId%60).padStart(2,"0")}Z`),sessionId:"s1",journeyId:"v1",productId:"p1",productName:"Продукт 1",productSlug:"product-1",brandId:"b1",brandName:"Бранд 1",brandSlug:"brand-1",category:"Категория",subcategory:"Подкатегория",productType:"Тип",searchTerm:"",resultCount:0,collectionId:"",sourceContext:"",listContext:"",referrerDomain:"",utmSource:"",utmMedium:"",utmCampaign:"",searchId:"",pagePath:"/",pageType:"discovery",giftRecipient:"",giftOccasion:"",sequenceNumber:nextId,acquisitionChannel:"direct",landingPage:"/",discoveryStateId:"",searchRevision:0,payload:{},...extra});
const state=(id:string,visitor="v1"):DiscoveryStateRow=>({discovery_state_id:id,occurred_at:"2026-09-14T10:00:00Z",anonymous_session_id:`s-${id}`,anonymous_journey_id:visitor,surface_type:"search_results",page_path:"/search/",search_id:`q-${id}`,query:"сапун",category:"Категория",subcategory:"Подкатегория",product_type:"Тип",result_count:1});
const member=(id:string,productId="p1",brandId="b1"):DiscoveryResultRow=>({discovery_state_id:id,entity_type:"product",product_id:productId,brand_id:brandId,position:1});
const load=(events:AnalyticsEvent[],states:DiscoveryStateRow[]=[],members:DiscoveryResultRow[]=[],previousEvents:AnalyticsEvent[]=[]):AnalyticsV2Load=>{const current=deriveAnalyticsDomain(events,states,members,{periodStart:new Date("2026-09-14"),lookbackEvents:previousEvents});return{current,previous:deriveAnalyticsDomain(previousEvents),currentEvents:events,previousEvents,lookbackEvents:[],insights:[],meta:{start:new Date("2026-09-14"),end:new Date("2026-09-15"),previousStart:new Date("2026-09-13"),previousEnd:new Date("2026-09-14"),lookbackStart:new Date("2026-06-15"),comparisonAvailable:Boolean(previousEvents.length),lookbackAvailable:true,eventsLoaded:events.length+previousEvents.length,statesLoaded:states.length,membersLoaded:members.length}}};

const direct={source_surface:"search_results",source_discovery_state_id:"d1",source_search_id:"q-d1",source_position:1};
const baseEvents=[event("product_impression",{payload:direct}),event("view_product",{payload:{...direct,view_stage:"selection_click"}}),event("view_product",{payload:{view_stage:"page_load",source_surface:"product_page"},acquisitionChannel:"organic"}),event("save_product"),event("add_to_collection"),event("remove_from_collection"),event("share_product"),event("outbound_product_click")];
const base=buildProductPresentation(load(baseEvents,[state("d1")],[member("d1")])),row=base.rows.find(item=>item.key==="p1::b1")!;
assert.equal(row.eligible,1);assert.equal(row.verifiedQualifiedViews,1);assert.equal(row.opened,1);assert.equal(row.pageViews,1);assert.equal(row.landingPageViews,0,"same-session page load may retain discovery sequence context");
assert.equal(row.saves,1);assert.equal(row.collectionAdds,1);assert.equal(row.collectionRemoves,1);assert.equal(row.shares,1,"consideration events stay separate");assert.equal(row.outbound,1);
assert.notEqual(buildProductPresentation(load([event("product_impression",{productId:"same",brandId:"a"}),event("product_impression",{productId:"same",brandId:"b"})])).rows[0].key,buildProductPresentation(load([event("product_impression",{productId:"same",brandId:"a"}),event("product_impression",{productId:"same",brandId:"b"})])).rows[1].key);

const unmatched=buildProductPresentation(load([event("product_impression",{payload:{...direct,source_position:2}})],[state("d1")],[member("d1")]));
assert.equal(unmatched.diagnostics.unmatchedCanonicalImpressions,1);assert.equal(unmatched.diagnostics.verifiedCanonicalImpressions,0);assert.equal(unmatched.rows[0].verifiedQualifiedViews,0,"wrong canonical position is excluded from opportunity rates");
const noncanonical=buildProductPresentation(load([event("product_impression",{payload:{source_surface:"related_products"}})]));assert.equal(noncanonical.rows[0].eligible,0,"noncanonical surfaces get no fake denominator");
const missingBrand=buildProductPresentation(load([event("outbound_product_click",{brandId:"",brandSlug:""})]));assert.equal(missingBrand.summary.outboundProducts,0,"ambiguous product identity is not product-attributed outbound");assert.equal(missingBrand.peerComparisons.length,0);

const oldExplicit=event("view_product",{sessionId:"old",at:new Date("2026-09-13T10:00:00Z"),payload:{view_stage:"page_load"}}),newExplicit=event("view_product",{sessionId:"new",at:new Date("2026-09-14T11:00:00Z"),payload:{view_stage:"page_load"}}),sameSession=event("view_product",{sessionId:"new",at:new Date("2026-09-14T11:01:00Z"),payload:{view_stage:"page_load"}});
assert.equal(buildProductPresentation(load([newExplicit,sameSession],[],[],[oldExplicit])).rows[0].repeatExplicitVisitors,1,"explicit interaction in another session is distinct");
assert.equal(buildProductPresentation(load([newExplicit,sameSession])).rows[0].repeatExplicitVisitors,0,"same-session repetition is excluded");
const broadRepeatOnly=buildProductPresentation(load([event("product_impression",{sessionId:"repeat-a"}),event("product_impression",{sessionId:"repeat-b"})])).rows[0];
assert.equal(broadRepeatOnly.repeatObservedVisitors,1);assert.equal(productHasExplicitFollowUp(broadRepeatOnly),false,"broad repeat observation alone is not a deeper action");
for(const name of ["view_product","save_product","add_to_collection","share_product","outbound_product_click"]){const payload=name==="view_product"?{view_stage:"page_load"}:{};const candidate=buildProductPresentation(load([event(name,{payload})])).rows[0];assert.equal(productHasExplicitFollowUp(candidate),true,`${name} qualifies as an explicit follow-up`)}
const strictRepeat=buildProductPresentation(load([newExplicit],[],[],[oldExplicit])).rows[0];assert.equal(productHasExplicitFollowUp(strictRepeat),true,"strict cross-session explicit repeat qualifies");

const peerStates:DiscoveryStateRow[]=[],peerMembers:DiscoveryResultRow[]=[],peerEvents:AnalyticsEvent[]=[];
for(let product=1;product<=6;product++)for(let exposure=0;exposure<20;exposure++){const id=`peer-${product}-${exposure}`,visitor=`pv-${exposure%10}`,session=`ps-${product}-${exposure}`;peerStates.push({...state(id,visitor),anonymous_session_id:session});peerMembers.push(member(id,`pp${product}`,`bb${product}`));const ctx={source_surface:"search_results",source_discovery_state_id:id,source_position:1};peerEvents.push(event("product_impression",{productId:`pp${product}`,brandId:`bb${product}`,productName:`Peer ${product}`,journeyId:visitor,sessionId:session,payload:ctx}));if(product===1&&exposure<10)peerEvents.push(event("view_product",{productId:"pp1",brandId:"bb1",productName:"Peer 1",journeyId:visitor,sessionId:session,payload:{...ctx,view_stage:"selection_click"}}))}
const peer=buildProductPresentation(load(peerEvents,peerStates,peerMembers)),comparison=peer.peerComparisons.find(item=>item.product.key==="pp1::bb1")!;
assert.ok(comparison);assert.equal(comparison.peerCount,5);assert.equal(comparison.fallbackLevel,0);assert.equal(comparison.confidence,"LOW");assert.equal(comparison.eligible,true,"approved gates allow a sufficiently sampled sliced comparison");
const focalSlice=peer.rows.find(item=>item.key==="pp1::bb1")!.peerComparisons[0];assert.ok(!focalSlice.cohort.includes("pp1"),"comparison definition contains no focal baseline data");
assert.equal(base.peerComparisons.length,0);assert.match(base.peerNote,/няма продукт с достатъчно сравними показвания/);

const explorerRows=[row,{...row,key:"p2::b2",name:"Друг продукт",brand:"Друга марка",qualifiedViews:0,visitors:0,opened:0,pageViews:0,saves:0,outbound:0}];
assert.equal(sortProductRows(explorerRows,"outbound","desc")[0].key,row.key,"descending factual sort");
assert.equal(sortProductRows(explorerRows,"outbound","asc")[0].key,"p2::b2","ascending sort keeps zero values");
assert.equal(filterProductRows(explorerRows,"продукт 1")[0].key,row.key,"product-name search");
assert.equal(filterProductRows(explorerRows,"друга марка")[0].key,"p2::b2","brand-name search");
assert.deepEqual(new Set(sortProductRows(explorerRows,"visitors","desc").map(item=>item.key)),new Set(["p1::b1","p2::b2"]),"sorting preserves composite identities and calculations");
assert.equal(filterProductRows(explorerRows,"").length,2,"zero rows remain available without a query");

const component=await readFile(new URL("../src/components/analytics-v2/ProductIntelligence.astro",import.meta.url),"utf8"),detail=await readFile(new URL("../src/components/analytics-v2/ProductIntelligenceDetail.astro",import.meta.url),"utf8");
assert.match(component,/Какво се случи/);assert.match(component,/Директно от резултатите са били отворени/);assert.match(component,/не означават, че едното действие е последвало другото/);assert.match(component,/Кои продукти са били виждани най-често/);assert.match(component,/Кои от видените продукти са били отворени/);assert.match(component,/При кои продукти има следващо действие/);assert.doesNotMatch(component,/Кои продукти все още нямат достатъчно видимост/);assert.doesNotMatch(component,/repeatObservedVisitors>0&&<li>/,"broad repeat is not rendered as deeper-action evidence");
assert.match(detail,/Този продукт е имал/);assert.match(detail,/Най-често е присъствал/);assert.doesNotMatch(detail,/затова/);assert.match(detail,/<details class="evidence">/);assert.match(detail,/Виж подробните данни/);assert.match(detail,/Повторна видимост\/действие/);assert.match(detail,/Входни посещения на продуктовата страница/);
assert.match(component,/data-product-search/);assert.match(component,/data-sort-key/);assert.match(component,/aria-sort/);assert.match(component,/<section class="product-section all-products"[^]*?<details>/,"product explorer remains collapsed by default");assert.match(component,/overflow-x:auto/);
assert.doesNotMatch(`${component}\n${detail}`,/най-доб|най-слаб|победител|губещ|конверси|покуп|продажб|лоял/i);assert.doesNotMatch(`${component}\n${detail}`,/anonymous_session|anonymous_journey|visitorId|timeline/i);assert.match(component,/@media\(max-width:600px\)/);
console.log("Analytics V2 Product Intelligence tests passed");
