import { listRows } from "./baserow";

export const ANALYTICS_TABLE = import.meta.env?.BASEROW_ANALYTICS_EVENTS_TABLE_ID || "";

export type PeriodKey = "today" | "yesterday" | "7d" | "30d" | "90d" | "custom";
export type AnalyticsEvent = {
  id: number;
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
    id: Number(row.id), event: text(row.event_name), at,
    sessionId: pick(row, payload, "anonymous_session_id"), journeyId: pick(row, payload, "anonymous_journey_id"),
    productId: pick(row, payload, "product_id"), productName: pick(row, payload, "product_name"), productSlug: pick(row, payload, "product_slug"),
    brandId: pick(row, payload, "brand_id"), brandName: pick(row, payload, "brand_name"), brandSlug: pick(row, payload, "brand_slug"),
    category: pick(row, payload, "category"), subcategory: pick(row, payload, "subcategory"), productType: pick(row, payload, "product_type"),
    searchTerm: text(row.search_term || payload.search_term || payload.query), resultCount: number(row.search_results_count ?? payload.search_results_count ?? payload.result_count),
    collectionId: pick(row, payload, "collection_id"), sourceContext: pick(row, payload, "source_context"), listContext: pick(row, payload, "list_context"),
    referrerDomain: pick(row, payload, "referrer_domain"), utmSource: pick(row, payload, "utm_source"), utmMedium: pick(row, payload, "utm_medium"), utmCampaign: pick(row, payload, "utm_campaign"),
    payload,
  };
};

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

export function resolvePeriod(url: URL) {
  const now = new Date();
  const key = (["today", "yesterday", "7d", "30d", "90d", "custom"].includes(url.searchParams.get("period") || "") ? url.searchParams.get("period") : "7d") as PeriodKey;
  const today = sofiaStart(dateInSofia(now));
  let start = key === "today" ? today : key === "yesterday" ? addDays(today, -1) : addDays(today, -(key === "30d" ? 29 : key === "90d" ? 89 : 6));
  let end = key === "yesterday" ? today : addDays(today, 1);
  if (key === "custom") {
    start = validDate(url.searchParams.get("from") || "", addDays(today, -6));
    end = addDays(validDate(url.searchParams.get("to") || "", today), 1);
    if (start >= end) start = addDays(end, -1);
  }
  const duration = end.getTime() - start.getTime();
  return { key, start, end, previousStart: new Date(start.getTime() - duration), previousEnd: start, from: dateInSofia(start), to: dateInSofia(new Date(end.getTime() - 1)) };
}

const count = (events: AnalyticsEvent[], name: string) => events.filter((event) => event.event === name).length;
const unique = (values: string[]) => new Set(values.filter(Boolean)).size;
const pct = (numerator: number, denominator: number) => denominator ? (numerator / denominator) * 100 : 0;
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
  items.forEach(item => { const value=key(item)||"Unknown"; map.set(value,[...(map.get(value)||[]),item]); });
  return map;
};

const downstreamNames = new Set(["view_product","save_product","add_to_collection","share_product","outbound_product_click"]);
export function buildSearchRows(events: AnalyticsEvent[]) {
  const sorted = [...events].sort((a,b)=>a.at.getTime()-b.at.getTime());
  const lastSearchBySession = new Map<string,string>();
  const downstream = new Map<string,AnalyticsEvent[]>();
  sorted.forEach(event => {
    if (event.event === "search" && event.searchTerm) lastSearchBySession.set(event.sessionId,event.searchTerm);
    if (!downstreamNames.has(event.event)) return;
    const query = event.searchTerm || lastSearchBySession.get(event.sessionId) || "";
    if (query) downstream.set(query,[...(downstream.get(query)||[]),event]);
  });
  return [...group(events.filter(e=>e.event==="search" && e.searchTerm),e=>e.searchTerm).entries()].map(([query,items])=>{
    const actions=downstream.get(query)||[]; const counts=items.map(e=>e.resultCount);
    return {query, searches:items.length, avgResults:counts.length?counts.reduce((a,b)=>a+b,0)/counts.length:0, zero:items.filter(e=>e.resultCount===0).length,
      productViews:count(actions,"view_product"), saves:count(actions,"save_product"), outbound:count(actions,"outbound_product_click"),
      unmetScore:items.filter(e=>e.resultCount===0).length*3 + Math.max(0,items.length-(actions.length||0))};
  }).sort((a,b)=>b.searches-a.searches);
}

export function buildProductRows(events: AnalyticsEvent[]) {
  return [...group(events.filter(e=>e.productId||e.productSlug),e=>e.productId||e.productSlug).entries()].map(([id,items])=>{
    const impressions=count(items,"product_impression"), views=count(items,"view_product"), outbound=count(items,"outbound_product_click");
    return {id,name:items.find(e=>e.productName)?.productName||id,slug:items.find(e=>e.productSlug)?.productSlug||"",brand:items.find(e=>e.brandName)?.brandName||"—",brandId:items.find(e=>e.brandId)?.brandId||"",
      impressions,views,saves:count(items,"save_product"),adds:count(items,"add_to_collection"),shares:count(items,"share_product"),outbound, impressionViewRate:pct(views,impressions),viewOutboundRate:pct(outbound,views)};
  }).sort((a,b)=>b.views+b.outbound-a.views-a.outbound);
}

export function buildBrandRows(events: AnalyticsEvent[]) {
  return [...group(events.filter(e=>e.brandId||e.brandSlug||e.brandName),e=>e.brandId||e.brandSlug||e.brandName).entries()].map(([id,items])=>({id,name:items.find(e=>e.brandName)?.brandName||id,slug:items.find(e=>e.brandSlug)?.brandSlug||"",
    impressions:count(items,"brand_impression"),productViews:count(items,"view_product"),brandViews:count(items,"view_brand"),saves:count(items,"save_product"),adds:count(items,"add_to_collection"),shares:count(items,"share_product")+count(items,"share_collection"),productOutbound:count(items,"outbound_product_click"),brandOutbound:count(items,"outbound_brand_click"),products:buildProductRows(items)})).sort((a,b)=>b.productViews+b.brandViews-a.productViews-a.brandViews);
}

export function buildDimensionRows(events: AnalyticsEvent[], selector:(event:AnalyticsEvent)=>string) {
  return [...group(events,selector).entries()].map(([name,items])=>({name,events:items.length,sessions:unique(items.map(e=>e.sessionId)),impressions:count(items,"product_impression"),views:count(items,"view_product"),saves:count(items,"save_product"),outbound:count(items,"outbound_product_click")+count(items,"outbound_brand_click")})).sort((a,b)=>b.events-a.events);
}

export function buildCollectionSummary(events: AnalyticsEvent[]) {
  const names=["create_collection","add_to_collection","remove_from_collection","view_collection","share_collection"];
  return names.map(event=>({event,count:count(events,event),collections:unique(events.filter(e=>e.event===event).map(e=>e.collectionId))}));
}

export function buildJourneyRows(events: AnalyticsEvent[]) {
  return [...group(events.filter(e=>e.sessionId),e=>e.sessionId).entries()].map(([sessionId,items])=>{
    const sorted=[...items].sort((a,b)=>a.at.getTime()-b.at.getTime());
    return {sessionId:`…${sessionId.slice(-8)}`,started:sorted[0]?.at,steps:sorted.map(e=>({event:e.event,label:e.searchTerm||e.productName||e.brandName||e.category||""})),meaningful:sorted.some(e=>["save_product","outbound_product_click"].includes(e.event))};
  }).filter(row=>row.steps.length>1).sort((a,b)=>(b.started?.getTime()||0)-(a.started?.getTime()||0)).slice(0,40);
}
