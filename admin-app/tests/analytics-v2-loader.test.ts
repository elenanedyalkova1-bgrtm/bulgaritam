import assert from "node:assert/strict";
import type { AnalyticsEvent } from "../src/lib/analytics";
import type { DiscoveryResultRow, DiscoveryStateRow } from "../src/lib/analytics-derived";
import { loadAnalyticsV2 } from "../src/lib/analytics-v2-loader";

let id=0;
const event=(at:string,eventId:string,journeyId="visitor"):AnalyticsEvent=>({id:++id,eventId,event:"page_view",at:new Date(at),sessionId:`s-${eventId}`,journeyId,productId:"",productName:"",productSlug:"",brandId:"",brandName:"",brandSlug:"",category:"",subcategory:"",productType:"",searchTerm:"",resultCount:0,collectionId:"",sourceContext:"",listContext:"",referrerDomain:"",utmSource:"",utmMedium:"",utmCampaign:"",searchId:"",pagePath:"/",pageType:"home",giftRecipient:"",giftOccasion:"",sequenceNumber:id,acquisitionChannel:"direct",landingPage:"/",discoveryStateId:"",searchRevision:0,payload:{}});
const state=(stateId:string,at:string,count=1):DiscoveryStateRow=>({discovery_state_id:stateId,occurred_at:at,anonymous_session_id:`s-${stateId}`,anonymous_journey_id:"visitor",surface_type:"homepage_default",page_path:"/",result_count:count});
const member=(stateId:string,position=1):DiscoveryResultRow=>({discovery_state_id:stateId,entity_type:"product",product_id:`p${position}`,brand_id:"b",position});

const calls:{events?:[Date,Date];states?:[Date,Date];ids?:string[] }={};
const loaded=await loadAnalyticsV2({
 loadEvents:async(start,end)=>{calls.events=[start,end];return[
  event("2026-01-01T00:00:00Z","lookback"),event("2026-04-01T00:00:00Z","previous"),event("2026-04-08T00:00:00Z","current"),event("2026-04-08T00:00:00Z","current")
 ]},
 loadLookbackEvents:async()=>{throw new Error("single bounded loader must be used")},
 loadDiscoveryStates:async(start,end)=>{calls.states=[start,end];return[state("previous-state","2026-04-01T00:00:00Z"),state("current-state","2026-04-08T00:00:00Z",2),state("current-state","2026-04-08T00:00:00Z",2)]},
 loadDiscoveryResults:async(ids)=>{calls.ids=ids;return[member("previous-state"),member("current-state"),member("current-state")]}
},{previousStart:new Date("2026-04-01T00:00:00Z"),previousEnd:new Date("2026-04-08T00:00:00Z"),start:new Date("2026-04-08T00:00:00Z"),end:new Date("2026-04-15T00:00:00Z")},90);

assert.equal(calls.events?.[0].toISOString(),"2026-01-01T00:00:00.000Z");
assert.equal(calls.events?.[1].toISOString(),"2026-04-15T00:00:00.000Z");
assert.equal(calls.states?.[0].toISOString(),"2026-04-01T00:00:00.000Z");
assert.deepEqual(calls.ids,["previous-state","current-state"],"states are loaded only once");
assert.equal(loaded.currentEvents.length,1,"current range is half-open and deduplicated");
assert.equal(loaded.previousEvents.length,1);
assert.equal(loaded.lookbackEvents.length,1);
assert.equal(loaded.current.summary.completeDiscoveryOpportunities,0,"incomplete state is excluded");
assert.equal(loaded.current.summary.incompleteDiscoveryOpportunities,1);
assert.equal(loaded.previous.summary.completeDiscoveryOpportunities,1);
assert.equal(loaded.meta.membersLoaded,2,"duplicate members are not loaded twice");
assert.equal(loaded.meta.comparisonAvailable,true);
assert.equal(loaded.meta.lookbackAvailable,true);

console.log("Analytics V2 repository wiring tests passed");
