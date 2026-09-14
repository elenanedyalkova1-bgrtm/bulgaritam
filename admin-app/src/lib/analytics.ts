import { listRows } from "./baserow";

export const ANALYTICS_TABLE = import.meta.env?.BASEROW_ANALYTICS_EVENTS_TABLE_ID || "";

export type PeriodKey = "today" | "yesterday" | "7d" | "30d" | "90d" | "last_month" | "last_quarter" | "custom";
export type AnalyticsEvent = {
  id: number;
  eventId: string;
  event: string;
  at: Date;
  sessionId: string;
  journeyId: string;
  productId: string;
  productName: string;
  productSlug: string;
  brandId: string;
  brandName: string;
  brandSlug: string;
  category: string;
  subcategory: string;
  productType: string;
  searchTerm: string;
  resultCount: number;
  collectionId: string;
  sourceContext: string;
  listContext: string;
  referrerDomain: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  searchId: string;
  pagePath: string;
  pageType: string;
  giftRecipient: string;
  giftOccasion: string;
  sequenceNumber: number;
  acquisitionChannel: string;
  landingPage: string;
  discoveryStateId: string;
  searchRevision: number;
  payload: Record<string, unknown>;
};

const text = (value: unknown) => String(value ?? "").trim();
const number = (value: unknown) => Number(value) || 0;
const parsePayload = (value: unknown) => {
  try { return JSON.parse(text(value) || "{}"); } catch { return {}; }
};
const pick = (row: any, payload: any, key: string) => text(row[key] ?? payload[key]);

export const parseEvent = (row: any): AnalyticsEvent | null => {
  const payload = parsePayload(row.payload_json);
  const at = new Date(text(row.occurred_at));
  if (!row.event_name || Number.isNaN(at.getTime())) return null;
  return {
    id: Number(row.id), eventId: pick(row,payload,"event_id"), event: text(row.event_name), at,
    sessionId: pick(row, payload, "anonymous_session_id"), journeyId: pick(row, payload, "anonymous_journey_id"),
    productId: pick(row, payload, "product_id"), productName: pick(row, payload, "product_name"), productSlug: pick(row, payload, "product_slug"),
    brandId: pick(row, payload, "brand_id"), brandName: pick(row, payload, "brand_name"), brandSlug: pick(row, payload, "brand_slug"),
    category: pick(row, payload, "category"), subcategory: pick(row, payload, "subcategory"), productType: pick(row, payload, "product_type"),
    searchTerm: text(row.search_term || payload.search_term || payload.query), resultCount: number(row.search_results_count ?? payload.search_results_count ?? payload.result_count),
    collectionId: pick(row, payload, "collection_id"), sourceContext: pick(row, payload, "source_context"), listContext: pick(row, payload, "list_context"),
    referrerDomain: pick(row, payload, "referrer_domain"), utmSource: pick(row, payload, "utm_source"), utmMedium: pick(row, payload, "utm_medium"), utmCampaign: pick(row, payload, "utm_campaign"),
    searchId: pick(row, payload, "search_id"), pagePath: pick(row, payload, "page_path"), pageType: pick(row, payload, "page_type"),
    giftRecipient: pick(row, payload, "gift_recipient"), giftOccasion: pick(row, payload, "gift_occasion"),
    sequenceNumber:number(payload.sequence_number), acquisitionChannel:pick(row,payload,"acquisition_channel"), landingPage:pick(row,payload,"landing_page"), discoveryStateId:pick(row,payload,"discovery_state_id"), searchRevision:number(payload.search_revision),
    payload,
  };
};

// Rollback/parity loader only. The production Analytics V1 page reads Supabase.
export async function loadAnalyticsEvents() {
  if (!ANALYTICS_TABLE) throw new Error("BASEROW_ANALYTICS_EVENTS_TABLE_ID is not configured.");
  return (await listRows(ANALYTICS_TABLE)).map(parseEvent).filter((event): event is AnalyticsEvent => Boolean(event));
}

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);
const SOFIA = "Europe/Sofia";
const dateInSofia = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone:SOFIA, year:"numeric", month:"2-digit", day:"2-digit" }).format(date);
const sofiaStart = (value:string) => {
  const [year,month,day]=value.split("-").map(Number); const noon=new Date(Date.UTC(year,month-1,day,12));
  const zoneName=new Intl.DateTimeFormat("en",{timeZone:SOFIA,timeZoneName:"longOffset"}).formatToParts(noon).find(part=>part.type==="timeZoneName")?.value||"GMT+02:00";
  const match=zoneName.match(/GMT([+-])(\d{2}):(\d{2})/); const offset=match?(Number(match[2])*60+Number(match[3]))*(match[1]==="-"?-1:1):120;
  return new Date(Date.UTC(year,month-1,day)-offset*60_000);
};
const validDate = (value: string, fallback: Date) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? sofiaStart(value) : fallback;

export function resolvePeriod(url: URL, now = new Date()) {
  const key = (["today", "yesterday", "7d", "30d", "90d", "last_month", "last_quarter", "custom"].includes(url.searchParams.get("period") || "") ? url.searchParams.get("period") : "7d") as PeriodKey;
  const today = sofiaStart(dateInSofia(now));
  let start = key === "today" ? today : key === "yesterday" ? addDays(today, -1) : addDays(today, -(key === "30d" ? 29 : key === "90d" ? 89 : 6));
  let end = key === "yesterday" ? today : addDays(today, 1);
  let previousStart:Date|undefined,previousEnd:Date|undefined;
  if(key==="last_month"||key==="last_quarter"){
    const [year,month]=dateInSofia(now).split("-").map(Number),quarterMonth=Math.floor((month-1)/3)*3+1;
    const calendarStart=(y:number,m:number)=>sofiaStart(`${y}-${String(m).padStart(2,"0")}-01`),shiftMonth=(y:number,m:number,delta:number)=>{const d=new Date(Date.UTC(y,m-1+delta,1));return[ d.getUTCFullYear(),d.getUTCMonth()+1 ] as const};
    const [endYear,endMonth]=key==="last_month"?[year,month] as const:[year,quarterMonth] as const,[startYear,startMonth]=shiftMonth(endYear,endMonth,key==="last_month"?-1:-3),[previousYear,previousMonth]=shiftMonth(startYear,startMonth,key==="last_month"?-1:-3);
    start=calendarStart(startYear,startMonth);end=calendarStart(endYear,endMonth);previousStart=calendarStart(previousYear,previousMonth);previousEnd=start;
  }
  if (key === "custom") {
    start = validDate(url.searchParams.get("from") || "", addDays(today, -6));
    end = addDays(validDate(url.searchParams.get("to") || "", today), 1);
    if (start >= end) start = addDays(end, -1);
  }
  const duration = end.getTime() - start.getTime();
  return { key, start, end, previousStart:previousStart||new Date(start.getTime() - duration), previousEnd:previousEnd||start, from: dateInSofia(start), to: dateInSofia(new Date(end.getTime() - 1)) };
}

export const count = (events: AnalyticsEvent[], name: string) => events.filter((event) => event.event === name).length;
const unique = (values: string[]) => new Set(values.filter(Boolean)).size;
const pct = (numerator: number, denominator: number):number|null => denominator > 0 ? (numerator / denominator) * 100 : null;
const eventNames = ["page_view","product_impression","view_product","view_brand","save_product","add_to_collection","share_collection","outbound_product_click","outbound_brand_click","search","search_no_results"];

export function metricSummary(events: AnalyticsEvent[], previous: AnalyticsEvent[]) {
  const rows = [
    { key:"sessions", label:"Sessions", value:unique(events.map(e=>e.sessionId)), previous:unique(previous.map(e=>e.sessionId)) },
    ...eventNames.map((key) => ({ key, label: ({page_view:"Page views",product_impression:"Product impressions",view_product:"Product views",view_brand:"Brand views",save_product:"Saves",add_to_collection:"Collection adds",share_collection:"Collection shares",outbound_product_click:"Product outbound",outbound_brand_click:"Brand outbound",search:"Searches",search_no_results:"Zero-result searches"} as any)[key], value:count(events,key), previous:count(previous,key) })),
  ];
  return rows.map(row => ({...row, change: row.previous ? pct(row.value-row.previous,row.previous) : null}));
}

const group = <T>(items: T[], key: (item:T)=>string) => {
  const map = new Map<string,T[]>();
  items.forEach(item => { const value=key(item)||"Неизвестно"; map.set(value,[...(map.get(value)||[]),item]); });
  return map;
};

const downstreamNames = new Set(["view_product","view_brand","save_product","add_to_collection","share_product","outbound_product_click","outbound_brand_click"]);
export function buildSearchRows(events: AnalyticsEvent[]) {
  const downstream = new Map<string,AnalyticsEvent[]>();
  events.filter(event=>downstreamNames.has(event.event)&&event.searchId).forEach(event=>downstream.set(event.searchId,[...(downstream.get(event.searchId)||[]),event]));
  return [...group(events.filter(e=>e.event==="search" && e.searchTerm),e=>e.searchTerm).entries()].map(([query,items])=>{
    const actions=items.flatMap(item=>item.searchId?(downstream.get(item.searchId)||[]):[]); const counts=items.map(e=>e.resultCount);
    const zero=items.filter(e=>e.resultCount===0).length;
    const productsReturned=new Map<string,number>(),brandsReturned=new Map<string,number>();items.forEach(item=>{returnedProducts(item).forEach(([id])=>productsReturned.set(id,(productsReturned.get(id)||0)+1));returnedBrands(item).forEach(([id])=>brandsReturned.set(id,(brandsReturned.get(id)||0)+1));returnedProducts(item).forEach(([,id])=>{if(id)brandsReturned.set(id,(brandsReturned.get(id)||0)+1)})});
    const top=(map:Map<string,number>)=>[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
    return {query, searches:items.length,sessions:unique(items.map(e=>e.sessionId)), avgResults:counts.length?counts.reduce((a,b)=>a+b,0)/counts.length:0, zero, zeroRate:pct(zero,items.length)??0,
      productViews:count(actions,"view_product"), brandViews:count(actions,"view_brand"), saves:count(actions,"save_product"), productOutbound:count(actions,"outbound_product_click"), brandOutbound:count(actions,"outbound_brand_click"), outbound:count(actions,"outbound_product_click"),
      topProductsReturned:top(productsReturned),topProductsViewed:top(new Map(actions.filter(e=>e.event==="view_product"&&e.productId).map(e=>[e.productName||e.productId,actions.filter(x=>x.event==="view_product"&&(x.productId===e.productId)).length]))),topBrandsReturned:top(brandsReturned),topBrandsViewed:top(new Map(actions.filter(e=>e.event==="view_brand"&&e.brandId).map(e=>[e.brandName||e.brandId,actions.filter(x=>x.event==="view_brand"&&x.brandId===e.brandId).length]))),
      unmetScore:items.filter(e=>e.resultCount===0).length*3 + Math.max(0,items.length-(actions.length||0))};
  }).sort((a,b)=>b.searches-a.searches);
}

type ProductResult = [string,string,number];
type BrandResult = [string,number];
const jsonTuples = (value: unknown) => { try { const parsed=JSON.parse(text(value)); return Array.isArray(parsed)?parsed:[]; } catch { return []; } };
export const returnedProducts = (event:AnalyticsEvent) => jsonTuples(event.payload.returned_products_json).map((r:any)=>[text(r[0]),text(r[1]),Number(r[2])||0] as ProductResult).filter(r=>r[0]);
export const returnedBrands = (event:AnalyticsEvent) => jsonTuples(event.payload.returned_brands_json).map((r:any)=>[text(r[0]),Number(r[1])||0] as BrandResult).filter(r=>r[0]);
const hasReturnedData = (event:AnalyticsEvent) => Object.hasOwn(event.payload,"returned_products_json")||Object.hasOwn(event.payload,"returned_brands_json");

export function buildProductRows(events: AnalyticsEvent[]) {
  const returned=new Map<string,number>();let returnedAvailable=false;
  events.filter(e=>e.event==="search").forEach(e=>{if(hasReturnedData(e))returnedAvailable=true;returnedProducts(e).forEach(([id])=>returned.set(id,(returned.get(id)||0)+1))});
  const ids=new Set([...events.map(e=>e.productId||e.productSlug).filter(Boolean),...returned.keys()]);
  return [...ids].map(id=>{const items=events.filter(e=>(e.productId||e.productSlug)===id);
    const impressions=count(items,"product_impression"), views=count(items,"view_product"), outbound=count(items,"outbound_product_click");
    const returns=returned.get(id);
    return {id,name:items.find(e=>e.productName)?.productName||id,slug:items.find(e=>e.productSlug)?.productSlug||"",brand:items.find(e=>e.brandName)?.brandName||"—",brandId:items.find(e=>e.brandId)?.brandId||"",category:items.find(e=>e.category)?.category||"",
      returned:returns??null,returnedAvailable,impressions,views,saves:count(items,"save_product"),adds:count(items,"add_to_collection"),shares:count(items,"share_product"),outbound,returnedImpressionRate:returns==null?null:pct(impressions,returns),returnedViewRate:returns==null?null:pct(views,returns),returnedOutboundRate:returns==null?null:pct(outbound,returns),impressionViewRate:pct(views,impressions),viewOutboundRate:pct(outbound,views)};
  }).sort((a,b)=>b.views+b.outbound-a.views-a.outbound);
}

export function buildBrandRows(events: AnalyticsEvent[]) {
  const returned=new Map<string,number>();let returnedAvailable=false;
  events.filter(e=>e.event==="search").forEach(e=>{if(hasReturnedData(e))returnedAvailable=true;returnedBrands(e).forEach(([id])=>returned.set(id,(returned.get(id)||0)+1));returnedProducts(e).forEach(([,id])=>{if(id)returned.set(id,(returned.get(id)||0)+1)})});
  const ids=new Set([...events.map(e=>e.brandId||e.brandSlug||e.brandName).filter(Boolean),...returned.keys()]);
  return [...ids].map(id=>{const items=events.filter(e=>(e.brandId||e.brandSlug||e.brandName)===id);return {id,name:items.find(e=>e.brandName)?.brandName||id,slug:items.find(e=>e.brandSlug)?.brandSlug||"",returned:returned.get(id)??null,returnedAvailable,
    impressions:count(items,"brand_impression"),productViews:count(items,"view_product"),brandViews:count(items,"view_brand"),saves:count(items,"save_product"),adds:count(items,"add_to_collection"),shares:count(items,"share_product")+count(items,"share_collection"),productOutbound:count(items,"outbound_product_click"),brandOutbound:count(items,"outbound_brand_click"),products:buildProductRows(items)}}).sort((a,b)=>b.productViews+b.brandViews-a.productViews-a.brandViews);
}

export function buildDimensionRows(events: AnalyticsEvent[], selector:(event:AnalyticsEvent)=>string) {
  const exploded=events.flatMap(event=>split(selector(event)).map(name=>({name,event})));
  return [...group(exploded,x=>x.name).entries()].map(([name,entries])=>{const items=entries.map(x=>x.event);return{name,events:items.length,sessions:unique(items.map(e=>e.sessionId)),impressions:count(items,"product_impression"),views:count(items,"view_product"),saves:count(items,"save_product"),outbound:count(items,"outbound_product_click")+count(items,"outbound_brand_click")}}).sort((a,b)=>b.events-a.events);
}

export function buildCollectionSummary(events: AnalyticsEvent[]) {
  const names=["create_collection","add_to_collection","remove_from_collection","view_collection","share_collection"];
  return names.map(event=>({event,count:count(events,event),collections:unique(events.filter(e=>e.event===event).map(e=>e.collectionId))}));
}

export function buildJourneyRows(events: AnalyticsEvent[]) {
  return [...group(events.filter(e=>e.sessionId),e=>e.sessionId).entries()].map(([sessionId,items])=>{
    const sorted=[...items].sort((a,b)=>a.at.getTime()-b.at.getTime());
    const start=sorted[0]?.at,end=sorted.at(-1)?.at;return {sessionId:`…${sessionId.slice(-8)}`,started:start,durationMs:start&&end?end.getTime()-start.getTime():0,landing:sorted.find(e=>e.landingPage)?.landingPage||sorted.find(e=>e.event==="page_view")?.pagePath||"—",source:sorted.find(e=>e.acquisitionChannel)?.acquisitionChannel||"Legacy / unknown",searches:count(items,"search"),productViews:count(items,"view_product"),brandViews:count(items,"view_brand"),saves:count(items,"save_product"),outbound:count(items,"outbound_product_click")+count(items,"outbound_brand_click"),legacy:!sorted.some(e=>e.eventId),steps:sorted.map(e=>({at:e.at,event:e.event,label:e.searchTerm||e.productName||e.brandName||e.pagePath||e.category||"",attributed:Boolean(e.searchId)}))};
  }).filter(row=>row.steps.length>1).sort((a,b)=>(b.started?.getTime()||0)-(a.started?.getTime()||0)).slice(0,100);
}

const split=(value:unknown)=>{const raw=text(value);try{const parsed=JSON.parse(raw);if(Array.isArray(parsed))return parsed.map(text).filter(Boolean)}catch{}return raw.split(",").map(v=>v.trim()).filter(Boolean)};
const payloadText=(e:AnalyticsEvent,key:string)=>text(e.payload[key]);
const actionNames=new Set(["view_product","view_brand","save_product","outbound_product_click","outbound_brand_click"]);
export function buildUnmetRows(events:AnalyticsEvent[]){
  const searches=events.filter(e=>e.event==="search"&&e.searchTerm&&e.resultCount<=3);
  const budgetFor=(search:AnalyticsEvent)=>payloadText(search,"price_range")||payloadText([...events].filter(e=>e.sessionId===search.sessionId&&e.at<=search.at&&["gift_budget","product_constraints"].includes(payloadText(e,"filter_name"))).sort((a,b)=>b.at.getTime()-a.at.getTime())[0]||search,"price_range");
  return [...group(searches,e=>e.searchTerm).entries()].map(([query,items])=>({query,searches:items.length,resultCount:Math.min(...items.map(e=>e.resultCount)),zero:items.filter(e=>e.resultCount===0).length,category:items.find(e=>e.category)?.category||"—",subcategory:items.find(e=>e.subcategory)?.subcategory||"—",productType:items.find(e=>e.productType)?.productType||"—",recipient:items.find(e=>e.giftRecipient)?.giftRecipient||"—",occasion:items.find(e=>e.giftOccasion)?.giftOccasion||"—",budget:items.map(budgetFor).find(Boolean)||"—"})).sort((a,b)=>b.zero-a.zero||b.searches-a.searches);
}

const filterDimensions=[
  ["category","Категория"],["subcategory","Подкатегория"],["product_type","Тип продукт"],["materials","Материал"],["colors","Цвят"],["attributes","Характеристика"],["price_range","Ценови диапазон"],["gift_budget","Бюджет за подарък"],["gift_recipient","Получател"],["gift_occasion","Повод"],["giftable","Подходящо за подарък"],["delivery_abroad","Доставка извън България"],
] as const;
export function buildFilterRows(events:AnalyticsEvent[]){
  const rows:any[]=[];
  for(const [key,label] of filterDimensions){
    const selections: {event:AnalyticsEvent,value:string}[]=[];
    events.forEach(e=>{
      const filterName=payloadText(e,"filter_name");
      let values:string[]=[];
      if(key==="category"&&e.event==="select_category")values=[payloadText(e,"filter_value")||e.category];
      else if(key==="subcategory"&&e.event==="select_subcategory")values=[payloadText(e,"filter_value")||e.subcategory];
      else if(key==="product_type"&&e.event==="select_product_type")values=[payloadText(e,"filter_value")||e.productType];
      else if(key==="gift_recipient"&&e.event==="select_gift_recipient")values=[payloadText(e,"filter_value")];
      else if(key==="gift_occasion"&&e.event==="select_gift_occasion")values=[payloadText(e,"filter_value")||e.giftOccasion];
      else if(key==="gift_budget"&&filterName==="gift_budget")values=[payloadText(e,"filter_value")];
      else if(key==="delivery_abroad"&&filterName==="delivery_abroad")values=[payloadText(e,"filter_value")];
      else if(key==="giftable"&&filterName==="giftable")values=[payloadText(e,"filter_value")];
      else if(["materials","colors","attributes"].includes(key)&&filterName==="product_constraints")values=split(e.payload[key]);
      else if(key==="price_range"&&filterName==="product_constraints")values=[payloadText(e,"price_range")].filter(v=>v&&v!=="all");
      values.filter(Boolean).forEach(value=>selections.push({event:e,value}));
    });
    for(const [value,items] of group(selections,x=>x.value)){
      const states=new Set(items.map(x=>x.event.discoveryStateId).filter(Boolean));const actions=events.filter(e=>states.has(e.discoveryStateId)&&actionNames.has(e.event));const before=items.filter(x=>Object.hasOwn(x.event.payload,"results_before")).map(x=>number(x.event.payload.results_before)),after=items.filter(x=>Object.hasOwn(x.event.payload,"results_after")).map(x=>number(x.event.payload.results_after));
      rows.push({key,label,value,selections:items.length,resultsBefore:before.length?before.reduce((a,b)=>a+b,0)/before.length:null,resultsAfter:after.length?after.reduce((a,b)=>a+b,0)/after.length:null,views:count(actions,"view_product"),outbound:count(actions,"outbound_product_click")});
    }
  }
  return rows.sort((a,b)=>b.selections-a.selections);
}

export function buildPageRows(events:AnalyticsEvent[]){return [...group(events,e=>e.pagePath||e.sourceContext||e.listContext).entries()].map(([path,items])=>({path,pageType:items.find(e=>e.pageType)?.pageType||"—",sessions:unique(items.map(e=>e.sessionId)),pageViews:count(items,"page_view"),productViews:count(items,"view_product"),brandViews:count(items,"view_brand"),saves:count(items,"save_product"),outbound:count(items,"outbound_product_click")+count(items,"outbound_brand_click")})).sort((a,b)=>b.pageViews+b.productViews+b.outbound-a.pageViews-a.productViews-a.outbound)}

export function buildAcquisitionRows(events:AnalyticsEvent[]){return [...group(events,e=>[e.acquisitionChannel,e.utmSource,e.utmMedium,e.utmCampaign,e.referrerDomain].join("|")).entries()].map(([key,items])=>{const [channel,source,medium,campaign,referrer]=key.split("|");return{channel:channel||"Legacy / unknown",source:source||"—",medium:medium||"—",campaign:campaign||"—",referrer:referrer||"—",sessions:unique(items.map(e=>e.sessionId)),searches:count(items,"search"),views:count(items,"view_product"),saves:count(items,"save_product"),outbound:count(items,"outbound_product_click")+count(items,"outbound_brand_click")}}).sort((a,b)=>b.sessions-a.sessions)}

export function buildFunnel(events:AnalyticsEvent[]){const searches=events.filter(e=>e.event==="search"),tracked=searches.filter(e=>hasReturnedData(e)&&e.searchId),ids=new Set(tracked.map(e=>e.searchId)),related=events.filter(e=>ids.has(e.searchId)),returns=tracked.reduce((n,e)=>n+returnedProducts(e).length+returnedBrands(e).length,0),impressions=count(related,"product_impression")+count(related,"brand_impression"),views=count(related,"view_product")+count(related,"view_brand"),saves=count(related,"save_product"),outbound=count(related,"outbound_product_click")+count(related,"outbound_brand_click");return{available:tracked.length>0,searches:searches.length,searchesWithResults:searches.filter(e=>e.resultCount>0).length,returns,impressions,views,saves,outbound,returnImpression:pct(impressions,returns),impressionView:pct(views,impressions),viewSave:pct(saves,views),viewOutbound:pct(outbound,views),searchOutbound:tracked.length?pct(outbound,tracked.length):null}}

export function buildBrandSearchRows(events:AnalyticsEvent[],brandId:string){const searches=events.filter(e=>e.event==="search"&&e.searchId);const rows=new Map<string,{query:string,returned:number,impressions:number,views:number,outbound:number}>();for(const s of searches){const productMatches=returnedProducts(s).filter(([,b])=>b===brandId).length;const brandMatches=returnedBrands(s).filter(([b])=>b===brandId).length;if(!productMatches&&!brandMatches)continue;const row=rows.get(s.searchTerm)||{query:s.searchTerm,returned:0,impressions:0,views:0,outbound:0};row.returned+=productMatches+brandMatches;const related=events.filter(e=>e.searchId===s.searchId&&e.brandId===brandId);row.impressions+=count(related,"product_impression")+count(related,"brand_impression");row.views+=count(related,"view_product")+count(related,"view_brand");row.outbound+=count(related,"outbound_product_click")+count(related,"outbound_brand_click");rows.set(s.searchTerm,row)}return[...rows.values()].sort((a,b)=>b.returned-a.returned)}
