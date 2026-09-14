import type {AnalyticsEvent} from "./analytics";
import type {DiscoveryResultRow,DiscoveryStateRow} from "./analytics-derived";

const text=(v:unknown)=>String(v??"").trim();
const ptext=(e:AnalyticsEvent,key:string)=>text(e.payload[key]);
const eventKey=(e:AnalyticsEvent)=>e.eventId||`legacy:${e.id}:${e.at.toISOString()}:${e.sequenceNumber}`;
const CHOICE_EVENTS=new Set(["select_category","select_subcategory","select_product_type","apply_filter","remove_filter","clear_filters","change_sort","select_gift_recipient","select_gift_occasion","open_gift_discovery","surprise_me"]);
const OUTCOME_EVENTS=new Set(["product_impression","view_product","view_brand","save_product","add_to_collection","share_product","outbound_product_click","outbound_brand_click"]);

export type ChoiceDimension="category"|"subcategory"|"product_type"|"price"|"material"|"color"|"attribute"|"recipient"|"occasion"|"delivery"|"giftable"|"clear"|"sort"|"gift_tool"|"surprise"|"other";
export type ChoiceActionFact={id:string;event:AnalyticsEvent;action:"add"|"remove"|"clear"|"sort"|"open"|"random_open";dimension:ChoiceDimension;value:string;label:string;visitorId:string|null;sessionId:string|null;sourceContext:string;usableValue:boolean};
export type ChoiceFacet={dimension:ChoiceDimension;value:string;label:string};
export type ChoiceStateFact={id:string;row:DiscoveryStateRow;visitorId:string|null;sessionId:string|null;facets:ChoiceFacet[];resultCount:number;members:DiscoveryResultRow[]};
export type ChoiceTransitionFact={id:string;action:ChoiceActionFact;fromState:ChoiceStateFact;toState:ChoiceStateFact;resultChange:number};
export type ChoiceOutcomeFact={id:string;event:AnalyticsEvent;state:ChoiceStateFact;kind:"seen"|"product_open"|"brand_open"|"saved"|"product_outbound"|"brand_outbound"};
export type ChoiceDiagnostics={actionsLoaded:number;actionsWithUsableValue:number;canonicalChoiceStates:number;strictLinkedTransitions:number;ambiguousTransitionsSuppressed:number;directStateOutcomes:number;unknownFilterValues:number};
export type ChoiceDomain={actions:ChoiceActionFact[];states:ChoiceStateFact[];transitions:ChoiceTransitionFact[];outcomes:ChoiceOutcomeFact[];diagnostics:ChoiceDiagnostics};

const DIMENSIONS:Record<string,ChoiceDimension>={category:"category",subcategory:"subcategory",product_type:"product_type",price:"price",price_range:"price",gift_budget:"price",material:"material",materials:"material",color:"color",colors:"color",attribute:"attribute",attributes:"attribute",recipient:"recipient",gift_recipient:"recipient",occasion:"occasion",gift_occasion:"occasion",delivery_abroad:"delivery",giftable:"giftable"};
const dimensionFor=(raw:string):ChoiceDimension=>DIMENSIONS[raw]||"other";
const dimensionLabel=(d:ChoiceDimension)=>({category:"Категория",subcategory:"Подкатегория",product_type:"Тип продукт",price:"Цена",material:"Материал",color:"Цвят",attribute:"Характеристика",recipient:"Получател",occasion:"Повод",delivery:"Доставка извън България",giftable:"Подарък",clear:"Филтри",sort:"Подреждане",gift_tool:"Търсене на подарък",surprise:"Изненадай ме",other:"Друг критерий"} as Record<ChoiceDimension,string>)[d];
const stableValue=(e:AnalyticsEvent)=>ptext(e,"filter_value")||ptext(e,"selected_value");

function actionFact(e:AnalyticsEvent):ChoiceActionFact|null{
 let dimension:ChoiceDimension="other",value="",label="",action:ChoiceActionFact["action"]="add";
 if(e.event==="select_category"){dimension="category";value=stableValue(e)||e.category;label=ptext(e,"selected_value")||value}
 else if(e.event==="select_subcategory"){dimension="subcategory";value=stableValue(e)||e.subcategory;label=ptext(e,"selected_value")||value}
 else if(e.event==="select_product_type"){dimension="product_type";value=stableValue(e)||e.productType;label=ptext(e,"selected_value")||value}
 else if(e.event==="select_gift_recipient"){dimension="recipient";value=stableValue(e)||e.giftRecipient;label=ptext(e,"selected_value")||value}
 else if(e.event==="select_gift_occasion"){dimension="occasion";value=stableValue(e)||e.giftOccasion;label=ptext(e,"selected_value")||value}
 else if(e.event==="change_sort"){dimension="sort";value=ptext(e,"selected_value");label=value;action="sort"}
 else if(e.event==="open_gift_discovery"){dimension="gift_tool";value="open";label="Отваряне на избора за подарък";action="open"}
 else if(e.event==="surprise_me"){dimension="surprise";value="surprise";label="Използване на „Изненадай ме“";action="random_open"}
 else {
  const rawName=ptext(e,"filter_name");dimension=dimensionFor(rawName);
  value=stableValue(e);
  if(rawName==="product_constraints"&&ptext(e,"price_range")&&ptext(e,"price_range")!=="all"){dimension="price";value=ptext(e,"price_range")}
  const rawAction=ptext(e,"filter_action");action=e.event==="clear_filters"||rawAction==="clear"?"clear":e.event==="remove_filter"||rawAction==="remove"?"remove":"add";
  if(action==="clear"){dimension="clear";value=rawName||"filters";label="Изчистване на филтри"}else label=value;
 }
 return{id:eventKey(e),event:e,action,dimension,value,label:label||dimensionLabel(dimension),visitorId:text(e.journeyId)||null,sessionId:text(e.sessionId)||null,sourceContext:e.sourceContext||e.listContext||ptext(e,"source_surface"),usableValue:Boolean(value)||["clear","open","random_open"].includes(action)};
}

const addFacet=(out:ChoiceFacet[],dimension:ChoiceDimension,value:unknown,label?:string)=>{const v=text(value);if(v&&!out.some(x=>x.dimension===dimension&&x.value===v))out.push({dimension,value:v,label:label||v})};
export function normalizeChoiceState(row:DiscoveryStateRow,members:DiscoveryResultRow[]=[]):ChoiceStateFact{
 const facets:ChoiceFacet[]=[];addFacet(facets,"category",row.category);addFacet(facets,"subcategory",row.subcategory);addFacet(facets,"product_type",row.product_type);addFacet(facets,"sort",row.sort_value);addFacet(facets,"recipient",row.gift_recipient);addFacet(facets,"occasion",row.gift_occasion);
 if(row.price_min_eur!=null||row.price_max_eur!=null)addFacet(facets,"price",`${row.price_min_eur??0}-${row.price_max_eur??"+"}`);
 const active=row.active_filters;
 if(active&&typeof active==="object"&&!Array.isArray(active))for(const [key,raw] of Object.entries(active)){
  const dimension=dimensionFor(key);const values=Array.isArray(raw)?raw:[raw];
  for(const item of values){if(typeof item==="string"&&item.includes(":")){const [prefix,...rest]=item.split(":");addFacet(facets,dimensionFor(prefix),rest.join(":"))}else if(typeof item==="string"||typeof item==="number")addFacet(facets,dimension,item)}
 }
 return{id:row.discovery_state_id,row,visitorId:text(row.anonymous_journey_id)||null,sessionId:text(row.anonymous_session_id)||null,facets,resultCount:row.result_count,members};
}

const stateHas=(s:ChoiceStateFact,a:ChoiceActionFact)=>s.facets.some(f=>f.dimension===a.dimension&&f.value===a.value);
const samePage=(e:AnalyticsEvent,s:ChoiceStateFact)=>!e.pagePath||!s.row.page_path||e.pagePath===s.row.page_path;
export function deriveChoiceDomain(events:AnalyticsEvent[],completeStates:DiscoveryStateRow[],completeResults:DiscoveryResultRow[]):ChoiceDomain{
 const actions=[...new Map(events.filter(e=>CHOICE_EVENTS.has(e.event)).map(e=>[eventKey(e),actionFact(e)!])).values()].sort((a,b)=>a.event.at.getTime()-b.event.at.getTime()||a.event.sequenceNumber-b.event.sequenceNumber||a.event.id-b.event.id);
 const resultMap=new Map<string,DiscoveryResultRow[]>();for(const r of completeResults)resultMap.set(r.discovery_state_id,[...(resultMap.get(r.discovery_state_id)||[]),r]);
 const states=completeStates.map(s=>normalizeChoiceState(s,resultMap.get(s.discovery_state_id)||[])).sort((a,b)=>new Date(a.row.occurred_at).getTime()-new Date(b.row.occurred_at).getTime()||a.id.localeCompare(b.id)),stateMap=new Map(states.map(s=>[s.id,s]));
 const transitions:ChoiceTransitionFact[]=[];let ambiguous=0;
 for(let i=0;i<actions.length;i++){const a=actions[i],beforeRaw=a.event.payload.results_before,afterRaw=a.event.payload.results_after;if(beforeRaw==null||afterRaw==null||!a.sessionId)continue;const at=a.event.at.getTime(),next=actions.slice(i+1).find(x=>x.sessionId===a.sessionId)?.event.at.getTime()??Infinity;
  const before=states.filter(s=>s.sessionId===a.sessionId&&samePage(a.event,s)&&new Date(s.row.occurred_at).getTime()<=at&&at-new Date(s.row.occurred_at).getTime()<=5000&&s.resultCount===Number(beforeRaw));
  const after=states.filter(s=>s.sessionId===a.sessionId&&samePage(a.event,s)&&new Date(s.row.occurred_at).getTime()>=at&&new Date(s.row.occurred_at).getTime()<next&&new Date(s.row.occurred_at).getTime()-at<=5000&&s.resultCount===Number(afterRaw)&&(a.action==="remove"?!stateHas(s,a):a.action==="clear"?true:stateHas(s,a)));
  if(before.length===1&&after.length===1&&before[0].id!==after[0].id)transitions.push({id:`${before[0].id}->${after[0].id}`,action:a,fromState:before[0],toState:after[0],resultChange:after[0].resultCount-before[0].resultCount});else ambiguous++;
 }
 const outcomes:ChoiceOutcomeFact[]=[];for(const e of events.filter(e=>OUTCOME_EVENTS.has(e.event))){const state=stateMap.get(ptext(e,"source_discovery_state_id"));if(!state)continue;const stage=ptext(e,"view_stage");const kind=e.event==="product_impression"?"seen":e.event==="view_product"&&stage==="selection_click"?"product_open":e.event==="view_brand"&&stage==="selection_click"?"brand_open":e.event==="save_product"||e.event==="add_to_collection"||e.event==="share_product"?"saved":e.event==="outbound_product_click"?"product_outbound":e.event==="outbound_brand_click"?"brand_outbound":null;if(kind)outcomes.push({id:eventKey(e),event:e,state,kind})}
 return{actions,states,transitions,outcomes,diagnostics:{actionsLoaded:actions.length,actionsWithUsableValue:actions.filter(a=>a.usableValue).length,canonicalChoiceStates:states.length,strictLinkedTransitions:transitions.length,ambiguousTransitionsSuppressed:ambiguous,directStateOutcomes:outcomes.length,unknownFilterValues:actions.filter(a=>a.dimension==="other"&&ptext(a.event,"filter_name")!=="product_constraints").length}};
}

export type ChoiceRow={action:ChoiceActionFact["action"];dimension:ChoiceDimension;label:string;value:string;actions:number;visitors:number;availability:{observations:number;minimum:number;maximum:number}|null};
const rows=(actions:ChoiceActionFact[],transitions:ChoiceTransitionFact[])=>{const groups=new Map<string,ChoiceActionFact[]>();for(const a of actions){if(!a.usableValue)continue;const key=`${a.action}:${a.dimension}:${a.value}`;groups.set(key,[...(groups.get(key)||[]),a])}return[...groups.values()].map(xs=>{const linked=transitions.filter(t=>xs.some(x=>x.id===t.action.id)),counts=linked.map(x=>x.toState.resultCount);return{action:xs[0].action,dimension:xs[0].dimension,label:xs[0].label,value:xs[0].value,actions:xs.length,visitors:new Set(xs.map(x=>x.visitorId).filter(Boolean)).size,availability:counts.length?{observations:counts.length,minimum:Math.min(...counts),maximum:Math.max(...counts)}:null}}).sort((a,b)=>b.actions-a.actions||a.label.localeCompare(b.label,"bg"))};
export function buildChoicePresentation(domain:ChoiceDomain){const all=rows(domain.actions,domain.transitions),taxonomy=all.filter(r=>["category","subcategory","product_type"].includes(r.dimension)),giftActionIds=new Set(domain.actions.filter(a=>a.sourceContext==="gift_discovery"||["recipient","occasion"].includes(a.dimension)).map(a=>a.id)),filters=all.filter(r=>["price","material","color","attribute","delivery","giftable","clear","other"].includes(r.dimension)&&!domain.actions.some(a=>giftActionIds.has(a.id)&&a.action===r.action&&a.dimension===r.dimension&&a.value===r.value)),gift=rows(domain.actions.filter(a=>giftActionIds.has(a.id)),domain.transitions).filter(r=>!(r.dimension==="price"&&r.value==="all")),sort=all.filter(r=>r.dimension==="sort"),giftStateGroups=new Map<string,ChoiceStateFact[]>();for(const s of domain.states.filter(s=>s.facets.some(f=>["recipient","occasion"].includes(f.dimension)))){const facets=s.facets.filter(f=>["recipient","occasion","price","attribute"].includes(f.dimension)&&!(f.dimension==="price"&&f.value==="all")).sort((a,b)=>a.dimension.localeCompare(b.dimension)||a.value.localeCompare(b.value)),key=facets.map(f=>`${f.dimension}:${f.value}`).join("|");giftStateGroups.set(key,[...(giftStateGroups.get(key)||[]),{...s,facets}])}const giftStates=[...giftStateGroups.values()].map(xs=>({id:xs[0].id,facets:xs[0].facets,resultCount:xs.at(-1)!.resultCount,observations:xs.length}));const explicit=domain.actions.filter(a=>!["gift_tool","surprise"].includes(a.dimension));return{summary:{visitors:new Set(explicit.map(a=>a.visitorId).filter(Boolean)).size,actions:explicit.length,taxonomyValues:taxonomy.length,giftActions:domain.actions.filter(a=>giftActionIds.has(a.id)&&!(a.dimension==="price"&&a.value==="all")).length},taxonomy,filters,gift,sort,giftTool:domain.actions.filter(a=>a.dimension==="gift_tool").length,surprise:domain.actions.filter(a=>a.dimension==="surprise").length,giftStates,outcomeCounts:{seen:domain.outcomes.filter(x=>x.kind==="seen").length,productOpen:domain.outcomes.filter(x=>x.kind==="product_open").length,brandOpen:domain.outcomes.filter(x=>x.kind==="brand_open").length,productOutbound:domain.outcomes.filter(x=>x.kind==="product_outbound").length,brandOutbound:domain.outcomes.filter(x=>x.kind==="brand_outbound").length},diagnostics:domain.diagnostics};
}

export const choiceDimensionLabel=dimensionLabel;
export const choiceValueLabel=(dimension:ChoiceDimension,value:string)=>dimension==="clear"?"Изчистване на филтри":dimension==="other"?"Друг критерий":dimension==="giftable"?value==="true"?"Подходящо за подарък":value==="false"?"Без ограничение за подарък":value:dimension==="sort"?({"price-asc":"Цена: от ниска към висока","price-desc":"Цена: от висока към ниска","alpha-asc":"Име: А–Я","alpha-desc":"Име: Я–А",featured:"Препоръчано"} as Record<string,string>)[value]||"Друг начин на подреждане":dimension==="price"?value==="all"?"Всички цени":value==="0-25"?"До 25 €":value==="25-50"?"От 25 до 50 €":value==="50-100"?"От 50 до 100 €":value==="100+"?"Над 100 €":value.replace("-+","+"):value;
export const choicesWord=(n:number)=>n===1?"избор":"избора";
export const visitorsWord=(n:number)=>n===1?"посетител":"посетители";
export function choiceOrientation(summary:{visitors:number;actions:number},taxonomy:ChoiceRow[]){const base=`${summary.visitors} ${visitorsWord(summary.visitors)} ${summary.visitors===1?"е направил":"са направили"} ${summary.actions} ${choicesWord(summary.actions)}.`;const top=taxonomy[0],tied=top&&taxonomy[1]?.actions===top.actions;if(!top||tied)return`${base} Данните все още са твърде малко, за да ги приемаме като обща тенденция.`;const group=top.dimension==="category"?"категориите":top.dimension==="subcategory"?"подкатегориите":"типовете продукти";return`${base} Сред ${group} „${choiceValueLabel(top.dimension,top.label)}“ е избрано ${top.actions} пъти от ${top.visitors} ${visitorsWord(top.visitors)}, но данните все още са твърде малко, за да приемаме това като обща тенденция.`}
