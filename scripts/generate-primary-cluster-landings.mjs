import fs from "node:fs";
import path from "node:path";

const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts/generate-primary-cluster-landings.mjs <csv>");

const parseCsv = (text) => {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ""; }
    else if (char === '\n') { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift().map((value) => value.replace(/^\uFEFF/, ""));
  return rows.filter((values) => values.some(Boolean)).map((values) => Object.fromEntries(headers.map((header, i) => [header, values[i] || ""])));
};

const clean = (value) => String(value || "").trim();
const splitTerms = (value) => clean(value).split(/\s*[·|]\s*/).map((term) => term.replace(/\s+[—-]\s+\d+.*$/, "").trim()).filter(Boolean);
const parseState = (value) => Object.fromEntries(clean(value).split(/\s*\+\s*/).map((part) => {
  const at = part.indexOf("=");
  return at < 0 ? null : [clean(part.slice(0, at)), clean(part.slice(at + 1)).split(/\s*\|\s*/).filter(Boolean)];
}).filter(Boolean));
const normalizePath = (value) => `/${clean(value).replace(/^\/+|\/+$/g, "")}/`;
const slugifyBg = (value) => clean(value).toLowerCase()
  .replace(/щ/g, "sht").replace(/ш/g, "sh").replace(/ч/g, "ch").replace(/ж/g, "zh").replace(/ц/g, "ts")
  .replace(/ю/g, "yu").replace(/я/g, "ya").replace(/ъ/g, "a").replace(/ь/g, "y")
  .replace(/[абвгдезийклмнопрстуфх]/g, (char) => ({ а:"a", б:"b", в:"v", г:"g", д:"d", е:"e", з:"z", и:"i", й:"y", к:"k", л:"l", м:"m", н:"n", о:"o", п:"p", р:"r", с:"s", т:"t", у:"u", ф:"f", х:"h" })[char])
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const keyFor = (row) => `primary_cluster_${row.row}`;
const canonicalOverrides = {
  87: "/podarak-za-dete-na-10-godini/", 88: "/podarak-za-dete-na-14-godini/",
  91: "/podarak-za-dete-na-4-godini/", 92: "/podarak-za-dete-na-7-godini/", 93: "/podarak-za-dete-na-9-godini/",
  98: "/podarak-za-zhena-za-8-mart/", 99: "/podarak-za-zhena-za-diplomirane/", 116: "/podarak-za-mazh-za-diplomirane/",
};

const parentByContext = [
  [/Деца и бебе.*Бебешка грижа/, "kids_cosmetics"], [/Деца и бебе.*Играчки/, "kids_toys"],
  [/Книги, игри и творчество.*Книги/, "fun_books"],
  [/Бельо/, "clothing_lingerie"], [/Дамско облекло/, "clothing_women"], [/Мъжко облекло/, "clothing_men"],
  [/Обувки/, "accessories_shoes"], [/Чанти/, "accessories_bags"], [/Бижута/, "accessories_jewelry"],
  [/Грижа за лицето|Лице/, "cosmetics_face"], [/Грижа за тялото|Тяло/, "cosmetics_body"],
  [/Грижа за косата|Коса/, "cosmetics_hair"], [/Грим/, "cosmetics_makeup"],
  [/За мъже/, "cosmetics_men"], [/Козметика/, "cosmetics"],
  [/За жена/, "gifts_for_her"], [/За мъж/, "gifts_for_him"], [/За дете/, "gifts_for_child"],
  [/За бебе/, "gifts_for_baby"], [/Сватба/, "gifts_for_wedding"], [/Подаръци/, "gifts"],
  [/Домашен текстил/, "home_textiles"], [/Дом и интериор/, "home"], [/Облекло/, "clothing"],
];
const parentFor = (row) => parentByContext.find(([pattern]) => pattern.test(row.taxonomy_context_hint || ""))?.[1] || null;
const lowerFirst = (value) => value ? value[0].toLocaleLowerCase("bg") + value.slice(1) : value;
const valuesFor = (state, field) => (state[field] || []).map(clean).filter(Boolean);
const joinBg = (values) => values.length < 2 ? (values[0] || "") : `${values.slice(0, -1).join(", ")} и ${values.at(-1)}`;
const fieldLabels = {
  materials: "материя", colors: "цвят", product_type: "вид продукт", gemstone: "камък",
  jewelry_detail: "детайл", clothing_style: "стил", season: "сезон", sleeve: "ръкав",
  ingredient: "съставка", skin_type: "тип кожа", skin_need: "нужда на кожата", hair_need: "нужда на косата",
  gift_occasion: "повод", recipient_age: "възраст", role_interest: "интерес", wedding_anniversary_type: "годишнина",
};
const clusterContentByRow = {
  2: ["При мъжките боксерки провери данните за произход, ако държиш на българско производство — присъствието на български бранд само по себе си не е достатъчно доказателство къде е изработен продуктът."],
  4: ["При български дамски блузи с дълъг ръкав сравни материята, плътността и кройката, защото еднаквата дължина на ръкава не означава еднакво усещане при носене."],
  6: ["Когато разглеждаш дамски ленени ризи онлайн, провери състава и указанията за поддръжка на конкретния модел, вместо да разчиташ единствено на снимката."],
  9: ["При избор на български спортни екипи онлайн сравни материята, кройката и предназначението. Ако за теб е важно българското производство, провери изрично посочения произход на продукта."],
  10: ["Сред българските дамски рокли можеш да сравняваш ежедневни и елегантни български рокли според повода, материята и силуета. Когато разглеждаш български рокли онлайн, провери размерите и детайлите на конкретния модел."],
  11: ["Когато търсиш качествени мъжки пижами онлайн, сравни състава, плътността и начина на закопчаване. При мъжките пижами с дълъг ръкав или с копчета тези детайли често са по-полезни от общото име на модела.", "Ако се интересуваш от мъжки памучни пижами, провери точния процент памук в състава — понятието памучни мъжки пижами не означава непременно еднаква материя при всеки продукт."],
  13: ["Българското дамско бельо и останалите модели в категорията могат да се различават по материя, конструкция и предназначение. При избор на качествено българско бельо сравни точния състав и указанията за поддръжка.", "Когато разглеждаш българско бельо онлайн, отвори страницата на конкретния модел и профила на бранда. Ако търсиш производители на българско бельо или фирми за българско бельо, провери дали произходът и ролята на бранда са изрично описани."],
  14: ["При дамските български боти сравни височината, подметката, материала и сезона. Така близки варианти като дамски боти от български брандове могат да бъдат разграничени по реалните им характеристики."],
  17: ["Когато сравняваш български марки маратонки, провери предназначението на модела, материала на горната част и информацията за подметката."],
  18: ["При българските мъжки боти от естествена кожа обърни внимание на подметката, подплатата и сезона. За мъжки чехли от естествена кожа сравни конструкцията и предназначението, защото това е различен тип обувка."],
  19: ["При търсене на качествени български обувки от естествена кожа използвай конкретни критерии: вид и обработка на материала, подметка, подплата и указания за поддръжка."],
  20: ["При българските дамски сандали от естествена кожа сравни конструкцията, подметката и начина на закопчаване. Определението дамски сандали от естествена кожа трябва да се потвърждава от състава на конкретния модел."],
  29: ["Ленените ризи за мъже могат да се сравняват по цвят, плътност и ръкав. При бели ленени мъжки ризи провери прозрачността и състава, а при летни мъжки ленени ризи — лекотата и указанията за поддръжка.", "Когато разглеждаш мъжки ленени ризи онлайн, използвай данните за размер и кройка. Мъжките ленени ризи с дълъг ръкав и мъжките ленени ризи с къс ръкав имат различно сезонно приложение."],
  30: ["Бални и абитуриентски рокли се сравняват най-полезно по силует, дължина, материя и повод. Когато разглеждаш бални рокли онлайн, провери размерите и детайлите на конкретната абитуриентска рокля."],
  33: ["Когато разглеждаш бохо рокли онлайн, сравни силуета, материята, дължината и начина, по който са оформени декоративните детайли."],
  35: ["При летни рокли българско производство провери изрично посочения произход и състав. Българският бранд не е автоматично доказателство, че всеки негов модел е произведен в България."],
  39: ["Когато разглеждаш дънкови рокли онлайн, сравни плътността и състава на денима, кройката и указанията за поддръжка."],
  45: ["Когато разглеждаш ленени рокли онлайн, провери точния състав, плътността, подплатата и размерите на конкретния модел."],
  46: ["При българските дълги официални рокли сравни дължината, силуета, материята и повода. Ако търсиш официални рокли на български дизайнери, отвори профила на бранда, за да провериш кой стои зад конкретния модел."],
  62: ["При избор на качествена българска козметика за лице сравни предназначението, типа кожа, начина на употреба и съставките. Български крем за лице и български хидратиращ крем за лице могат да имат различна текстура и насоченост.", "Определения като „хубав български крем за лице“ или „най-добрите български кремове за лице“ са субективни. По-надеждно е да провериш дали конкретният продукт е подходящ за твоята кожа и рутина."],
  69: ["При българска козметика с розово масло провери списъка със съставки и мястото на розовото масло в него, вместо да приемаш, че всяка козметика с роза използва еднаква форма или концентрация."],
  71: ["Българска био козметика, българска органична козметика и натурална био козметика не са автоматично взаимозаменяеми определения. Провери състава и наличната сертификационна информация за конкретния продукт."],
  78: ["Когато избираш подарък за погача за момче, съобрази възрастта, практичността и предпочитанията на семейството, без да приемаш, че цветът сам определя подходящия избор."],
  98: ["Подарък за учителка за 8 март може да бъде практичен, персонализиран или символичен. При подарък за учител за 8 март съобрази отношенията, повода и това дали изборът е подходящ за професионален контекст."],
  104: ["При подарък за 30-годишен юбилей на жена помисли за нейните интереси, ежедневие и начина, по който ще бъде поднесен подаръкът."],
  105: ["Когато избираш подарък за жена над 50, възрастта е само ориентир — интересите, поводът и практичността дават по-полезен контекст."],
  107: ["При подарък за 70-годишен юбилей на жена съобрази личните интереси, удобството и повода. Идеи за подарък за 70 годишен юбилей на жена са по-полезни, когато отчитат конкретния човек."],
  108: ["Подарък за 80-годишен юбилей на жена може да бъде избран според интересите, семейния контекст и това дали ще носи практична или емоционална стойност."],
  115: ["Гравиран подарък за мъж или подарък със снимка за мъж изисква проверка на възможностите за персонализация, срока за изработка и начина, по който ще изглежда крайният вариант."],
  118: ["При подарък за мъж за Св. Валентин съобрази отношенията и личния му стил. Подарък за Св. Валентин за мъж не е задължително да бъде традиционно романтичен, ако интересите му насочват към друг избор."],
  120: ["Оригинален подарък за рожден ден на мъж не означава непременно необичаен предмет — персоналният контекст, интересите и начинът на поднасяне често правят оригиналните подаръци по-смислени."],
  125: ["При подарък за 30-и рожден ден на мъж или подарък за юбилей на мъж на 30 години използвай възрастта като контекст, но избирай според интересите и начина му на живот."],
  127: ["Подарък за 50-годишен юбилей на мъж може да бъде практичен, персонализиран или свързан с негово занимание. При подарък за юбилей на мъж на 50 години интересите са по-надежден ориентир от възрастта сама по себе си."],
  128: ["При подарък за 60-годишен юбилей на мъж съобрази интересите, ежедневието и значението на повода. Идеи за подарък за 60 годишен юбилей на мъж са по-полезни, когато отразяват конкретния човек."],
  129: ["Когато избираш подарък за юбилей на мъж на 70 години, съобрази удобството, интересите и семейния контекст на празника."],
  130: ["При подарък за юбилей на мъж на 80 години практичността, личната история и начинът на поднасяне могат да бъдат по-важни от общите възрастови препоръки."],
  143: ["Медицинска стомана, неръждаема стомана и позлатена стомана не са взаимозаменяеми понятия. При бижута от неръждаема стомана или позлатени бижута от стомана провери точния материал и вида на покритието."],
  155: ["При български ръчно изработени бижута провери материалите и информацията за изработката на конкретния модел. Когато сравняваш качествени български бижута и български марки бижута, използвай проверими характеристики, а не само общи определения."],
  158: ["При гривнички с буква провери размера, материала, начина на закрепване на елемента и възможностите за персонализация."],
  161: ["Гривничките с червен конец могат да се различават по материал, закопчаване и допълнителни елементи; провери описанието на конкретния модел."],
  164: ["Когато разглеждаш златни пръстени онлайн, провери пробата, размера, теглото и дали продуктът съдържа допълнителен камък или декоративен елемент."],
  167: ["В каталог със златни гривни сравнявай пробата, размера, теглото и вида на закопчаването. При златни гривнички и златни гривни онлайн провери точните размери на конкретния модел."],
  168: ["Златен гердан и златно колие често се използват за близки продуктови търсения. В каталог със златни колиета сравнявай дължината, пробата, теглото и вида на закопчаването."],
  169: ["Когато разглеждаш златни обеци онлайн, сравни пробата, размера, теглото и вида на закопчаването на конкретния чифт."],
  174: ["При сребърен гердан или колие от сребро сравни пробата, дължината, теглото и вида на закопчаването."],
  175: ["Понятието мъжка бижутерия обхваща различни мъжки аксесоари и бижута. При луксозни мъжки бижута провери материала, изработката и реалните продуктови характеристики зад позиционирането."],
  183: ["При ароматни свещи от български бранд сравни вида на восъка, аромата, размера и указанията за безопасна употреба."],
  186: ["Ако търсиш български производители на спално бельо или български фирми за спално бельо, провери профила на бранда и посочения произход. Българският бранд не означава автоматично местно производство на всеки продукт."],
  187: ["При търсене на български производители на дървени играчки провери материала, възрастовите указания, информацията за безопасност и изрично посочения произход."],
  188: ["При детски книги от български автори провери възрастовата препоръка, темата, формата и информацията за автора и издателя."],
};
const describedFacets = (state) => Object.keys(fieldLabels).flatMap((field) => {
  const values = valuesFor(state, field);
  if (!values.length || field === "product_type") return [];
  const formatted = field === "recipient_age" ? values.map((value) => `${value} г.`) : values.map((value) => value.toLocaleLowerCase("bg"));
  return [`${fieldLabels[field]}: ${joinBg(formatted)}`];
});
const buildContent = (h1, state, clusterKeywords, sourceRow) => {
  const h1Lower = lowerFirst(h1);
  const isGift = state.giftable?.includes("true") || state.recipient?.length || state.gift_occasion?.length;
  const isJewelry = state.subcategory?.includes("Бижута") || state.subcategory?.includes("Мъжки бижута");
  const isCosmetics = state.category?.includes("Козметика") || state.subcategory?.some((value) => /грижа/i.test(value));
  const isClothing = state.category?.includes("Облекло");
  const facets = describedFacets(state);
  const facetText = facets.slice(0, 3).join("; ");
  let titleTail = "селекция от български брандове";
  let metaTail = "Сравни наличните предложения и отвори продуктовите страници за подробности.";
  let introOne = `Тук можеш да разгледаш „${h1}“ като самостоятелна продуктова селекция от български брандове.`;
  let introTwo = facetText
    ? `Селекцията е фокусирана върху ${facetText}; отвори конкретния продукт, за да провериш всички негови характеристики.`
    : "Разгледай отделните предложения и провери характеристиките, вариантите и информацията от бранда на продуктовата страница.";
  let sectionTitle = "Как да сравниш предложенията";
  let sectionParagraph = "Сравни предназначението и изрично посочените характеристики на всеки продукт. Общото име на селекцията не означава, че всички модели са еднакви.";
  if (isGift) {
    titleTail = state.gift_occasion?.length ? "идеи за конкретния повод" : state.recipient_age?.length ? "идеи според възрастта" : "идеи според получателя";
    const recipient = joinBg(valuesFor(state, "recipient").map((value) => value.replace(/^За\s+/i, "").toLocaleLowerCase("bg")));
    const occasion = joinBg(valuesFor(state, "gift_occasion").map((value) => value.toLocaleLowerCase("bg")));
    const ages = joinBg(valuesFor(state, "recipient_age").map((age) => `${age} години`));
    const context = [recipient && `получател: ${recipient}`, ages && `възраст: ${ages}`, occasion && `повод: ${occasion}`].filter(Boolean).join("; ");
    metaTail = context ? `Селекцията е насочена към ${context}.` : "Сравни идеи според човека, повода и предназначението им.";
    introTwo = "Помисли за повода, интересите и практичността на подаръка, а после отвори продукта за точните му характеристики.";
    introOne = `„${h1}“ събира идеи, насочени към конкретен получател, възраст или повод.`;
    sectionTitle = "Избор според човека и повода";
    sectionParagraph = "Полезният избор започва от получателя и повода. Сравни предназначението, персонализацията и реалните продуктови детайли, когато са налични.";
  } else if (isJewelry) {
    titleTail = state.gemstone?.length ? "бижута според камъка" : state.jewelry_detail?.length ? "бижута според детайла" : "модели по вид и материал";
    sectionTitle = "Вид, материал и детайл";
    sectionParagraph = "При бижутата разгледай отделно вида, материала, камъка и декоративния детайл. Те описват различни характеристики и не трябва да се заменят една с друга.";
    introOne = `В „${h1}“ са събрани бижута според конкретния вид, материал, камък или декоративен детайл.`;
  } else if (isCosmetics) {
    titleTail = state.hair_need?.length || state.skin_need?.length ? "грижа според нуждата" : state.ingredient?.length ? "продукти според съставката" : "продукти по вид грижа";
    sectionTitle = "Избор според вида грижа";
    sectionParagraph = "Съобрази избора с зоната на приложение, нуждата и съставките, които са изрично посочени за продукта. Провери пълната информация на продуктовата страница.";
    introOne = `„${h1}“ обединява козметични продукти според зоната на приложение, съставката или посочената нужда.`;
  } else if (isClothing) {
    titleTail = state.materials?.length ? "материи и модели" : state.colors?.length ? "цветове и модели" : "модели по вид и стил";
    sectionTitle = "Материя, кройка и предназначение";
    sectionParagraph = "Сравни материята, сезона, ръкава и стила само когато са попълнени за конкретния модел. Така близки категории остават ясно разграничени.";
    introOne = `В „${h1}“ можеш да разгледаш облекло, обединено от конкретен вид, материя, цвят, сезон или стил.`;
  }
  const title = `${h1} – ${titleTail} | Българитъм`;
  const descriptionVariants = [
    `Разгледай ${h1Lower} от български брандове. ${metaTail}`,
    `Открий ${h1Lower} на едно място. ${metaTail}`,
    `${h1} в подредена продуктова селекция. ${metaTail}`,
    `Търсиш ${h1Lower}? ${metaTail}`,
    `Виж предложения за ${h1Lower}. ${metaTail}`,
    `Ориентирай се сред предложенията за ${h1Lower}. ${metaTail}`,
    `Селекция за ${h1Lower} от български брандове. ${metaTail}`,
    `Намери ${h1Lower} и прегледай подробностите за всеки продукт. ${metaTail}`,
    `Разгледай темата „${h1}“ и сравни подходящите предложения. ${metaTail}`,
    `Открий продукти в селекцията „${h1}“. ${metaTail}`,
    `Сравни предложения в категорията „${h1}“. ${metaTail}`,
    `Прегледай селекцията „${h1}“ от български брандове. ${metaTail}`,
  ];
  const intro = [
    introOne,
    introTwo,
  ];
  const editorialSections = [
    { title: sectionTitle, paragraphs: [sectionParagraph, facetText ? `За тази селекция са важни следните ориентири: ${facetText}. Провери ги и в описанието на конкретния продукт.` : "Използвай наличните характеристики като отправна точка и провери подробностите за конкретното предложение.", ...(clusterContentByRow[sourceRow] || [])] },
    { title: isGift ? "Преди да избереш подарък" : isJewelry ? "Преди да избереш бижу" : isCosmetics ? "Преди да избереш продукт" : isClothing ? "Преди да избереш модел" : "Преди да избереш", paragraphs: ["Провери предназначението, варианта и информацията от бранда. Запази подходящите предложения, за да ги сравниш спокойно."] },
  ];
  return {
    title,
    description: descriptionVariants[(sourceRow - 1) % descriptionVariants.length],
    intro,
    editorialSections,
    clusterKeywordsUsed: [],
  };
};

const rows = parseCsv(fs.readFileSync(input, "utf8"));
const accepted = [];
const audit = [];
const seenStates = new Map();
for (const row of rows) {
  const number = Number(row.row);
  const existing = clean(row.existing_confirmed_url);
  const candidate = existing || clean(row.source_candidate_url_only);
  const state = parseState(row.suggested_filter_state);
  if (number === 11 || number === 28) state.product_type = ["Пижами и домашни комплекти"];
  if (number === 15 || number === 16) state.product_type = ["Чехли"];
  if (number === 31) state.colors = ["Бежов"];
  if (number === 186) Object.assign(state, { category: ["Дом и интериор"], subcategory: ["Домашен текстил"], product_type: ["Спално бельо"] });
  if ((number >= 104 && number <= 108) || (number >= 123 && number <= 130)) {
    const age = row.primary_keyword_input.match(/(?:на|за)\s+(\d{1,2})(?:\s|$)/)?.[1];
    if (age) state.recipient_age = [age];
  }
  const canonicalUrl = normalizePath(canonicalOverrides[number] || candidate || slugifyBg(row.primary_keyword_input));
  let action = existing ? "REUSE" : "CREATE";
  let reason = existing ? "Existing canonical landing reused and enriched from the approved registry." : "Exact structured state registered as a canonical SEO landing.";
  if (number === 16) { action = "MERGE"; reason = "Duplicate intent merged into CSV row 15."; }
  if ([3,6,7,8,29].includes(number)) state.product_type = ["Ризи"];
  if ([4,5].includes(number)) state.product_type = ["Блузи"];
  if ([21,22,26].includes(number)) state.product_type = ["Якета"];
  if ([23,24,25,27].includes(number)) state.product_type = ["Палта"];
  const normalizedState = Object.entries(state).sort(([a],[b]) => a.localeCompare(b)).map(([field, values]) => `${field}=${[...new Set(values.map(clean))].sort().join("|")}`).join("&");
  if ((action === "CREATE" || action === "REUSE") && normalizedState) {
    const prior = seenStates.get(normalizedState);
    if (prior && prior.canonicalUrl !== canonicalUrl) {
      action = "MERGE";
      reason = `Exact structured state already resolves to ${prior.canonicalUrl}.`;
    } else seenStates.set(normalizedState, { canonicalUrl, number });
  }
  const h1 = number === 1 ? "Българско дамско памучно бельо" : number === 28 ? "Дамски памучни пижами" : number === 186 ? "Българско спално бельо" : clean(row.H1_target);
  const clusterKeywords = splitTerms(row.recommended_cluster_terms_to_use_naturally).filter((term) => term !== "—");
  const content = buildContent(h1, state, clusterKeywords, number);
  const spec = {
    key: keyFor(row), path: canonicalUrl, primaryKeyword: clean(row.primary_keyword_input), h1,
    title: content.title, description: content.description, intro: content.intro, editorialSections: content.editorialSections,
    structuredState: state, parentKey: number === 186 ? "home_textiles" : parentFor(row),
    clusterKeywords, clusterKeywordsUsed: content.clusterKeywordsUsed, sourceRow: number,
  };
  if (action === "CREATE" || action === "REUSE") accepted.push(spec);
  audit.push({ _row: number,
    primary_keyword: clean(row.primary_keyword_input), action, canonical_url: action === "MERGE" ? (number === 16 ? normalizePath(rows.find((item) => Number(item.row) === 15).source_candidate_url_only) : reason.match(/\/[^ ]+\//)?.[0] || "") : canonicalUrl,
    H1: h1, seo_title: content.title, meta_description: spec.description,
    structured_state: normalizedState, parent: spec.parentKey || "", cluster_keywords_used: content.clusterKeywordsUsed.join(" | "),
    matching_products_count: "", intro_content_status: "READY", collapsible_content_status: "READY", merged_into: action === "MERGE" ? (number === 16 ? "row 15" : reason.match(/\/[^ ]+\//)?.[0] || "") : "", reason,
  });
}

const byCanonical = new Map();
audit.filter((entry) => entry.action === "CREATE" || entry.action === "REUSE").forEach((entry) => {
  const entries = byCanonical.get(entry.canonical_url) || [];
  entries.push(entry);
  byCanonical.set(entry.canonical_url, entries);
});
for (const [canonicalUrl, entries] of byCanonical) {
  if (entries.length < 2) continue;
  entries.forEach((entry) => {
    entry.action = "BLOCK";
    entry.reason = `Canonical URL collision: ${canonicalUrl} is proposed for multiple distinct structured states.`;
  });
}
const acceptedRows = new Set(audit.filter((entry) => entry.action === "CREATE" || entry.action === "REUSE").map((entry) => entry._row));
const finalAccepted = accepted.filter((entry) => acceptedRows.has(entry.sourceRow));

const dataDir = path.resolve("src/data");
const docsDir = path.resolve("docs");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, "primary-cluster-landings.json"), JSON.stringify(finalAccepted, null, 2) + "\n");
const columns = Object.keys(audit[0]).filter((column) => column !== "_row");
const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
fs.writeFileSync(path.join(docsDir, "primary-cluster-seo-audit.csv"), [columns.join(","), ...audit.map((entry) => columns.map((column) => csvCell(entry[column])).join(","))].join("\n") + "\n");
console.log(JSON.stringify({ total: rows.length, accepted: finalAccepted.length, actions: audit.reduce((counts, row) => ({ ...counts, [row.action]: (counts[row.action] || 0) + 1 }), {}) }, null, 2));
