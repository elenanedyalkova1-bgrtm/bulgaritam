import type { DerivedAnalyticsDomain, ProductIdentity } from "./analytics-derived";

export type InsightType = "trend" | "anomaly" | "opportunity" | "hidden_winner" | "underperformer" | "friction" | "behavior_change" | "acquisition_quality";
export type InsightConfidence = "LOW" | "MEDIUM" | "HIGH";

export type AnalyticsInsight = {
  type: InsightType;
  subject: { type: "search" | "product" | "surface" | "acquisition" | "platform"; id: string; label?: string };
  statement: string;
  currentValue: number;
  comparisonValue: number | null;
  magnitude: { absolute: number | null; percent: number | null };
  sample: { events: number; visitors?: number; opportunities?: number; cohortSize?: number };
  confidence: InsightConfidence;
  evidence: Array<{ metric: string; value: number; unit?: string }>;
  caveats: string[];
  suggestedAction?: string;
  drilldown: Record<string, string | number | boolean | null>;
};

export type ProductInsightMetric = {
  product: ProductIdentity;
  eligible: number;
  exposed: number;
  selected: number;
  outbound: number;
  visitors: number;
  cohort: string;
};
export type SearchInsightMetric = { query: string; searches: number; zeroResults: number; medianSupply: number; exposed: number; selected: number; considered: number; outbound: number; visitors: number };
export type SurfaceInsightMetric = { surface: string; exposures: number; selections: number; visitors: number };
export type AcquisitionInsightMetric = { source: string; visitors: number; exposures: number; selections: number; considerations: number; outbound: number; returningVisitors: number };
export type InsightPeriodSnapshot = {
  label: string;
  products: ProductInsightMetric[];
  searches: SearchInsightMetric[];
  surfaces: SurfaceInsightMetric[];
  acquisition: AcquisitionInsightMetric[];
  repeatInterest: { visitors: number; eligibleVisitors: number };
};

export type InsightEngineConfig = {
  minimumSample: number;
  minimumOpportunities: number;
  minimumCohortSize: number;
  mediumSample: number;
  highSample: number;
  materialPercentChange: number;
  thinSupplyMax: number;
  rateLift: number;
};

// Provisional and intentionally centralized. Review against observed distributions before production labels.
export const DEFAULT_INSIGHT_CONFIG: InsightEngineConfig = {
  minimumSample: 20,
  minimumOpportunities: 20,
  minimumCohortSize: 5,
  mediumSample: 50,
  highSample: 200,
  materialPercentChange: 20,
  thinSupplyMax: 3,
  rateLift: 0.25,
};

export const safeRate = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : null;
export const absoluteChange = (current: number, previous: number) => current - previous;
export const percentageChange = (current: number, previous: number) => previous === 0 ? null : ((current - previous) / previous) * 100;
export const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b)=>a-b), middle = Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
};
export const quantile = (values: number[], q: number) => {
  if (!values.length) return null;
  const sorted=[...values].sort((a,b)=>a-b), position=(sorted.length-1)*Math.min(1,Math.max(0,q));
  const lower=Math.floor(position), upper=Math.ceil(position), weight=position-lower;
  return sorted[lower]*(1-weight)+sorted[upper]*weight;
};
export const quartiles = (values:number[]) => ({ q1:quantile(values,.25), median:quantile(values,.5), q3:quantile(values,.75) });
export const percentile = (value:number,values:number[]) => values.length ? values.filter(v=>v<=value).length/values.length : null;

export function confidenceFor(sample: number, opportunities: number, cohortSize: number, config = DEFAULT_INSIGHT_CONFIG): InsightConfidence | null {
  if (sample < config.minimumSample || opportunities < config.minimumOpportunities || cohortSize < config.minimumCohortSize) return null;
  if (sample >= config.highSample && opportunities >= config.highSample && cohortSize >= config.minimumCohortSize * 2) return "HIGH";
  return sample >= config.mediumSample && opportunities >= config.mediumSample ? "MEDIUM" : "LOW";
}

const magnitude = (current:number,previous:number|null) => ({ absolute:previous==null?null:absoluteChange(current,previous), percent:previous==null?null:percentageChange(current,previous) });
const caveat = "Observed behavior among consenting Bulgaritam browsers; correlation does not establish causality.";
const pct = (rate:number) => `${(rate*100).toFixed(1)}%`;

export function buildInsightSnapshot(domain: DerivedAnalyticsDomain, label: string): InsightPeriodSnapshot {
  const products = domain.productFunnel.map(row => ({ product:row.product,eligible:row.eligible,exposed:row.exposed,selected:row.selected,outbound:row.outbound,visitors:row.uniqueVisitors,cohort:"all-products" }));
  const searchMap=new Map<string,typeof domain.searchEpisodes>();
  domain.searchEpisodes.forEach(row=>searchMap.set(row.query,[...(searchMap.get(row.query)||[]),row]));
  const searches=[...searchMap.entries()].map(([query,rows])=>({query,searches:rows.length,zeroResults:rows.filter(r=>r.resultCount===0).length,medianSupply:median(rows.map(r=>r.resultCount))||0,exposed:rows.reduce((n,r)=>n+r.exposed,0),selected:rows.reduce((n,r)=>n+r.selected,0),considered:rows.reduce((n,r)=>n+r.considered,0),outbound:rows.reduce((n,r)=>n+r.outbound,0),visitors:new Set(rows.map(r=>r.visitorId).filter(Boolean)).size}));
  const surfaces = domain.surfaces.map(row=>({surface:row.surface,exposures:row.exposed,selections:row.selected,visitors:new Set(domain.productExposures.filter(f=>f.directSurface===row.surface).map(f=>f.visitorId).filter(Boolean)).size}));
  const acquisitionRows=new Map<string,{visitors:Set<string>;exposures:number;selections:number;considerations:number;outbound:number}>();
  const addAcquisition=(facts:typeof domain.productExposures,key:"exposures"|"selections"|"considerations"|"outbound")=>facts.forEach(fact=>{const source=fact.event.acquisitionChannel||"unknown",row=acquisitionRows.get(source)||{visitors:new Set<string>(),exposures:0,selections:0,considerations:0,outbound:0};if(fact.visitorId)row.visitors.add(fact.visitorId);row[key]+=1;acquisitionRows.set(source,row)});
  addAcquisition(domain.productExposures,"exposures");addAcquisition(domain.productSelections,"selections");addAcquisition(domain.considerationActions,"considerations");addAcquisition(domain.productOutboundIntents,"outbound");
  const returning=new Set(domain.visitors.filter(v=>v.returning).map(v=>v.id));
  const acquisition=[...acquisitionRows.entries()].map(([source,row])=>({source,visitors:row.visitors.size,exposures:row.exposures,selections:row.selections,considerations:row.considerations,outbound:row.outbound,returningVisitors:[...row.visitors].filter(v=>returning.has(v)).length}));
  return { label, products, searches, surfaces, acquisition, repeatInterest:{visitors:domain.summary.returningAnonymousVisitors,eligibleVisitors:domain.summary.uniqueVisitors} };
}

export function generateAnalyticsInsights(current: InsightPeriodSnapshot, previous: InsightPeriodSnapshot, config: InsightEngineConfig = DEFAULT_INSIGHT_CONFIG): AnalyticsInsight[] {
  const insights:AnalyticsInsight[]=[];
  const add=(insight:AnalyticsInsight)=>{if(!/purchase|conversion|Bulgarian consumers|because of/i.test(insight.statement))insights.push(insight)};

  for(const row of current.searches){
    const old=previous.searches.find(x=>x.query===row.query), opportunities=row.searches, sample=row.searches;
    if(old){const change=percentageChange(row.searches,old.searches), confidence=confidenceFor(sample,opportunities,Math.max(current.searches.length,config.minimumCohortSize),config);
      if(confidence&&change!=null&&Math.abs(change)>=config.materialPercentChange)add({type:"trend",subject:{type:"search",id:row.query,label:row.query},statement:`Search activity for “${row.query}” changed ${Math.abs(change).toFixed(1)}% versus the previous equivalent period among Bulgaritam users.`,currentValue:row.searches,comparisonValue:old.searches,magnitude:magnitude(row.searches,old.searches),sample:{events:sample,visitors:row.visitors,opportunities,cohortSize:current.searches.length},confidence,evidence:[{metric:"searches",value:row.searches}],caveats:[caveat],suggestedAction:"Review the query's result set and downstream engagement.",drilldown:{query:row.query,period:current.label}})}
    const opportunityConfidence=confidenceFor(sample,opportunities,Math.max(current.searches.length,config.minimumCohortSize),config);
    if(opportunityConfidence&&(row.zeroResults>0||row.medianSupply<=config.thinSupplyMax))add({type:"opportunity",subject:{type:"search",id:row.query,label:row.query},statement:row.zeroResults?`Searches for “${row.query}” produced zero results in observed Bulgaritam activity.`:`Searches for “${row.query}” had a thin observed result set.`,currentValue:row.medianSupply,comparisonValue:null,magnitude:magnitude(row.medianSupply,null),sample:{events:sample,visitors:row.visitors,opportunities,cohortSize:current.searches.length},confidence:opportunityConfidence,evidence:[{metric:"searches",value:row.searches},{metric:"median_supply",value:row.medianSupply},{metric:"zero_results",value:row.zeroResults}],caveats:[caveat,"Thin-supply threshold is provisional and configurable."],suggestedAction:"Inspect catalogue coverage for this observed query.",drilldown:{query:row.query}})
  }

  const cohorts=new Map<string,ProductInsightMetric[]>(); current.products.forEach(p=>cohorts.set(p.cohort,[...(cohorts.get(p.cohort)||[]),p]));
  for(const row of current.products){
    const peers=cohorts.get(row.cohort)||[], rates=peers.map(p=>safeRate(p.selected,p.exposed)).filter((v):v is number=>v!=null), exposureMedian=median(peers.map(p=>p.exposed));
    const rate=safeRate(row.selected,row.exposed), peerMedian=median(rates), confidence=confidenceFor(row.exposed,row.eligible,peers.length,config);
    if(!confidence||rate==null||peerMedian==null||exposureMedian==null)continue;
    const common={subject:{type:"product" as const,id:row.product.key},sample:{events:row.exposed,visitors:row.visitors,opportunities:row.eligible,cohortSize:peers.length},confidence,evidence:[{metric:"selection_rate",value:rate,unit:"ratio"},{metric:"cohort_median",value:peerMedian,unit:"ratio"}],caveats:[caveat],drilldown:{cohort:row.cohort,product_id:row.product.productId,brand_id:row.product.brandId}};
    if(row.exposed>=exposureMedian&&rate<peerMedian*(1-config.rateLift))add({type:"underperformer",...common,statement:`This product's observed selection rate (${pct(rate)}) was below its comparable cohort median (${pct(peerMedian)}).`,currentValue:rate,comparisonValue:peerMedian,magnitude:magnitude(rate,peerMedian),suggestedAction:"Review card presentation and position-stratified performance."});
    if(row.exposed<exposureMedian&&rate>peerMedian*(1+config.rateLift))add({type:"hidden_winner",...common,statement:`This product had lower observed exposure but a stronger selection rate (${pct(rate)}) than its comparable cohort median (${pct(peerMedian)}).`,currentValue:rate,comparisonValue:peerMedian,magnitude:magnitude(rate,peerMedian),suggestedAction:"Test additional comparable exposure before drawing a broader conclusion."});
    const outboundRate=safeRate(row.outbound,row.exposed), cohortOutbound=median(peers.map(p=>safeRate(p.outbound,p.exposed)).filter((v):v is number=>v!=null));
    if(outboundRate!=null&&cohortOutbound!=null&&outboundRate>cohortOutbound*(1+config.rateLift))add({type:"trend",...common,statement:`This product's observed outbound-intent rate (${pct(outboundRate)}) was above its comparable cohort median (${pct(cohortOutbound)}).`,currentValue:outboundRate,comparisonValue:cohortOutbound,magnitude:magnitude(outboundRate,cohortOutbound),evidence:[{metric:"outbound_intent_rate",value:outboundRate},{metric:"cohort_median",value:cohortOutbound}],suggestedAction:"Inspect the contexts producing merchant-directed intent."});
  }

  for(const row of current.surfaces){const old=previous.surfaces.find(x=>x.surface===row.surface);if(!old)continue;const confidence=confidenceFor(row.exposures,row.exposures,Math.max(current.surfaces.length,config.minimumCohortSize),config),change=percentageChange(row.exposures,old.exposures);if(confidence&&change!=null&&Math.abs(change)>=config.materialPercentChange)add({type:"behavior_change",subject:{type:"surface",id:row.surface},statement:`Qualified exposure on ${row.surface} changed ${Math.abs(change).toFixed(1)}% versus the previous equivalent period.`,currentValue:row.exposures,comparisonValue:old.exposures,magnitude:magnitude(row.exposures,old.exposures),sample:{events:row.exposures,visitors:row.visitors,opportunities:row.exposures,cohortSize:current.surfaces.length},confidence,evidence:[{metric:"qualified_exposures",value:row.exposures}],caveats:[caveat],suggestedAction:"Review the surface mix and comparable traffic context.",drilldown:{surface:row.surface}})}

  for(const row of current.acquisition){const rate=safeRate(row.outbound,row.visitors),peers=current.acquisition,peerMedian=median(peers.map(p=>safeRate(p.outbound,p.visitors)).filter((v):v is number=>v!=null)),confidence=confidenceFor(row.visitors,row.visitors,peers.length,config);if(confidence&&rate!=null&&peerMedian!=null&&rate>peerMedian*(1+config.rateLift))add({type:"acquisition_quality",subject:{type:"acquisition",id:row.source},statement:`Visitors from ${row.source} showed an outbound-intent rate above the comparable acquisition-source median.`,currentValue:rate,comparisonValue:peerMedian,magnitude:magnitude(rate,peerMedian),sample:{events:row.outbound,visitors:row.visitors,opportunities:row.visitors,cohortSize:peers.length},confidence,evidence:[{metric:"outbound_intent_rate",value:rate},{metric:"source_median",value:peerMedian}],caveats:[caveat,"Acquisition quality is reported as separate downstream behaviors, not one score."],suggestedAction:"Inspect downstream discovery and consideration for this source.",drilldown:{source:row.source}})}

  const currentRepeat=safeRate(current.repeatInterest.visitors,current.repeatInterest.eligibleVisitors),previousRepeat=safeRate(previous.repeatInterest.visitors,previous.repeatInterest.eligibleVisitors);
  const repeatConfidence=confidenceFor(current.repeatInterest.eligibleVisitors,current.repeatInterest.eligibleVisitors,config.minimumCohortSize,config);
  if(repeatConfidence&&currentRepeat!=null&&previousRepeat!=null){const change=percentageChange(currentRepeat,previousRepeat);if(change!=null&&Math.abs(change)>=config.materialPercentChange)add({type:"behavior_change",subject:{type:"platform",id:"repeat-interest"},statement:`Observed repeat-interest rate changed ${Math.abs(change).toFixed(1)}% versus the previous equivalent period.`,currentValue:currentRepeat,comparisonValue:previousRepeat,magnitude:magnitude(currentRepeat,previousRepeat),sample:{events:current.repeatInterest.visitors,visitors:current.repeatInterest.eligibleVisitors,opportunities:current.repeatInterest.eligibleVisitors,cohortSize:config.minimumCohortSize},confidence:repeatConfidence,evidence:[{metric:"repeat_interest_rate",value:currentRepeat}],caveats:[caveat,"Identity is anonymous-browser scoped and does not cross devices."],suggestedAction:"Compare the returning cohort's discovery and intent mix.",drilldown:{period:current.label}})}
  return insights;
}
