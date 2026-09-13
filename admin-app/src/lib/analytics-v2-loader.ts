import type { AnalyticsEvent } from "./analytics";
import { deriveAnalyticsDomain, type AnalyticsDerivedSource, type DerivedAnalyticsDomain, type DiscoveryResultRow, type DiscoveryStateRow } from "./analytics-derived";
import { buildInsightSnapshot, generateAnalyticsInsights, type AnalyticsInsight } from "./analytics-insights";

const DAY=86_400_000;
const inRange=(at:Date,start:Date,end:Date)=>at>=start&&at<end;
const eventKey=(e:AnalyticsEvent)=>e.eventId||`legacy:${e.id}:${e.at.toISOString()}`;
const resultKey=(r:DiscoveryResultRow)=>`${r.discovery_state_id}:${r.entity_type}:${r.product_id||""}:${r.brand_id||""}:${r.position}`;
const uniqueBy=<T>(rows:T[],key:(row:T)=>string)=>[...new Map(rows.map(row=>[key(row),row])).values()];

export type AnalyticsV2Period={start:Date;end:Date;previousStart:Date;previousEnd:Date};
export type AnalyticsV2Load={current:DerivedAnalyticsDomain;previous:DerivedAnalyticsDomain;currentEvents:AnalyticsEvent[];previousEvents:AnalyticsEvent[];lookbackEvents:AnalyticsEvent[];insights:AnalyticsInsight[];meta:{start:Date;end:Date;previousStart:Date;previousEnd:Date;lookbackStart:Date;comparisonAvailable:boolean;lookbackAvailable:boolean;eventsLoaded:number;statesLoaded:number;membersLoaded:number}};

export async function loadAnalyticsV2(source:AnalyticsDerivedSource,period:AnalyticsV2Period,lookbackDays=90):Promise<AnalyticsV2Load>{
 if(period.start>=period.end||period.previousStart>=period.previousEnd||period.previousEnd.getTime()!==period.start.getTime())throw new Error("Analytics V2 requires adjacent valid current and comparison periods.");
 const lookbackStart=new Date(period.previousStart.getTime()-Math.max(1,lookbackDays)*DAY);
 const [allEvents,states]=await Promise.all([source.loadEvents(lookbackStart,period.end),source.loadDiscoveryStates(period.previousStart,period.end)]);
 const cleanEvents=uniqueBy(allEvents,eventKey),cleanStates=uniqueBy(states,s=>s.discovery_state_id),members=uniqueBy(await source.loadDiscoveryResults(cleanStates.map(s=>s.discovery_state_id)),resultKey);
 const lookbackEvents=cleanEvents.filter(e=>inRange(e.at,lookbackStart,period.previousStart)),currentEvents=cleanEvents.filter(e=>inRange(e.at,period.start,period.end)),previousEvents=cleanEvents.filter(e=>inRange(e.at,period.previousStart,period.previousEnd));
 const currentStates=cleanStates.filter(s=>inRange(new Date(s.occurred_at),period.start,period.end)),previousStates=cleanStates.filter(s=>inRange(new Date(s.occurred_at),period.previousStart,period.previousEnd));
 const stateResults=(ss:DiscoveryStateRow[])=>{const ids=new Set(ss.map(s=>s.discovery_state_id));return members.filter(r=>ids.has(r.discovery_state_id))};
 const current=deriveAnalyticsDomain(currentEvents,currentStates,stateResults(currentStates),{periodStart:period.start,lookbackEvents:cleanEvents.filter(e=>inRange(e.at,lookbackStart,period.start))});
 const previous=deriveAnalyticsDomain(previousEvents,previousStates,stateResults(previousStates),{periodStart:period.previousStart,lookbackEvents:cleanEvents.filter(e=>inRange(e.at,lookbackStart,period.previousStart))});
 const comparisonAvailable=previousEvents.length>0||previousStates.length>0;
 return{current,previous,currentEvents,previousEvents,lookbackEvents,insights:comparisonAvailable?generateAnalyticsInsights(buildInsightSnapshot(current,"current"),buildInsightSnapshot(previous,"previous")):[],meta:{...period,lookbackStart,comparisonAvailable,lookbackAvailable:true,eventsLoaded:cleanEvents.length,statesLoaded:cleanStates.length,membersLoaded:members.length}};
}
