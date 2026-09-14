import type { AnalyticsInsight, InsightConfidence } from "./analytics-insights";

export const ANALYTICS_V2_COPY={
 nav:{overview:"Преглед",explore:"Разглеждане",diagnostics:"Диагностика"},
 navHelp:{overview:"Какво трябва да знам?",explore:"Искам да разбера повече",diagnostics:"Искам да проверя данните"},
 explore:{search:"Търсене",discovery:"Откриване на продукти",products:"Продукти",brands:"Брандове",returning:"Връщащ се интерес",acquisition:"Откъде идват посетителите"},
 metrics:{eligible:"Възможности продуктът да бъде открит",exposure:"Реално показване",selection:"Отваряне на продукт",pageView:"Преглед на продуктова страница",consideration:"Сигнал за интерес",outbound:"Преминаване към сайта на бранда",repeat:"Повторен интерес",returning:"Връщащ се посетител",similarProducts:"Сходни продукти",similarBrands:"Сходни брандове",thinSupply:"Малък избор"},
 confidence:{LOW:"Ниска увереност",MEDIUM:"Средна увереност",HIGH:"Висока увереност"} satisfies Record<InsightConfidence,string>,
 insufficient:{sample:"Все още няма достатъчно данни за надеждно сравнение.",insights:"Все още няма достатъчно данни за надеждни автоматични изводи за този период.",comparison:"Няма достатъчно данни от предходния период.",noActivity:"Няма наблюдавана активност за избрания период.",area:"Няма наблюдавана активност в тази област за избрания период."},
 otherContext:"Друг контекст",
} as const;

const SURFACE_LABELS:Record<string,string>={
 homepage_default:"Начална страница",search_results:"Търсене",category:"Категории",category_results:"Категории",taxonomy_results:"Категории",subcategory:"Подкатегории",product_type:"Типове продукти",gift_discovery:"Откриване на подаръци",seo_landing_page:"Тематични страници",seo_landing:"Тематични страници",brand_directory:"Каталог с брандове",brand_directory_search:"Търсене на бранд",brand_page_products:"Продукти в профил на бранд",related_products:"Свързани продукти",more_from_brand:"Още от този бранд",blog_recommendations:"Препоръки в статии",saved_products:"Запазени продукти",named_collection:"Колекции",shared_collection:"Споделени колекции",product_page:"Продуктови страници",brand_page:"Страници на брандове",save_modal:"Запазване на продукт",
};
export function contextLabel(value:unknown){const raw=String(value??"").trim();if(!raw)return ANALYTICS_V2_COPY.otherContext;if(/^\/p(?:\/|$)/.test(raw))return"Продуктови страници";if(/^\/brand(?:\/|$)/.test(raw))return"Страници на брандове";return SURFACE_LABELS[raw]||ANALYTICS_V2_COPY.otherContext}

export function acquisitionLabel(input:{source?:unknown;medium?:unknown;campaign?:unknown;referrer?:unknown}){const source=String(input.source??"").trim().toLocaleLowerCase("en"),medium=String(input.medium??"").trim().toLocaleLowerCase("en"),campaign=String(input.campaign??"").trim(),referrer=String(input.referrer??"").trim().toLocaleLowerCase("en"),hay=`${source} ${medium} ${referrer}`;
 if(/email|e-mail|newsletter/.test(`${source} ${medium}`))return"Имейл";
 if(/google/.test(hay)&&(/organic|search|google/.test(`${medium} ${referrer}`)))return"Google / органично търсене";
 if(/organic|search|bing|yahoo|duckduckgo/.test(hay))return"Търсачки";
 if(/facebook|instagram|linkedin|tiktok|pinterest|youtube|social/.test(hay))return"Социални мрежи";
 if(campaign||source&&!/^(direct|none|unknown|legacy)$/.test(source)||medium&&!/^(none|unknown)$/.test(medium))return"Кампании";
 if(referrer&&referrer!=="—"&&!/bulgaritam\.bg|localhost|127\.0\.0\.1/.test(referrer))return"Други източници";
 if(!source||/^(direct|none)$/.test(source))return"Директни посещения";
 return"Неопределен източник";
}

export const confidenceLabel=(value:InsightConfidence)=>ANALYTICS_V2_COPY.confidence[value];
export const percentChange=(current:number,previous:number)=>previous===0?null:(current-previous)/previous*100;
export const comparisonText=(current:number,previous:number|null)=>previous==null?ANALYTICS_V2_COPY.insufficient.comparison:`${formatNumber(current)} спрямо ${formatNumber(previous)} през предходния период`;
export const percentChangeText=(current:number,previous:number|null)=>{if(previous==null)return ANALYTICS_V2_COPY.insufficient.comparison;const value=percentChange(current,previous);return value==null?ANALYTICS_V2_COPY.insufficient.comparison:`${value>=0?"+":""}${formatNumber(value,1)}% спрямо предходния период`};
export const formatNumber=(value:number,digits=0)=>new Intl.NumberFormat("bg-BG",{maximumFractionDigits:digits}).format(value);
const DAY=86_400_000;
const rangeDate=(value:Date,includeYear:boolean)=>new Intl.DateTimeFormat("bg-BG",{day:"numeric",month:"long",...(includeYear?{year:"numeric" as const}:{}) ,timeZone:"Europe/Sofia"}).format(value);
export function formatComparisonPeriod(currentStart:Date,currentEnd:Date,previousStart:Date,previousEnd:Date){const currentLast=new Date(currentEnd.getTime()-DAY),previousLast=new Date(previousEnd.getTime()-DAY),includeYear=currentStart.getFullYear()!==previousStart.getFullYear()||currentStart.getFullYear()!==new Date().getFullYear();const range=(a:Date,b:Date)=>`${rangeDate(a,false)} – ${rangeDate(b,includeYear)}`;return`Сравняваме ${range(currentStart,currentLast)} с ${range(previousStart,previousLast)}.`}

const FAMILY_PRIORITY=(insight:AnalyticsInsight)=>insight.type==="anomaly"||insight.type==="friction"?0:insight.subject.type==="search"&&insight.type==="opportunity"?1:["product","acquisition"].includes(insight.subject.type)&&["opportunity","hidden_winner","underperformer","acquisition_quality"].includes(insight.type)?2:3;
const CONFIDENCE_PRIORITY:Record<InsightConfidence,number>={HIGH:0,MEDIUM:1,LOW:2};
export function orderInsights(insights:AnalyticsInsight[]){return insights.map((insight,index)=>({insight,index})).sort((a,b)=>FAMILY_PRIORITY(a.insight)-FAMILY_PRIORITY(b.insight)||CONFIDENCE_PRIORITY[a.insight.confidence]-CONFIDENCE_PRIORITY[b.insight.confidence]||b.insight.sample.events-a.insight.sample.events||Math.abs(b.insight.magnitude.percent??b.insight.magnitude.absolute??0)-Math.abs(a.insight.magnitude.percent??a.insight.magnitude.absolute??0)||a.insight.type.localeCompare(b.insight.type)||a.insight.subject.type.localeCompare(b.insight.subject.type)||a.insight.subject.id.localeCompare(b.insight.subject.id)||a.index-b.index).map(x=>x.insight)}

export type LowDataState="has_insights"|"no_activity"|"insufficient_comparison"|"insufficient_evidence";
export function lowDataState(input:{events:number;insights:number;comparisonAvailable:boolean}):LowDataState{return input.events===0?"no_activity":input.insights>0?"has_insights":!input.comparisonAvailable?"insufficient_comparison":"insufficient_evidence"}
export function lowDataMessage(state:LowDataState){if(state==="no_activity")return ANALYTICS_V2_COPY.insufficient.noActivity;if(state==="insufficient_comparison")return`${ANALYTICS_V2_COPY.insufficient.insights} ${ANALYTICS_V2_COPY.insufficient.comparison}`;if(state==="insufficient_evidence")return`${ANALYTICS_V2_COPY.insufficient.insights} Има наблюдавана активност, но извадката все още е малка за надеждни сравнения.`;return""}
