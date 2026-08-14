const token = process.env.BASEROW_API_TOKEN;
if (!token) throw new Error("BASEROW_API_TOKEN is required");

const clean = (v) => String(v ?? "").trim();
const norm = (v) => clean(v).toLowerCase().replace(/[\/_.,;:!?()[\]{}"'`´’“”+-]+/g, " ").replace(/\s+/g, " ");
const includes = (text, terms) => terms.some((term) => {
  const t = norm(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${t}(?=$|\\s)`).test(text);
});
const unique = (a) => [...new Set(a.filter(Boolean))];
const rules = (pairs, text) => pairs.find(([, terms]) => includes(text, terms))?.[0] || "";

async function loadRows() {
  const rows=[]; let next="https://api.baserow.io/api/database/rows/table/906650/?user_field_names=true&size=200";
  while(next){const r=await fetch(next,{headers:{Authorization:`Token ${token}`}});if(!r.ok)throw new Error(`${r.status} ${await r.text()}`);const d=await r.json();rows.push(...d.results);next=d.next;}
  return rows.filter((r)=>clean(r.slug)&&clean(r.name_bg));
}

const TYPE_RULES = {
  "Козметика": [
    ["Шампоан",["шампоан","shampoo"]],["Маска за коса",["маска за коса","hair mask"]],["Серум за коса",["серум за коса","hair serum"]],
    ["Балсам за коса",["балсам за коса","conditioner"]],["Крем за лице",["крем за лице","дневен крем","нощен крем","face cream"]],
    ["Серум за лице",["серум за лице","face serum","serum"]],["Почистващ продукт за лице",["почистващ гел","почистващо масло","пяна за лице","cleanser"]],
    ["Тонер",["тонер","тоник за лице"]],["Ексфолиант",["ексфолиант","gommage"]],["Балсам",["балсам","мехлем"]],
    ["Сапун",["сапун"]],["Олио за тяло",["олио за тяло","body oil"]],["Лосион за тяло",["лосион за тяло","body lotion"]],
    ["Душ продукт",["душ гел","shower gel"]],["Дезодорант",["дезодорант","део стик"]],["Грим",["червило","сенки за очи","грим"]],
    ["Парфюм",["парфюм","perfume"]],["Комплект козметика",["комплект","сет","ритуал","routine"]],
  ],
  "Дом и интериор": [
    ["Спално бельо",["спално бельо","спален комплект","чаршаф","плик за завивка"]],["Свещ",["свещ","candle"]],
    ["Осветление",["лампа","абажур"]],["Картина и стенно изкуство",["картина","стенно изкуство","постер"]],["Съд и чаша",["чаша","купа","съдове"]],
    ["Кашпа и саксия",["кашпа","саксия"]],["Домашен текстил",["кърпа","хавлия","пештемал","възглавница","текстил"]],
    ["Почистващ препарат",["препарат","веро","прах за пране","съдомиялна"]],["Декорация",["декор","декорация","ваза"]],
  ],
  "Деца": [
    ["Детска играчка",["играчка","монтесори","кула","щанд","работилница","карти научи","рисуване и игра","мече"]],
    ["Детски мебели",["гардероб","помощна кула","маса","столче"]],["Бебешки текстил",["гнездо","повивалник","спално бельо","комплект за кошара","комплект за количка","възглавница за кърмене"]],
    ["Бебешка козметика",["бебешки балсам","бебешко балсамче","бебешки сапун","сапун бебчо","крем против подсичане"]],
    ["Детска книга и дневник",["детски дневник","бебешки спомени","дневник","книга","четящо устройство"]],
    ["Детско облекло",["детска тениска","детско облекло","панталон","къси панталонки"]],["Бебешки аксесоар",["несесер","порт за изписване"]],
  ],
  "Облекло": [
    ["Тениска",["тениска","t shirt"]],["Риза",["риза","shirt"]],["Рокля",["рокля","dress"]],["Палто",["палто","trench"]],
    ["Сако",["сако","blazer"]],["Жилетка",["жилетка","cardigan"]],["Панталон",["панталон"]],["Кимоно",["кимоно"]],["Пижама",["пижама"]],
  ],
  "Аксесоари": [
    ["Обеци",["обеци","earrings"]],["Колие",["колие","necklace"]],["Гривна",["гривна","bracelet"]],["Колан",["колан","belt"]],
    ["Чанта",["чанта","bag"]],["Портфейл",["портфейл","портмоне"]],["Шапка",["шапка","барета","hat"]],["Аксесоар за коса",["диадема","кърпа за коса","кърпа за глава"]],
  ],
  "Здраве и грижа": [
    ["Тинктура",["тинктура"]],["Гъбен екстракт",["гъби спрей","кордицепс","рейши","чага","лъвска грива","микс от гъби"]],
    ["Чай",["чай"]],["Хранителна добавка",["хранителна добавка","витамини","omega","омега"]],["Балсам и мехлем",["балсам","мехлем","крем против болки"]],
  ],
  "Забавление": [
    ["Дневник и планер",["дневник","планер"]],["Фотоалбум",["албум"]],["Книга",["книга","четене"]],["Игра",["игра","табла"]],["Арт продукт",["картина","изкуство"]],
  ],
  "Домашни любимци": [["Грижа за домашни любимци",["мехлем","парфюм","грижа"]]],
  "Подаръци": [["Подаръчен комплект",["комплект","сет","кутия"]],["Сватбен продукт",["сватба","младоженци"]],["Персонализиран подарък",["персонализиран"]]],
};

const SUBCATEGORY_BY_TYPE = {
  "Шампоан":"Коса","Маска за коса":"Коса","Серум за коса":"Коса","Балсам за коса":"Коса",
  "Крем за лице":"Лице","Серум за лице":"Лице","Почистващ продукт за лице":"Лице","Тонер":"Лице","Ексфолиант":"Лице",
  "Олио за тяло":"Тяло","Лосион за тяло":"Тяло","Душ продукт":"Тяло","Дезодорант":"Тяло","Сапун":"Тяло","Балсам":"Тяло","Грим":"Грим","Парфюм":"Парфюми","Комплект козметика":"Комплекти",
  "Спално бельо":"Домашен текстил","Домашен текстил":"Домашен текстил","Свещ":"Декорация","Осветление":"Декорация","Картина и стенно изкуство":"Декорация","Кашпа и саксия":"Декорация","Декорация":"Декорация","Съд и чаша":"Кухня","Почистващ препарат":"Почистване",
  "Детска играчка":"Играчки","Детски мебели":"Детски мебели и текстил","Бебешки текстил":"Детски мебели и текстил","Бебешка козметика":"Детска козметика","Детска книга и дневник":"Детски книги","Детско облекло":"Детско облекло","Бебешки аксесоар":"Бебешки аксесоари",
  "Тениска":"Дамско/мъжко облекло","Риза":"Дамско/мъжко облекло","Рокля":"Дамско облекло","Палто":"Дамско/мъжко облекло","Сако":"Дамско/мъжко облекло","Жилетка":"Дамско/мъжко облекло","Панталон":"Дамско/мъжко облекло","Кимоно":"Дамско облекло","Пижама":"Дамско/мъжко облекло",
  "Обеци":"Бижута","Колие":"Бижута","Гривна":"Бижута","Колан":"Колани","Чанта":"Чанти","Портфейл":"Чанти и портфейли","Шапка":"За глава","Аксесоар за коса":"За глава",
  "Тинктура":"Добавки и екстракти","Гъбен екстракт":"Добавки и екстракти","Чай":"Чай и билки","Хранителна добавка":"Добавки и екстракти","Балсам и мехлем":"Грижа",
  "Дневник и планер":"Книги и хартия","Фотоалбум":"Книги и хартия","Книга":"Книги","Игра":"Игри","Арт продукт":"Изкуство",
  "Грижа за домашни любимци":"Грижа","Подаръчен комплект":"Подаръчни комплекти","Сватбен продукт":"За сватба","Персонализиран подарък":"Персонализирани подаръци",
};

const rows=await loadRows();
const mappings=[];
for(const row of rows){
  const category=clean(row.category); const tags=clean(row.tags).split(",").map(clean).filter(Boolean);
  const keywordText=norm([category,...tags,row.name_bg].join(" | ")); const fullText=norm([category,...tags,row.name_bg,row.short_desc_bg,row.long_desc_bg].join(" | "));
  const product_type=rules(TYPE_RULES[category]||[],keywordText); const subcategory=SUBCATEGORY_BY_TYPE[product_type]||"";
  const explicitGift=includes(fullText,["подарък","подаръци","подаръчен","подаръчна","gift","идеален подарък","подходящ подарък"] )||category==="Подаръци";
  const weakGift=!explicitGift&&includes(keywordText,["комплект","комплекти","сет","bundle","за нея","за него","персонализиран"]);
  const recipient=[];
  if(includes(fullText,["подарък за жена","подаръци за жена","за нея"]))recipient.push("За жена");
  if(includes(fullText,["подарък за мъж","подаръци за мъж","за него"]))recipient.push("За мъж");
  if(includes(fullText,["подарък за бебе","за бебе","новородено"]))recipient.push("За бебе");
  if(includes(fullText,["подарък за дете","за дете","за деца"]))recipient.push("За дете");
  if(includes(fullText,["за младоженци","подарък за двойка"]))recipient.push("За двойка");
  const occasions=[];
  if(includes(fullText,["сватба","сватбен","младоженци"]))occasions.push("Сватба");
  if(includes(fullText,["рожден ден","birthday"]))occasions.push("Рожден ден");
  if(includes(fullText,["новородено","изписване"]))occasions.push("Новородено/изписване");
  if(includes(fullText,["коледа","christmas"]))occasions.push("Коледа");
  if(includes(fullText,["кръщене"]))occasions.push("Кръщене");
  if(includes(fullText,["нов дом","ново жилище","housewarming"]))occasions.push("Нов дом");
  if(includes(fullText,["свети валентин","валентин","valentine"]))occasions.push("Свети Валентин");
  const attributes=[];
  if(includes(fullText,["ръчна изработка","ръчно изработен","ръчно изработена","handmade"]))attributes.push("Ръчна изработка");
  if(includes(fullText,["натурален","натурална","натурално","натурални","natural"]))attributes.push("Натурален");
  if(includes(fullText,["сертифициран био","био сертифициран","сертифицирана био","certified organic","organic certified"]))attributes.push("Био сертифициран");
  if(includes(fullText,["еко","eco","устойчив","устойчиво","биоразградим","reusable","многократен","рециклируем","zero waste","plastic free"]))attributes.push("Еко");
  if(includes(fullText,["веган","vegan"]))attributes.push("Веган");
  if(includes(fullText,["органичен памук","органична памучна","organic cotton"]))attributes.push("Органичен памук");
  if(includes(fullText,["персонализиран","персонализирана","по избор","с име","с надпис"]))attributes.push("Персонализируем");
  const reasons=[]; if(!product_type)reasons.push("неясен product_type");if(!subcategory)reasons.push("неясна subcategory");if(weakGift)reasons.push("слаб/двусмислен подаръчен сигнал");
  if(includes(fullText,["био","bio","organic","органичен","органична"])&&!attributes.includes("Био сертифициран")&&!attributes.includes("Органичен памук"))reasons.push("био/organic без доказателство за сертификация");
  mappings.push({id:row.id,slug:clean(row.slug),name:clean(row.name_bg),category,tags,suggestion:{subcategory,product_type,giftable:explicitGift,recipient:unique(recipient),gift_occasion:unique(occasions),attributes:unique(attributes)},confidence:reasons.length?"manual_review":"confident",review_reasons:reasons});
}
const confident=mappings.filter(x=>x.confidence==="confident");const review=mappings.filter(x=>x.confidence==="manual_review");
const values=(field)=>unique(mappings.flatMap(x=>Array.isArray(x.suggestion[field])?x.suggestion[field]:[x.suggestion[field]])).filter(v=>v!=="").sort((a,b)=>String(a).localeCompare(String(b),"bg"));
console.log(JSON.stringify({total:mappings.length,confident:confident.length,manual_review:review.length,allowed_values:{subcategory:values("subcategory"),product_type:values("product_type"),giftable:[false,true],recipient:values("recipient"),gift_occasion:values("gift_occasion"),attributes:values("attributes")},giftable_true:mappings.filter(x=>x.suggestion.giftable).length,examples:review.slice(0,20).map(({id,slug,name,category,suggestion,review_reasons})=>({id,slug,name,category,suggestion,review_reasons})),all_mappings:mappings},null,2));
