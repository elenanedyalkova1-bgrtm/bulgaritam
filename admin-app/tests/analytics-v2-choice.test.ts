import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import type {AnalyticsEvent} from "../src/lib/analytics";
import type {DiscoveryResultRow,DiscoveryStateRow} from "../src/lib/analytics-derived";
import {buildChoicePresentation,choiceValueLabel,choicesWord,deriveChoiceDomain,normalizeChoiceState,visitorsWord} from "../src/lib/analytics-v2-choice";

let id=0;
const event=(name:string,payload:Record<string,unknown>={},extra:Partial<AnalyticsEvent>={}):AnalyticsEvent=>({id:++id,eventId:`choice-${id}`,event:name,at:new Date(`2026-09-14T10:00:${String(id).padStart(2,"0")}Z`),sessionId:"session-1",journeyId:"visitor-1",productId:"",productName:"",productSlug:"",brandId:"",brandName:"",brandSlug:"",category:"",subcategory:"",productType:"",searchTerm:"",resultCount:0,collectionId:"",sourceContext:"homepage_discovery",listContext:"",referrerDomain:"",utmSource:"",utmMedium:"",utmCampaign:"",searchId:"",pagePath:"/",pageType:"discovery",giftRecipient:"",giftOccasion:"",sequenceNumber:id,acquisitionChannel:"direct",landingPage:"/",discoveryStateId:"",searchRevision:0,payload,...extra});
const state=(stateId:string,at:string,count:number,extra:Partial<DiscoveryStateRow>={}):DiscoveryStateRow=>({discovery_state_id:stateId,occurred_at:at,anonymous_session_id:"session-1",anonymous_journey_id:"visitor-1",surface_type:"category",page_path:"/",result_count:count,active_filters:{},...extra});
const members=(stateId:string,count:number):DiscoveryResultRow[]=>Array.from({length:count},(_,i)=>({discovery_state_id:stateId,entity_type:"product",product_id:`p-${i}`,brand_id:"b",position:i+1}));

const events=[
 event("select_category",{filter_name:"category",filter_value:"clothing",selected_value:"Облекло"}),
 event("select_category",{filter_name:"category",filter_value:"clothing",selected_value:"Облекло"},{journeyId:"visitor-2"}),
 event("select_subcategory",{filter_name:"subcategory",filter_value:"home-textiles",selected_value:"Домашен текстил"}),
 event("select_product_type",{filter_name:"product_type",filter_value:"Спално бельо",selected_value:"Спално бельо"}),
 event("apply_filter",{filter_name:"material",filter_value:"Памук",filter_action:"add"}),
 event("remove_filter",{filter_name:"color",filter_value:"Син",filter_action:"remove"}),
 event("clear_filters",{filter_name:"product_constraints",filter_action:"clear"}),
 event("apply_filter",{filter_name:"gift_budget",filter_value:"0-25",price_range:"0-25"},{sourceContext:"gift_discovery"}),
 event("select_gift_recipient",{filter_name:"recipient",filter_value:"За жена",selected_value:"За жена"}),
 event("select_gift_occasion",{filter_name:"occasion",filter_value:"Рожден ден",selected_value:"Рожден ден"}),
 event("apply_filter",{filter_name:"attribute",filter_value:"Ръчна изработка"},{sourceContext:"gift_discovery"}),
 event("change_sort",{selected_value:"price-asc"}),
 event("open_gift_discovery"),event("surprise_me"),
 event("apply_filter",{filter_name:"unmapped_internal",filter_value:"secret-raw"}),
 event("product_impression",{source_discovery_state_id:"passive"}),
];
const giftState=state("gift", "2026-09-14T10:01:00Z",1,{surface_type:"gift_discovery",price_min_eur:0,price_max_eur:25,gift_recipient:"За жена",gift_occasion:"Рожден ден",active_filters:{gift:["giftable:true","attribute:Ръчна изработка"],materials:["Памук"],colors:["Син"]}});
const normalized=normalizeChoiceState(giftState,members("gift",1));
assert.ok(normalized.facets.some(x=>x.dimension==="recipient"&&x.value==="За жена"));
assert.ok(normalized.facets.some(x=>x.dimension==="occasion"&&x.value==="Рожден ден"));
assert.ok(normalized.facets.some(x=>x.dimension==="price"&&x.value==="0-25"));
assert.ok(normalized.facets.some(x=>x.dimension==="attribute"&&x.value==="Ръчна изработка"));
assert.ok(normalized.facets.some(x=>x.dimension==="material"&&x.value==="Памук"));
assert.ok(normalized.facets.some(x=>x.dimension==="color"&&x.value==="Син"));

const domain=deriveChoiceDomain(events,[giftState],[...members("gift",1)]),presentation=buildChoicePresentation(domain);
assert.equal(domain.actions.length,15,"passive product exposure is not a choice action");
assert.equal(presentation.taxonomy.find(x=>x.value==="clothing")?.actions,2);
assert.equal(presentation.taxonomy.find(x=>x.value==="clothing")?.visitors,2,"visitors deduplicate independently from actions");
assert.ok(presentation.taxonomy.some(x=>x.dimension==="subcategory"));
assert.ok(presentation.taxonomy.some(x=>x.dimension==="product_type"));
assert.ok(presentation.filters.some(x=>x.dimension==="material"));
assert.ok(domain.actions.some(x=>x.action==="remove"&&x.dimension==="color"));
assert.ok(domain.actions.some(x=>x.action==="clear"&&x.dimension==="clear"));
assert.ok(presentation.filters.some(x=>x.action==="remove"&&x.dimension==="color"));
assert.ok(presentation.filters.some(x=>x.action==="clear"&&x.dimension==="clear"));
assert.ok(presentation.gift.some(x=>x.dimension==="price"&&x.value==="0-25"));
assert.ok(presentation.gift.some(x=>x.dimension==="recipient"));
assert.ok(presentation.gift.some(x=>x.dimension==="occasion"));
assert.ok(presentation.gift.some(x=>x.dimension==="attribute"));
assert.ok(!presentation.filters.some(x=>x.dimension==="attribute"&&x.value==="Ръчна изработка"),"gift attributes are not duplicated in the general filter section");
assert.ok(presentation.sort.some(x=>x.value==="price-asc"));
assert.equal(domain.diagnostics.unknownFilterValues,1,"only genuinely unmapped filter names remain diagnostic");
assert.equal(choiceValueLabel("other","secret-raw"),"Друг критерий","unknown raw values never become primary labels");
assert.equal(choiceValueLabel("clear","product_constraints"),"Изчистване на филтри");
assert.equal(choiceValueLabel("giftable","true"),"Подходящо за подарък");
assert.equal(choiceValueLabel("price","0-25"),"До 25 €");
assert.equal(choiceValueLabel("sort","price-asc"),"Цена: от ниска към висока");
assert.equal(choicesWord(1),"избор");assert.equal(choicesWord(2),"избора");assert.equal(visitorsWord(1),"посетител");assert.equal(visitorsWord(2),"посетители");

id=100;
const strictAction=event("apply_filter",{filter_name:"material",filter_value:"Памук",filter_action:"add",results_before:10,results_after:5},{at:new Date("2026-09-14T11:00:01Z")});
const before=state("before","2026-09-14T11:00:00Z",10),after=state("after","2026-09-14T11:00:02Z",5,{active_filters:{material:["Памук"]}});
const strict=deriveChoiceDomain([strictAction],[before,after],[...members("before",10),...members("after",5)]);
assert.equal(strict.transitions.length,1,"one compatible before/action/after chain is accepted");
assert.equal(strict.transitions[0].resultChange,-5);
const ambiguous=deriveChoiceDomain([strictAction],[before,after,state("after-2","2026-09-14T11:00:03Z",5,{active_filters:{material:["Памук"]}})],[]);
assert.equal(ambiguous.transitions.length,0,"multiple matching resulting states are suppressed");
assert.equal(ambiguous.diagnostics.ambiguousTransitionsSuppressed,1);

const direct=deriveChoiceDomain([
 event("view_product",{source_discovery_state_id:"gift",view_stage:"selection_click"}),
 event("view_brand",{source_discovery_state_id:"gift",view_stage:"selection_click"}),
 event("save_product",{source_discovery_state_id:"gift"}),
 event("outbound_product_click",{source_discovery_state_id:"gift"}),
 event("outbound_brand_click",{source_discovery_state_id:"gift"}),
 event("view_product",{last_discovery_state_id:"gift",view_stage:"selection_click"}),
],[giftState],members("gift",1));
assert.equal(direct.outcomes.length,5,"only explicit source-state attribution creates outcomes");
assert.equal(direct.outcomes[0].kind,"product_open");
assert.deepEqual(new Set(direct.outcomes.map(x=>x.kind)),new Set(["product_open","brand_open","saved","product_outbound","brand_outbound"]));
assert.equal(buildChoicePresentation(direct).outcomeCounts.brandOutbound,1);

const component=await readFile(new URL("../src/components/analytics-v2/InterestChoiceIntelligence.astro",import.meta.url),"utf8");
assert.match(component,/Към какво се насочват посетителите\?/);assert.match(component,/Как стесняват избора си\?/);assert.match(component,/Когато търсят подарък/);assert.match(component,/Какво заслужава внимание/);assert.match(component,/Показванията на продукти не се броят като избор/);assert.match(component,/Други начини за стесняване на избора/);assert.match(component,/@media\(max-width:600px\)/);assert.match(component,/max-width:100%/);assert.doesNotMatch(component,/най-популяр|предпочитат|конверси|покупка|продажба|willingness-to-pay/i);assert.doesNotMatch(component,/>\s*(event|payload|canonical state|facet|attribution|qualified impression)\s*</i);
console.log("Analytics V2 Interest & Choice tests passed");
