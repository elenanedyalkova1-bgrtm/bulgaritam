import fs from "node:fs";
import path from "node:path";

const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts/generate-primary-cluster-landings.mjs <csv>");
const refreshContentOnly = input === "--refresh-content";

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
const h1OverridesByRow = {
  1: "Българско дамско бельо от памук",
  6: "Дамски ленени ризи", 19: "Български обувки от естествена кожа",
  20: "Български сандали от естествена кожа", 21: "Български кожени якета",
  33: "Бохо рокли", 36: "Вечерни рокли", 39: "Дънкови рокли", 45: "Ленени рокли", 46: "Български официални рокли", 49: "Сатенени рокли",
  65: "Козметика против бръчки", 69: "Българска козметика с розово масло",
  73: "Подарък за бебе момиченце", 74: "Подарък за бебе момченце",
  97: "Подарък за учителка за 8 март", 99: "Подарък за дипломиране на жена",
  100: "Подарък за имен ден на жена", 101: "Подарък за пенсиониране на жена",
  102: "Подарък за жена за Свети Валентин", 104: "Подарък за 30-годишна жена",
  105: "Подарък за 50-годишна жена", 106: "Подарък за 60-годишна жена",
  107: "Подарък за 70-годишна жена", 108: "Подарък за 80-годишна жена",
  109: "Подарък за спортуваща жена", 116: "Подарък за дипломиране на мъж",
  117: "Подарък за пенсиониране на мъж", 121: "Подарък за мъж, който обича да готви",
  122: "Подарък за ловец", 123: "Подарък за 20-годишен мъж", 124: "Подарък за 25-годишен мъж",
  125: "Подарък за 30-годишен мъж", 126: "Подарък за 40-годишен мъж",
  127: "Подарък за 50-годишен мъж", 128: "Подарък за 60-годишен мъж",
  129: "Подарък за 70-годишен мъж", 130: "Подарък за 80-годишен мъж",
  131: "Подарък за рибар", 132: "Подарък за спортуващ мъж",
  135: "Подарък за 20 години от сватбата", 136: "Подарък за 10 години от сватбата",
  137: "Подарък за 40 години от сватбата", 144: "Бижута с диаманти",
  156: "Годежни пръстени с диамант", 158: "Гривни с буква",
  159: "Гривни с име", 160: "Гривни с кръст", 161: "Гривни с червен конец",
  164: "Златни пръстени", 165: "Златни пръстени с диамант", 166: "Златни пръстени с рубин",
  167: "Златни гривни", 171: "Златни колиета с диамант", 172: "Златни колиета с перла",
  180: "Гривни с тигрово око", 181: "Гривни с хематит", 182: "Гривни с цитрин",
};
const normalizeDisplayH1 = ({ h1, sourceRow }) => h1OverridesByRow[sourceRow] || clean(h1)
  .replace(/^Рокля сатен$/i, "Сатенени рокли")
  .replace(/^Черени палта$/i, "Черни палта");
const hasState = (state, field) => valuesFor(state, field).length > 0;
const landingFamily = (state) => {
  if (state.giftable?.includes("true") || hasState(state, "recipient") || hasState(state, "gift_occasion")) return "gift";
  if (state.subcategory?.some((value) => /бижута/i.test(value))) return "jewelry";
  if (state.category?.includes("Козметика") || state.subcategory?.some((value) => /грижа/i.test(value))) return "cosmetics";
  if (state.category?.includes("Облекло")) return "clothing";
  if (state.category?.includes("Дом и интериор")) return "home";
  if (state.category?.includes("Деца и бебе") || state.category?.includes("Книги, игри и творчество")) return "children";
  return "discovery";
};
const naturalList = (values) => joinBg(values.map((value) => lowerFirst(value)));
const titleFor = (h1, family, state) => {
  const tail = family === "gift" ? "идеи за подарък" : family === "jewelry" ? "материал и детайли"
    : family === "cosmetics" ? "грижа и състав" : family === "clothing" ? "модели и идеи"
      : family === "home" ? "за дома" : family === "children" ? "за деца и семейства" : "от български брандове";
  const expanded = `${h1} – ${tail} | Българитъм`;
  return expanded.length <= 60 ? expanded : `${h1} | Българитъм`;
};
const intentDetails = (state) => [
  hasState(state, "materials") && `материята ${naturalList(valuesFor(state, "materials"))}`,
  hasState(state, "colors") && `цвета ${naturalList(valuesFor(state, "colors"))}`,
  hasState(state, "season") && `сезона ${naturalList(valuesFor(state, "season"))}`,
  hasState(state, "sleeve") && `ръкава ${naturalList(valuesFor(state, "sleeve"))}`,
  hasState(state, "gemstone") && `камъка ${naturalList(valuesFor(state, "gemstone"))}`,
  hasState(state, "ingredient") && `съставката ${naturalList(valuesFor(state, "ingredient"))}`,
].filter(Boolean);
const buildContent = (h1, state, clusterKeywords, sourceRow) => {
  const family = landingFamily(state);
  const h1Lower = lowerFirst(h1);
  const details = intentDetails(state);
  let description = `Ориентир за ${h1Lower} от български брандове: какво да сравниш и къде да провериш подробностите за конкретния продукт.`;
  let intro = [];
  let editorialSections = [];

  if (family === "clothing") {
    const material = naturalList(valuesFor(state, "materials"));
    const color = naturalList(valuesFor(state, "colors"));
    const season = naturalList(valuesFor(state, "season"));
    const product = naturalList(valuesFor(state, "product_type")) || "облекло";
    description = `${h1}: сравни ${[material && "състава", color && "нюанса", season && "сезонността", "кройката и размерите"].filter(Boolean).join(", ")} в предложенията от български брандове.`;
    intro = [
      material
        ? `При ${h1Lower} съставът има значение наред с кройката и начина на носене.`
        : color
          ? `При ${h1Lower} цветът е на преден план, но силуетът, материята и детайлите остават също толкова важни.`
          : season
            ? `При ${h1Lower} сезонът насочва към подходящи материи и различни начини на комбиниране.`
            : `При ${h1Lower} можеш да сравниш ${product} според кройката, материята и повода.`,
      `При ${h1Lower} провери размерите, точния състав и указанията за поддръжка в информацията от бранда.`,
    ];
    editorialSections = [
      { title: material ? `Какво да знаеш за ${material}` : color ? `Как да избереш подходящия нюанс` : "Как да сравниш моделите", paragraphs: [
        material ? `Материя като ${material} може да присъства в различни смеси и плътности. За ${h1Lower} сравнявай реалния състав, а не само името на модела.` : `При ${h1Lower} започни от силуета и предназначението, след това сравни материята, дължината и детайлите.`,
        ...(clusterContentByRow[sourceRow] || []),
      ] },
      { title: "Размер, кройка и поддръжка", paragraphs: [`За ${h1Lower} използвай таблицата с размери на конкретния бранд и провери дали има специални указания за пране, гладене или съхранение.`] },
    ];
  } else if (family === "jewelry") {
    const product = naturalList(valuesFor(state, "product_type")) || "бижута";
    const material = naturalList(valuesFor(state, "materials"));
    const stone = naturalList(valuesFor(state, "gemstone"));
    const detail = naturalList(valuesFor(state, "jewelry_detail"));
    const jewelryComparisons = [
      hasState(state, "product_type") && product,
      material && `материала ${material}`,
      stone && `камъка ${stone}`,
      detail && `детайла ${detail}`,
      "размера и закопчаването",
    ].filter(Boolean);
    description = `${h1}: сравни ${jewelryComparisons.join(", ")} в информацията от бранда.`;
    intro = [
      stone
        ? `При ${h1Lower} ${stone} е водещият камък, а материалът и обковът допълват избора.`
        : material
          ? `При ${h1Lower} материалът ${material} е отправната точка, следвана от формата, размера и покритието.`
          : detail
            ? `При ${h1Lower} детайлът ${detail} определя темата, но материалът и конструкцията остават важни.`
            : `При ${h1Lower} сравни материала, формата, размера и начина на закопчаване.`,
      `Преди избор на ${h1Lower} провери точния материал, размерите и начина на поддръжка, посочени за конкретното бижу.`,
    ];
    editorialSections = [
      { title: stone ? `Камъкът и неговият обков` : material ? `Материал и покритие` : detail ? `Форма и декоративен детайл` : "Вид и изработка", paragraphs: [
        stone ? `При ${h1Lower} провери как е описан камъкът, как е закрепен и от какъв материал е основата на бижуто.` : material ? `При ${h1Lower} търси ясно посочен материал, проба или покритие. Близките на вид метали могат да изискват различна поддръжка.` : `При ${h1Lower} сравни размерите, теглото и конструкцията, а не само снимката.`,
        ...(clusterContentByRow[sourceRow] || []),
      ] },
      { title: "Размер и поддръжка", paragraphs: [`За ${h1Lower} провери дължината или размера, вида на закопчаването и препоръките на бранда за съхранение и почистване.`] },
    ];
  } else if (family === "gift") {
    const recipient = naturalList(valuesFor(state, "recipient").map((value) => value.replace(/^За\s+/i, "")));
    const occasion = naturalList(valuesFor(state, "gift_occasion"));
    const age = naturalList(valuesFor(state, "recipient_age").map((value) => `${value} години`));
    const interest = naturalList(valuesFor(state, "role_interest"));
    const giftContext = occasion ? `повода ${occasion}` : age ? `възрастта ${age}` : interest ? `интересите на получателя` : recipient ? `конкретния получател` : "човека и повода";
    description = `${h1}: идеи според ${giftContext}, с подробности за вариантите, персонализацията и доставката при бранда.`;
    intro = [
      `Изборът на ${h1Lower} започва от човека${occasion ? ` и повода ${occasion}` : ""}, а не от универсален списък с подаръци.`,
      `Когато търсиш ${h1Lower}, съобрази избора с интересите, ежедневието и начина на поднасяне; при персонализирани продукти провери и срока за изработка.`,
    ];
    editorialSections = [
      { title: age ? `Идея, съобразена с възрастта` : interest ? `Идея според интересите` : occasion ? `Подарък с мисъл за повода` : "Подарък с личен контекст", paragraphs: [
        `${h1} е по-смислен избор, когато отразява конкретния човек, вместо да разчита само на възраст, пол или общ повод.`,
        ...(clusterContentByRow[sourceRow] || []),
      ] },
      { title: "Преди да поръчаш", paragraphs: [`За ${h1Lower} провери размера, варианта, възможностите за персонализация и срока за доставка директно в сайта на бранда.`] },
    ];
  } else if (family === "cosmetics") {
    const area = naturalList(valuesFor(state, "subcategory"));
    const need = naturalList([...valuesFor(state, "skin_need"), ...valuesFor(state, "hair_need")]);
    const needPhrase = need.replace(/^против\s+/i, "грижа при ").replace(/^за\s+/i, "грижа за ");
    const skin = naturalList(valuesFor(state, "skin_type"));
    const ingredient = naturalList(valuesFor(state, "ingredient"));
    description = `${h1}: ориентирай се според ${[needPhrase, skin, ingredient && `съставката ${ingredient}`, !needPhrase && !skin && !ingredient && area].filter(Boolean).join(", ") || "вида грижа и състава"}.`;
    intro = [
      `При ${h1Lower} изборът се насочва към ${needPhrase || skin || area || "вида грижа"}${ingredient ? ` и присъствието на ${ingredient} в състава` : ""}.`,
      `При ${h1Lower} прочети начина на употреба и пълния INCI списък на конкретния продукт, особено ако имаш чувствителност или установена кожна нужда.`,
    ];
    editorialSections = [
      { title: ingredient ? `Как да разчетеш ролята на ${ingredient}` : need ? `Грижа според конкретната нужда` : "Място в ежедневната рутина", paragraphs: [
        ingredient ? `При ${h1Lower} провери къде се намира ${ingredient} в INCI списъка и как брандът описва начина на употреба.` : `При ${h1Lower} сравни предназначението, текстурата и начина на включване в рутината, без да приемаш общото име за гарантиран резултат.`,
        ...(clusterContentByRow[sourceRow] || []),
      ] },
      { title: "Състав и употреба", paragraphs: [`За ${h1Lower} следвай указанията на производителя и провери предупрежденията, честотата на употреба и съвместимостта с останалата част от рутината.`] },
    ];
  } else {
    const subject = naturalList(valuesFor(state, "product_type")) || naturalList(valuesFor(state, "subcategory")) || h1Lower;
    description = `${h1}: сравни предназначението, материалите, размерите и информацията за употреба в предложенията от български брандове.`;
    intro = [`При ${h1Lower} можеш да се ориентираш сред ${subject} според предназначението и изрично посочените характеристики.`, `За ${h1Lower} провери конкретните размери, материали и начин на употреба в информацията от бранда.`];
    editorialSections = [
      { title: family === "home" ? "Материал и място в дома" : family === "children" ? "Възраст и предназначение" : "Какво да сравниш", paragraphs: [`При ${h1Lower} сравни предназначението, размерите и материалите, които са изрично посочени за конкретния продукт.`, ...(clusterContentByRow[sourceRow] || [])] },
      { title: "Практични подробности", paragraphs: [`За ${h1Lower} провери поддръжката, указанията за безопасност или употреба и условията за доставка в сайта на бранда.`] },
    ];
  }

  return { title: titleFor(h1, family, state), description, intro, editorialSections, clusterKeywordsUsed: [] };
};

if (refreshContentOnly) {
  const registryPath = path.resolve("src/data/primary-cluster-landings.json");
  const auditPath = path.resolve("docs/primary-cluster-seo-audit.csv");
  const specs = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const refreshed = specs.map((spec) => {
    const h1 = normalizeDisplayH1(spec);
    return { ...spec, h1, ...buildContent(h1, spec.structuredState || {}, spec.clusterKeywords || [], spec.sourceRow) };
  });
  fs.writeFileSync(registryPath, JSON.stringify(refreshed, null, 2) + "\n");
  if (fs.existsSync(auditPath)) {
    const auditRows = parseCsv(fs.readFileSync(auditPath, "utf8"));
    const refreshedByPath = new Map(refreshed.map((spec) => [spec.path, spec]));
    const updatedRows = auditRows.map((row) => {
      const spec = refreshedByPath.get(normalizePath(row.canonical_url));
      return spec ? { ...row, H1: spec.h1, seo_title: spec.title, meta_description: spec.description } : row;
    });
    const headers = Object.keys(auditRows[0] || {});
    const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    fs.writeFileSync(auditPath, [headers.join(","), ...updatedRows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n") + "\n");
  }
  console.log(JSON.stringify({ refreshed: refreshed.length }, null, 2));
  process.exit(0);
}

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
  const rawH1 = number === 1 ? "Българско дамско памучно бельо" : number === 28 ? "Дамски памучни пижами" : number === 186 ? "Българско спално бельо" : clean(row.H1_target);
  const h1 = normalizeDisplayH1({ h1: rawH1, sourceRow: number });
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
