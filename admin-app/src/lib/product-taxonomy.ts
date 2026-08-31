export const PRODUCT_TAXONOMY = {
  "Аксесоари": {
    "Бижута": ["Гривни", "Колиета", "Комплекти бижута", "Обеци", "Пръстени"],
    "Чанти и портфейли": ["Чанти"],
    "Булчински аксесоари": ["Воали и ръкавици"],
    "Аксесоари за коса": ["Диадеми"],
    "Мъжки аксесоари": ["Папионки и вратовръзки", "Портфейли и кардхолдъри", "Ръкавели и игли"],
    "Мъжки бижута": ["Гривни", "Пръстени"],
    "Колани": [],
    "Шапки": [],
    "Шалове и кърпи": [],
  },
  "Деца и бебе": {
    "Детско облекло": ["Жилетки", "Панталони", "Пижами и домашни комплекти", "Рокли", "Тениски и потници"],
    "Бебешка грижа": ["Бебешка хигиена", "Кремове и балсами за бебе"],
    "Играчки": ["Образователни игри", "Плюшени играчки", "Ролеви и въображаеми игри"],
    "Бебешки текстил": ["Бебешки гнезда", "Бебешко спално бельо", "Възглавници за кърмене", "Комплекти за количка", "Комплекти за кошара", "Комплекти за новородено", "Несесери", "Повивалници", "Портове за изписване"],
    "Бебешки и детски дневници": [],
    "Детски текстил": ["Възглавници", "Детски хавлии и халати"],
    "Детски мебели": ["Гардероби", "Палатки за игра", "Помощни кули"],
  },
  "Дом и интериор": {
    "Аромати за дома": ["Ароматни дифузери", "Ароматни свещи"],
    "Почистване": ["Комплекти почистващи препарати", "Препарати за прозорци", "Препарати за съдове", "Препарати за съдомиялна"],
    "Домашен текстил": ["Спално бельо"],
    "Баня": ["Хавлии и халати"],
    "Кухня и трапезария": ["Кухненски текстил", "Чаши", "Чинии и прибори"],
    "Декорация": ["Картини и стенно изкуство", "Кашпи и саксии"],
    "Осветление": ["Настолни лампи"],
    "Офис пространство": [],
  },
  "Домашни любимци": {
    "Грижа и хигиена": ["Парфюми за домашни любимци", "Балсами и мехлеми за домашни любимци"],
    "Легла и текстил": [],
  },
  "Книги, игри и творчество": {
    "Албуми и хартиени продукти": ["Картички", "Фотоалбуми"],
    "Книги": ["Аксесоари за четене", "Български автори", "Детски книги"],
    "Творчески комплекти": ["За оцветяване"],
    "Настолни игри": [],
    "Дневници и планери": ["Дневници", "Планери"],
    "Декорация": ["Картини и стенно изкуство"],
  },
  "Здраве и грижа": {
    "Добавки и екстракти": ["Гъбени екстракти", "Тинктури", "Хранителни добавки"],
    "Чай и билки": [],
  },
  "Козметика": {
    "Грижа за лицето": ["Кремове за лице", "Серуми за лице", "Почистващи продукти за лице", "Околоочни серуми", "Тонери", "Ексфолианти за лице"],
    "Грижа за тялото": ["Дезодоранти", "Ексфолианти за тяло", "Кремове за ръце", "Олиа, лосиони и балсами", "Олиа, лосиони и балсами за тяло", "Сапуни и душ гелове"],
    "Грижа за косата": ["Шампоани", "Маски за коса", "Серуми за коса"],
    "Парфюми": [],
    "Козметични комплекти": [],
    "Грим": ["Червила", "Сенки за очи"],
    "Грижа за устните": ["Балсами за устни"],
  },
  "Облекло": {
    "Дамско облекло": ["Блузи и ризи", "Блузи", "Ризи", "Дънки и панталони", "Жилетки", "Кимона", "Комплекти и костюми", "Корсети", "Палта и якета", "Палта", "Якета", "Пижами и домашни комплекти", "Полари", "Поли", "Рокли", "Сака и елеци", "Спортни екипи", "Суичъри", "Тениски и потници"],
    "Мъжко облекло": ["Блузи и ризи", "Блузи", "Ризи", "Комплекти и костюми", "Палта и якета", "Палта", "Якета", "Пижами и домашни комплекти", "Спортни екипи", "Суичъри", "Тениски и потници"],
    "Бански": ["Цели бански"],
    "Унисекс облекло": ["Суичъри", "Тениски и потници"],
    "Чорапи": [],
    "Обувки": ["Боти", "Сандали", "Маратонки", "Обувки", "Домашни пантофи", "Чехли"],
    "Бельо": [],
  },
  "Спорт и туризъм": {
    "Туризъм и къмпинг": ["Бутилки и термоси", "Плажни и туристически кърпи", "Туристическо оборудване и аксесоари", "Хамаци и постелки"],
    "Фитнес и тренировки": [],
  },
  "Храна и напитки": {
    "Алкохолни напитки": [],
  },
} as const;

export const PRODUCT_CATEGORIES = Object.keys(PRODUCT_TAXONOMY);
export const PRODUCT_SUBCATEGORIES = [...new Set(Object.values(PRODUCT_TAXONOMY).flatMap((value) => Object.keys(value)))].sort((a, b) => a.localeCompare(b, "bg"));
export const PRODUCT_TYPES = [...new Set(Object.values(PRODUCT_TAXONOMY).flatMap((value) => Object.values(value).flat()))].sort((a, b) => a.localeCompare(b, "bg"));
export const RECIPIENTS = ["За жена", "За мъж", "За дете", "За бебе", "За двойка"];
export const GIFT_OCCASIONS = [
  "Рожден ден", "Сватба", "Новородено", "Коледа", "Кръщене", "Нов дом", "Свети Валентин", "Имен ден",
  "8 март", "Пенсиониране", "Дипломиране", "Абитуриентски бал", "Погача", "Изписване",
];
export const PRODUCT_ATTRIBUTES = [
  "Натурален", "Био сертифициран", "Органичен памук", "Веган", "Еко", "Ръчна изработка",
  // Canonical stored value remains compatible with existing product data.
  "Персонализируем", "Романтичен", "Практичен", "Забавен",
];
export const MATERIAL_FACET_VALUES = [
  "Акрил", "Бамбук", "Вискоза", "Вълна", "Деним", "Дърво", "Еластан", "Естествена кожа", "Картон", "Керамика",
  "Коноп", "Лен", "Медицинска стомана", "Метал", "Муселин", "Неръждаема стомана", "Органичен памук", "Памук",
  "Полиестер", "Сатен", "Соев восък", "Сребро", "Стъкло", "Хартия", "Злато", "Мъниста", "Коприна", "Дантела",
];
export const COLOR_FACET_VALUES = ["Бежов", "Бял", "Жълт", "Зелен", "Златист", "Кафяв", "Розов", "Светлосин", "Син", "Сребрист", "Тъмносин", "Червен", "Черен"];

export const STRUCTURED_FACET_OPTIONS = {
  recipient_age: ["1", "20", "25", "30", "35", "40", "45", "50", "60", "70", "80", "2", "3", "4", "7", "9", "10", "14"],
  recipient_gender: ["Момиче", "Момче"],
  role_interest: ["Кулинар", "Учителка", "Спортист", "Рибар", "Ловец"],
  wedding_anniversary_type: ["10 годишнина", "20 годишнина", "40 годишнина", "Обща годишнина", "Първа годишнина", "Перлена сватба", "Сребърна сватба", "Златна сватба"],
  gemstone: ["Диамант", "Изумруд", "Рубин", "Хематит", "Тигрово око", "Кехлибар", "Перла", "Цитрин", "Лабрадорит", "Мойсанит", "Черен турмалин"],
  jewelry_detail: ["Годежен", "Буква", "Име", "Кръст", "Червен конец"],
  clothing_style: ["Ежедневен", "Официален", "Спортен", "Бален", "Елегантен", "Бохо", "Вечерен"],
  sleeve: ["Къс ръкав", "Дълъг ръкав"],
  season: ["Летен", "Зимен", "Преходен", "Есенен"],
  ingredient: ["Розово масло", "Шафран"],
  skin_type: ["Нормална кожа", "Суха кожа", "Мазна кожа", "Комбинирана кожа", "Чувствителна кожа", "Дехидратирана кожа"],
  skin_need: ["Хидратация", "Против бръчки"],
  hair_need: ["Против косопад", "За мазна коса", "За суха коса", "За увредена коса"],
} as const;

export const GIFT_FACETS_BY_CONTEXT = {
  gifts_for_her: {
    recipient_age: ["20", "25", "30", "35", "45", "50", "60", "70", "80"],
    gift_occasion: ["Рожден ден", "Имен ден", "8 март", "Свети Валентин", "Коледа", "Пенсиониране", "Дипломиране", "Абитуриентски бал"],
    role_interest: ["Кулинар", "Учителка", "Спортист"],
  },
  gifts_for_him: {
    recipient_age: ["20", "25", "30", "40", "50", "60", "70", "80"],
    gift_occasion: ["Рожден ден", "Имен ден", "Свети Валентин", "Коледа", "Пенсиониране", "Дипломиране", "Абитуриентски бал"],
    role_interest: ["Кулинар", "Рибар", "Ловец", "Спортист"],
  },
  gifts_for_child: { recipient_age: ["2", "3", "4", "7", "9", "10", "14"], recipient_gender: ["Момиче", "Момче"] },
  gifts_for_baby: { recipient_gender: ["Момиче", "Момче"], gift_occasion: ["Погача", "Кръщене", "Изписване"] },
  gifts_for_wedding: { wedding_anniversary_type: STRUCTURED_FACET_OPTIONS.wedding_anniversary_type },
} as const;

export const AMBIGUOUS_TAXONOMY_SLUGS = new Set([
  "vakuumna-staklena-butilka-s-infuzer-490-ml", "neseser-aurababy", "zhiletka-karl-bezhov", "roklya-kristi-rozovi-tsvetya",
  "bio-sapun-za-detsa-i-bebeta", "sapun-bebcho", "spalen-komplekt-ot-100-pamuk", "travel-album-greece", "travel-album-istanbul",
  "brodirana-vizitka-za-svatba-orhidei", "set-za-svatba", "sots-set-za-mladozhentsi", "set-i-mama-e-chovek",
  "kutiya-aromatna-trilogiya", "kutiya-balans-i-detoks-ritual", "kutiyata-na-slanchevko",
  "podarachен-komplekt-portfeil-shah-svesht", "folkloren-podarachen-komplekt-pazi-balgaria-v-sarceto-si",
]);

type TaxonomyGuidance = { recommended: string; alternatives: string[]; reason: string };
export const MANUAL_CLASSIFICATION_GUIDANCE: Record<string, TaxonomyGuidance> = {
  "vakuumna-staklena-butilka-s-infuzer-490-ml": {
    recommended: "Аксесоари → Ежедневни аксесоари → Бутилки за многократна употреба",
    alternatives: ["Дом и интериор → Кухня и трапезария → Бутилки"],
    reason: "Продуктът е преносим ежедневен аксесоар; стъкло и еко характеристики остават facets.",
  },
  "neseser-aurababy": {
    recommended: "Аксесоари → Чанти и портфейли → Несесери",
    alternatives: ["Деца и бебе → Бебешки аксесоари → Органайзери"],
    reason: "Основният продуктов формат е несесер; бебе и майка са контекст и recipient facets.",
  },
  "zhiletka-karl-bezhov": {
    recommended: "Облекло → Детско облекло → Жилетки",
    alternatives: ["Облекло → Бебешко облекло → Жилетки"],
    reason: "Жилетката е ясно облекло; конкретната възраст е facet, а не продуктов тип.",
  },
  "roklya-kristi-rozovi-tsvetya": {
    recommended: "Облекло → Детско облекло → Рокли",
    alternatives: ["Облекло → Дамско облекло → Рокли"],
    reason: "Таговете изрично определят продукта като детска рокля; официалният стил остава facet.",
  },
  "bio-sapun-za-detsa-i-bebeta": {
    recommended: "Деца и бебе → Бебешка грижа → Сапуни за бебета и деца",
    alternatives: ["Козметика → Грижа за тялото → Сапуни"],
    reason: "Формулата и предназначението са специално за деца и бебета; био не означава автоматично сертифициран.",
  },
  "sapun-bebcho": {
    recommended: "Деца и бебе → Бебешка грижа → Сапуни за бебета и деца",
    alternatives: ["Козметика → Грижа за тялото → Сапуни"],
    reason: "Името и описанието сочат специализирана бебешка грижа, а не общ сапун за тяло.",
  },
  "spalen-komplekt-ot-100-pamuk": {
    recommended: "Деца и бебе → Бебешки текстил → Бебешко спално бельо",
    alternatives: ["Дом и интериор → Домашен текстил → Спално бельо"],
    reason: "Текущите данни посочват бебешка употреба; памукът остава material facet.",
  },
  "travel-album-greece": {
    recommended: "Книги, игри и творчество → Албуми и хартиени продукти → Фотоалбуми",
    alternatives: ["Дом и интериор → Декорация → Персонализирани албуми"],
    reason: "Основният формат е фотоалбум; пътуване и персонализация остават facets.",
  },
  "travel-album-istanbul": {
    recommended: "Книги, игри и творчество → Албуми и хартиени продукти → Фотоалбуми",
    alternatives: ["Дом и интериор → Декорация → Персонализирани албуми"],
    reason: "Основният формат е фотоалбум; дестинацията и персонализацията остават facets.",
  },
  "brodirana-vizitka-za-svatba-orhidei": {
    recommended: "Дом и интериор → Декорация → Персонализирана текстилна декорация",
    alternatives: ["Книги, игри и творчество → Албуми и хартиени продукти → Сватбени картички"],
    reason: "Това е бродиран декоративен продукт; сватбата, материалът и персонализацията са facets.",
  },
  "set-za-svatba": {
    recommended: "Дом и интериор → Аромати за дома → Комплекти ароматни продукти",
    alternatives: ["Дом и интериор → Аромати за дома → Ароматни свещи"],
    reason: "Съдържанието е комплект ароматни продукти; сватбата е повод, не taxonomy тип.",
  },
  "sots-set-za-mladozhentsi": {
    recommended: "Дом и интериор → Аромати за дома → Комплекти ароматни продукти",
    alternatives: ["Дом и интериор → Аромати за дома → Ароматни свещи"],
    reason: "Основният формат е ароматен комплект; младоженци и сватба остават recipient/occasion facets.",
  },
  "set-i-mama-e-chovek": {
    recommended: "Дом и интериор → Аромати за дома → Комплекти ароматни продукти",
    alternatives: ["Козметика → Козметични комплекти → Комплекти за грижа"],
    reason: "Съдържанието е комплект свещи и домашни аромати; мама и gift intent са facets.",
  },
  "kutiya-aromatna-trilogiya": {
    recommended: "Козметика → Козметични комплекти → Комплекти за грижа",
    alternatives: ["Дом и интериор → Аромати за дома → Комплекти ароматни продукти"],
    reason: "Кутията съдържа сапуни и ароматерапевтична грижа; подаръчността не определя taxonomy пътя.",
  },
  "kutiya-balans-i-detoks-ritual": {
    recommended: "Козметика → Козметични комплекти → Комплекти за грижа",
    alternatives: ["Здраве и грижа → Добавки и екстракти → Комплекти за самогрижа"],
    reason: "Продуктът е ритуал за лична грижа; детокс и получател са facets.",
  },
  "kutiyata-na-slanchevko": {
    recommended: "Книги, игри и творчество → Книги → Комплекти с детски книги",
    alternatives: ["Деца и бебе → Книги и дневници → Детски комплекти"],
    reason: "Книгата и дневникът са водещото съдържание; детската възраст е facet.",
  },
  "podarachен-komplekt-portfeil-shah-svesht": {
    recommended: "Книги, игри и творчество → Настолни игри → Комплекти с шах",
    alternatives: ["Аксесоари → Чанти и портфейли → Портфейли"],
    reason: "Шахът е най-разпознаваемият функционален продукт; останалите елементи и подаръчността са facets.",
  },
  "folkloren-podarachen-komplekt-pazi-balgaria-v-sarceto-si": {
    recommended: "Книги, игри и творчество → Книги и планери → Комплекти с тефтери и дневници",
    alternatives: ["Книги, игри и творчество → Книги → Дневници"],
    reason: "Тефтерът и дневникът определят основния формат; фолклорният стил и поводът са facets.",
  },
};

export const selectValue = (value: any) => String(value?.value ?? value ?? "").trim();
export const multiSelectValues = (value: any) => Array.isArray(value) ? value.map(selectValue).filter(Boolean) : String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);

export function structuredCategoryForSubcategory(subcategoryValue: any, categoryValue?: any) {
  const subcategory = selectValue(subcategoryValue);
  const category = selectValue(categoryValue);
  if (category) return subcategory in (PRODUCT_TAXONOMY[category as keyof typeof PRODUCT_TAXONOMY] || {}) ? category : "";
  const matches = PRODUCT_CATEGORIES.filter((candidate) => subcategory in PRODUCT_TAXONOMY[candidate as keyof typeof PRODUCT_TAXONOMY]);
  return matches.length === 1 ? matches[0] : "";
}

export function needsClassification(product: Record<string, any>) {
  const subcategory = selectValue(product.subcategory);
  const productType = selectValue(product.product_type);
  const category = structuredCategoryForSubcategory(subcategory, product.category);
  if (!category || !subcategory) return true;
  const categoryTree = PRODUCT_TAXONOMY[category as keyof typeof PRODUCT_TAXONOMY] as Record<string, readonly string[]> | undefined;
  if (!productType) return false;
  return !categoryTree?.[subcategory]?.some((value) => value === productType);
}

export function getStructuredDataGaps(product: Record<string, any>) {
  const text = [product.name_bg, product.category, product.tags, product.short_desc_bg, product.long_desc_bg]
    .flat()
    .map((value) => String(value ?? ""))
    .join(" ")
    .toLocaleLowerCase("bg");
  const recipients = multiSelectValues(product.recipient);
  const occasions = multiSelectValues(product.gift_occasion);
  const attributes = multiSelectValues(product.attributes);
  const productType = selectValue(product.product_type);
  const gaps: string[] = [];

  const explicitGiftEvidence = String(product.category || "").trim() === "Подаръци" || /подар(?:ък|ъци|ъчен|ъчна|ъчно|ъчни)/.test(text);
  if (explicitGiftEvidence && product.giftable !== true) gaps.push("Вероятно липсва giftable — legacy данните изрично посочват подарък.");
  if (product.giftable === true || explicitGiftEvidence) {
    if (/(?:за\s+мъж|мъжки\s+подарък)/.test(text) && !recipients.includes("За мъж")) gaps.push("Вероятно липсва recipient: За мъж.");
    if (/(?:за\s+жена|дамски\s+подарък)/.test(text) && !recipients.includes("За жена")) gaps.push("Вероятно липсва recipient: За жена.");
    if (/(?:за\s+бебе|за\s+новородено|бебешки\s+подарък)/.test(text) && !recipients.includes("За бебе")) gaps.push("Вероятно липсва recipient: За бебе.");
    if (/(?:сватба|сватбен|сватбена|младоженци)/.test(text) && !occasions.includes("Сватба")) gaps.push("Вероятно липсва gift_occasion: Сватба.");
  }

  const strongTypeRules: Array<[RegExp, string, string]> = [
    [/дамск(?:а|и)\s+рокл(?:я|и)/, "Рокли", "Дамско облекло"],
    [/мъжк(?:а|и)\s+пижам(?:а|и)/, "Пижами", "Мъжко облекло"],
    [/мъжк(?:и|а)\s+анцуг(?:и)?/, "Анцузи", "Мъжко облекло"],
    [/крем(?:ове)?\s+за\s+лице/, "Кремове за лице", "Грижа за лицето"],
    [/шампоан(?:и)?/, "Шампоани", "Грижа за косата"],
    [/обеци/, "Обеци", "Бижута"],
  ];
  for (const [pattern, expectedType, expectedSubcategory] of strongTypeRules) {
    if (!pattern.test(text)) continue;
    if (!productType) gaps.push(`Вероятно липсва product_type: ${expectedType}.`);
    else if (productType !== expectedType) gaps.push(`Възможен конфликт: текстът сочи product_type ${expectedType}, а е записано ${productType}.`);
    const currentSubcategory = selectValue(product.subcategory);
    if (!currentSubcategory) gaps.push(`Вероятно липсва subcategory: ${expectedSubcategory}.`);
    else if (currentSubcategory !== expectedSubcategory) gaps.push(`Възможен конфликт: текстът сочи subcategory ${expectedSubcategory}, а е записано ${currentSubcategory}.`);
    break;
  }
  if (/натурал(?:ен|на|но|ни)/.test(text) && !attributes.includes("Натурален")) gaps.push("Вероятно липсва attribute: Натурален.");

  return Array.from(new Set(gaps));
}
