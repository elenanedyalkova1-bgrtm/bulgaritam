export const DEAL_CATEGORIES = Object.freeze(["Аксесоари","Деца и бебе","Дом и интериор","Домашни любимци","Книги, игри и творчество","Здраве и грижа","Козметика","Облекло","Спорт и туризъм","Храна и напитки"]);
export const normalizeDealCategory = (value) => { const clean=String(value??"").trim(); return DEAL_CATEGORIES.includes(clean)?clean:null; };
const norm=(value)=>String(value??"").toLocaleLowerCase("bg").replace(/&(?:amp|bull);/g," ").replace(/[^\p{L}\p{N}]+/gu," ").trim();
const pathText=(value)=>{try{return norm(decodeURIComponent(new URL(String(value||"")).pathname));}catch{return "";}};
const has=(text,terms)=>terms.some((term)=>term instanceof RegExp?term.test(text):text.includes(term));
const RULES=Object.freeze({
  "Аксесоари":["пръстен","обици","обеци","колие","гривна","бижу","медальон","чанта","портфейл","диадема","вратовръзка",/\bring\b/u,/\bearrings?\b/u,/\bnecklace\b/u,/\bbracelet\b/u,/\bwallet\b/u],
  "Дом и интериор":["ароматна свещ","соева свещ","дифузер","спално бельо","чаршаф","хавлия","кърпа за баня","килим","керамична чаша","саксия","перилен препарат","препарат за",/\bcandle\b/u,/\bdiffuser\b/u,/\bbedding\b/u,/\bbath towel\b/u,/\bdetergent\b/u],
  "Домашни любимци":["кучешки повод","котешка ","за куче","за котка",/\bdog leash\b/u,/\bpet (?:bed|toy|collar)\b/u],
  "Книги, игри и творчество":["тефтер","тетрадка","планер","дневник","фотоалбум","настолна игра","пъзел",/\bnotebook\b/u,/\bplanner\b/u,/\bjournal\b/u,/\bboard game\b/u,/\bpuzzle\b/u],
  "Здраве и грижа":["хранителна добавка","билкова тинктура","пробиотик","капсули за",/\bdietary supplement\b/u,/\btincture\b/u,/\bprobiotic\b/u],
  "Козметика":["серум за лице","серум за коса","facial oil","масло за лице","крем за лице","крем за ръце","крем за тяло","шампоан","балсам за коса","душ гел","лосион за тяло","тоник за лице","мицеларна вода","парфюм","сапун за",/\bface serum\b/u,/\bfacial oil\b/u,/\bface cream\b/u,/\bshampoo\b/u,/\bconditioner\b/u,/\bbody lotion\b/u,/\bperfume\b/u],
  "Облекло":["рокля","риза","тениска","панталон","дънки","блуза","суитшърт","суичър","жилетка","дамско яке","мъжко яке","палто","бански","пижама","чорапи","боди с дълъг ръкав","боди с къс ръкав",/\bt shirt\b/u,/\bdress\b/u,/\bshirt\b/u,/\bhoodie\b/u,/\bjacket\b/u,/\bcoat\b/u,/\bpyjama\b/u],
  "Спорт и туризъм":["туристическа раница","палатка","спален чувал","йога постелка",/\bcamping tent\b/u,/\bsleeping bag\b/u,/\byoga mat\b/u],
  "Храна и напитки":["пчелен мед","мед от лавандула","мед от акация","шоколадови бонбони","ядлив шоколад","кафе на зърна","билков чай","плодов чай","бутилка вино",/\bedible chocolate\b/u,/\bherbal tea\b/u,/\bcoffee beans\b/u,/\bbottle of wine\b/u],
});
const CHILD=/(?:детск|бебеш|\bза бебе\b|0 1 м|\bkids?\b|\bbaby\b|\bnewborn\b)/u;
const CHILD_PRODUCT=/(?:игра|пижама|боди|панталон|дрех|четка за зъби|паста за зъби|мокри кърпи|одеяло|чорапи|шапка|\bgame\b|\bclothing\b)/u;
const GENERIC=/(?:\b(?:set|bundle|box|collection|combo|pack)\b|комплект|кутия|сет|колекция|пакет)/u;
export function classifyDealCategory(input={}) {
  const inherited=normalizeDealCategory(input.catalog_category); if(inherited)return {category:inherited,state:"CLEAR",method:"catalog_inheritance",reason:"authoritative curated Product category"};
  const title=norm(input.title), handle=pathText(input.product_url||input.url), description=norm(input.description), metadata=norm(input.product_metadata);
  if(!title||/^(?:test|shop all|one moment please|undefined)$/.test(title))return {category:null,state:"UNCLASSIFIED",method:"insufficient_evidence",reason:"no product identity"};
  const text=`${title} ${handle} ${description} ${metadata}`.trim();
  if(CHILD.test(text)&&CHILD_PRODUCT.test(text))return {category:"Деца и бебе",state:"CLEAR",method:"product_semantics",reason:"explicit child/baby product identity"};
  const hits=Object.entries(RULES).filter(([,terms])=>has(text,terms)).map(([category])=>category);
  if(hits.length!==1)return {category:null,state:hits.length?"QUESTIONABLE":"UNCLASSIFIED",method:hits.length?"conflicting_evidence":"insufficient_evidence",reason:hits.length?`conflicting signals: ${hits.join(" + ")}`:"insufficient product-specific evidence"};
  if(GENERIC.test(text)&&!has(title,RULES[hits[0]]))return {category:null,state:"UNCLASSIFIED",method:"generic_bundle",reason:"generic bundle/box without clear title identity"};
  return {category:hits[0],state:"CLEAR",method:"product_semantics",reason:`clear ${hits[0]} product identity`};
}
