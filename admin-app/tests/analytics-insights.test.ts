import assert from "node:assert/strict";
import { DEFAULT_INSIGHT_CONFIG, confidenceFor, generateAnalyticsInsights, median, percentile, quartiles, safeRate, type InsightPeriodSnapshot, type ProductInsightMetric } from "../src/lib/analytics-insights";
import { productIdentity } from "../src/lib/analytics-derived";

const cfg={...DEFAULT_INSIGHT_CONFIG,minimumSample:10,minimumOpportunities:10,minimumCohortSize:3,mediumSample:30,highSample:100,materialPercentChange:20,rateLift:.2};
const product=(id:string,brand:string,exposed:number,selected:number,outbound=0):ProductInsightMetric=>({product:productIdentity({productId:id,brandId:brand})!,eligible:Math.max(exposed,20),exposed,selected,outbound,visitors:exposed,cohort:"c"});
const snapshot=(overrides:Partial<InsightPeriodSnapshot>={}):InsightPeriodSnapshot=>({label:"current",products:[],searches:[],surfaces:[],acquisition:[],repeatInterest:{visitors:20,eligibleVisitors:100},...overrides});

assert.equal(safeRate(1,0),null);assert.equal(median([]),null);assert.equal(median([3,1,2]),2);assert.deepEqual(quartiles([1,2,3,4]),{q1:1.75,median:2.5,q3:3.25});assert.equal(percentile(2,[1,2,3,4]),.5);
assert.equal(confidenceFor(1,100,10,cfg),null,"insufficient sample suppresses");

const products=[product("same","a",50,2),product("same","b",20,15,10),product("p3","c",50,30,20),product("p4","d",50,25,10),product("p5","e",50,20,5)];
const current=snapshot({products,searches:[{query:"soap",searches:30,zeroResults:30,medianSupply:0,exposed:0,selected:0,considered:0,outbound:0,visitors:20}],surfaces:[{surface:"related_products",exposures:60,selections:10,visitors:40}],acquisition:[
  {source:"organic",visitors:50,exposures:40,selections:20,considerations:10,outbound:25,returningVisitors:10},
  {source:"direct",visitors:50,exposures:40,selections:10,considerations:5,outbound:5,returningVisitors:5},
  {source:"referral",visitors:50,exposures:40,selections:10,considerations:5,outbound:5,returningVisitors:5},
]});
const previous=snapshot({label:"previous",searches:[{query:"soap",searches:15,zeroResults:15,medianSupply:0,exposed:0,selected:0,considered:0,outbound:0,visitors:10}],surfaces:[{surface:"related_products",exposures:30,selections:8,visitors:25}],repeatInterest:{visitors:10,eligibleVisitors:100}});
const insights=generateAnalyticsInsights(current,previous,cfg);
assert.ok(insights.some(i=>i.type==="trend"&&i.subject.type==="search"),"search movement appears with evidence");
assert.ok(insights.some(i=>i.type==="opportunity"&&i.subject.id==="soap"),"zero-result opportunity appears");
assert.ok(insights.some(i=>i.type==="underperformer"&&i.subject.id===productIdentity({productId:"same",brandId:"a"})!.key),"high exposure/low selection identified");
assert.ok(insights.some(i=>i.type==="hidden_winner"&&i.subject.id===productIdentity({productId:"same",brandId:"b"})!.key),"lower exposure/strong selection identified");
assert.ok(insights.some(i=>i.type==="behavior_change"&&i.subject.type==="surface"));
assert.ok(insights.some(i=>i.type==="acquisition_quality"));
assert.ok(insights.some(i=>i.subject.id==="repeat-interest"));
assert.ok(insights.every(i=>i.confidence&&i.sample&&i.comparisonValue!==undefined));
assert.ok(insights.every(i=>!/(purchase|conversion|Bulgarian consumers|because of)/i.test(i.statement)),"claims avoid purchase, population-wide, and causal language");
assert.equal(new Set(products.slice(0,2).map(p=>p.product.key)).size,2,"same product ID across brands stays independent");

const sparse=generateAnalyticsInsights(snapshot({searches:[{query:"rare",searches:1,zeroResults:1,medianSupply:0,exposed:0,selected:0,considered:0,outbound:0,visitors:1}]}),snapshot(),cfg);
assert.equal(sparse.length,0,"sparse evidence suppresses insights");

const sparseCohort=generateAnalyticsInsights(snapshot({products:[product("x","a",20,20),product("y","b",20,1)]}),snapshot(),cfg);
assert.equal(sparseCohort.length,0,"sparse product cohorts suppress safely");

console.log("Analytics V2 insight engine tests passed");
