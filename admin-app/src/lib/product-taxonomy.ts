export const PRODUCT_TAXONOMY = {
  "Аксесоари": {
    "Бижута": ["Обеци", "Колиета", "Гривни"],
    "Чанти и портфейли": ["Чанти", "Портфейли", "Несесери"],
    "Колани и харнеси": ["Колани", "Харнеси"],
    "Шапки и аксесоари за коса": ["Шапки и барети", "Кърпи за коса и глава", "Диадеми"],
    "Ежедневни аксесоари": ["Бутилки за многократна употреба"],
  },
  "Деца и бебе": {
    "Играчки": ["Образователни игри", "Ролеви комплекти", "Творчески комплекти", "Палатки за игра", "Меки играчки"],
    "Детски мебели": ["Гардероби", "Помощни кули"],
    "Бебешки текстил": ["Бебешко спално бельо", "Комплекти за кошара", "Комплекти за количка", "Бебешки гнезда", "Възглавници за кърмене", "Портове за изписване"],
    "Бебешка грижа": ["Бебешки кърпи", "Кремове и балсами за бебе", "Сапуни за бебета и деца"],
    "Бебешки комплекти": ["Комплекти за новородено"],
    "Бебешки аксесоари": ["Повивалници"],
    "Книги и дневници": ["Бебешки и детски дневници"],
  },
  "Дом и интериор": {
    "Аромати за дома": ["Ароматни свещи", "Комплекти ароматни продукти", "Абонаменти за свещи", "Ароматни дифузери", "Аксесоари за свещи"],
    "Декорация": ["Картини и стенно изкуство", "Кашпи и саксии", "Персонализирана текстилна декорация"],
    "Домашен текстил": ["Спално бельо", "Пещемали"],
    "Кухня и трапезария": ["Чаши", "Кухненски текстил"],
    "Почистване": ["Препарати за съдове", "Препарати за съдомиялна", "Препарати за прозорци", "Комплекти почистващи препарати"],
    "Осветление": ["Настолни лампи"],
  },
  "Домашни любимци": {
    "Грижа и хигиена": ["Парфюми за домашни любимци", "Балсами и мехлеми за домашни любимци"],
  },
  "Книги, игри и творчество": {
    "Настолни игри": ["Табла", "Комплекти с шах"],
    "Книги": ["Детски книги", "Семейни дневници", "Комплекти с детски книги"],
    "Книги и планери": ["Читателски дневници", "Планери", "Комплекти с тефтери и дневници"],
    "Албуми и хартиени продукти": ["Фотоалбуми", "Поздравителни картички"],
    "Аксесоари за четене": ["Разделители за книги"],
  },
  "Здраве и грижа": {
    "Добавки и екстракти": ["Гъбени екстракти", "Тинктури", "Хранителни добавки"],
    "Чай и билки": ["Билкови чайове"],
    "Локална грижа": ["Кремове за стави и мускули"],
  },
  "Козметика": {
    "Грижа за лицето": ["Кремове за лице", "Серуми за лице", "Почистващи продукти за лице", "Околоочни серуми", "Тонери", "Ексфолианти за лице"],
    "Грижа за тялото": ["Сапуни", "Балсами и мехлеми", "Олиа за тяло", "Лосиони за тяло", "Душ гелове", "Дезодоранти", "Ексфолианти за тяло"],
    "Грижа за косата": ["Шампоани", "Маски за коса", "Серуми за коса"],
    "Козметични комплекти": ["Комплекти за грижа"],
    "Грим": ["Червила", "Сенки за очи"],
    "Грижа за устните": ["Балсами за устни"],
    "Парфюми": ["Парфюми"],
  },
  "Облекло": {
    "Дамско облекло": ["Тениски", "Ризи", "Корсети", "Рокли", "Панталони", "Пижами и домашни комплекти", "Комплекти облекло", "Палта", "Сака", "Кимона"],
    "Мъжко облекло": ["Тениски", "Ризи"],
    "Детско облекло": ["Рокли", "Жилетки"],
  },
} as const;

export const PRODUCT_CATEGORIES = Object.keys(PRODUCT_TAXONOMY);
export const PRODUCT_SUBCATEGORIES = [...new Set(Object.values(PRODUCT_TAXONOMY).flatMap((value) => Object.keys(value)))].sort((a, b) => a.localeCompare(b, "bg"));
export const PRODUCT_TYPES = [...new Set(Object.values(PRODUCT_TAXONOMY).flatMap((value) => Object.values(value).flat()))].sort((a, b) => a.localeCompare(b, "bg"));
export const RECIPIENTS = ["За жена", "За мъж", "За дете", "За бебе", "За двойка"];
export const GIFT_OCCASIONS = ["Рожден ден", "Сватба", "Новородено", "Коледа", "Кръщене", "Нов дом", "Свети Валентин"];
export const PRODUCT_ATTRIBUTES = ["Натурален", "Био сертифициран", "Органичен памук", "Веган", "Еко", "Ръчна изработка", "Персонализируем"];

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

export function structuredCategoryForSubcategory(subcategoryValue: any) {
  const subcategory = selectValue(subcategoryValue);
  return PRODUCT_CATEGORIES.find((category) => subcategory in PRODUCT_TAXONOMY[category as keyof typeof PRODUCT_TAXONOMY]) || "";
}

export function needsClassification(product: Record<string, any>) {
  const subcategory = selectValue(product.subcategory);
  const productType = selectValue(product.product_type);
  const category = structuredCategoryForSubcategory(subcategory);
  if (!category || !subcategory || !productType) return true;
  const categoryTree = PRODUCT_TAXONOMY[category as keyof typeof PRODUCT_TAXONOMY] as Record<string, readonly string[]> | undefined;
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
