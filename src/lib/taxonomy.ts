import type { Product } from "./products";
import type { GiftTarget } from "./gifts";

export type CategoryKey =
  | "gifts"
  | "clothing"
  | "home"
  | "kids"
  | "health"
  | "cosmetics"
  | "accessories"
  | "fun"
  | "pets"
  | "food_drink";

export type SubcategoryKey =
  | "gifts_for_her"
  | "gifts_for_him"
  | "gifts_for_child"
  | "gifts_for_baby"
  | "gifts_for_wedding"
  | "clothing_women"
  | "clothing_men"
  | "clothing_lingerie"
  | "home_kitchen"
  | "home_textiles"
  | "home_bath"
  | "home_decor"
  | "home_cleaning"
  | "home_garden"
  | "kids_clothing"
  | "kids_toys"
  | "kids_books"
  | "kids_cosmetics"
  | "kids_furniture_textiles"
  | "health_tea_herbs"
  | "health_supplements"
  | "health_sport"
  | "cosmetics_face"
  | "cosmetics_body"
  | "cosmetics_hair"
  | "cosmetics_makeup"
  | "cosmetics_men"
  | "accessories_jewelry"
  | "accessories_bags"
  | "accessories_shoes"
  | "accessories_belts"
  | "accessories_headwear"
  | "fun_games"
  | "fun_hobby"
  | "fun_books"
  | "fun_art"
  | "pets_food"
  | "pets_accessories"
  | "pets_toys"
  | "pets_beds"
  | "pets_care"
  | "food_sweets"
  | "food_savory"
  | "food_drinks"
  | "food_spices"
  | "food_gifts";

type TaxonomySubcategory = {
  key: SubcategoryKey;
  label: string;
  slug: string;
  viewAllLabel: string;
  queryAliases: string[];
  matchAny?: string[];
  matchAll?: string[];
  priceMax?: number;
  legacySlugs?: string[];
};

type TaxonomyCategory = {
  key: CategoryKey;
  label: string;
  icon: string;
  slug: string;
  queryAliases: string[];
  legacyLabels?: string[];
  legacySlugs?: string[];
  subcategories: TaxonomySubcategory[];
};

type ProductTaxonomy = {
  categoryKey: CategoryKey | "";
  categoryLabel: string;
  categoryKeys: CategoryKey[];
  categoryLabels: string[];
  subcategoryKeys: SubcategoryKey[];
  subcategoryLabels: string[];
};

type SupportedLang = "bg" | "en";

const CATEGORY_EN_LABELS: Partial<Record<CategoryKey, string>> = {
  gifts: "Gifts",
  clothing: "Clothing",
  home: "Home & interior",
  kids: "Kids",
  health: "Health & care",
  cosmetics: "Cosmetics",
  accessories: "Accessories",
  fun: "Fun",
  pets: "Pets",
  food_drink: "Food & drinks",
};

const SUBCATEGORY_EN_LABELS: Partial<Record<SubcategoryKey, string>> = {
  gifts_for_her: "For her",
  gifts_for_him: "For him",
  gifts_for_child: "For child",
  gifts_for_baby: "For baby",
  gifts_for_wedding: "For wedding",
  clothing_women: "Women",
  clothing_men: "Men",
  clothing_lingerie: "Lingerie",
  home_kitchen: "Kitchen",
  home_textiles: "Home textiles",
  home_bath: "Bathroom",
  home_decor: "Decor",
  home_cleaning: "Cleaning",
  home_garden: "Garden & terrace",
  kids_clothing: "Clothing",
  kids_toys: "Toys",
  kids_books: "Kids' books",
  kids_cosmetics: "Kids' cosmetics",
  kids_furniture_textiles: "Kids' furniture & textiles",
  health_tea_herbs: "Tea & herbs",
  health_supplements: "Supplements & extracts",
  health_sport: "Sport",
  cosmetics_face: "Face",
  cosmetics_body: "Body",
  cosmetics_hair: "Hair",
  cosmetics_makeup: "Makeup",
  cosmetics_men: "For men",
  accessories_jewelry: "Jewelry",
  accessories_bags: "Bags",
  accessories_shoes: "Shoes",
  accessories_belts: "Belts",
  accessories_headwear: "Headwear",
  fun_games: "Games",
  fun_hobby: "Hobby",
  fun_books: "Books",
  fun_art: "Art",
  pets_food: "Food",
  pets_accessories: "Accessories",
  pets_toys: "Toys",
  pets_beds: "Beds & comfort",
  pets_care: "Care",
  food_sweets: "Sweet",
  food_savory: "Savory",
  food_drinks: "Drinks",
  food_spices: "Spices",
  food_gifts: "Giftable",
};

const APPAREL_TERMS = [
  "облекло",
  "рокля",
  "dress",
  "dresses",
  "пола",
  "блуза",
  "blouse",
  "риза",
  "shirt",
  "shirts",
  "тениска",
  "t-shirt",
  "tshirt",
  "суичър",
  "hoodie",
  "sweatshirt",
  "палто",
  "coat",
  "сако",
  "blazer",
  "jacket",
  "жилетка",
  "cardigan",
  "vest",
  "панталон",
  "pants",
  "бельо",
  "нощница",
  "пижама",
  "pajama",
  "pajamas",
  "pyjama",
  "pyjamas",
  "кимоно",
];
const WOMEN_TERMS = ["дамска", "дамски", "дамско", "за жена", "за нея", "рокля", "пола", "блуза", "мама", "майка", "баба", "момиче", "момичета"];
const MEN_TERMS = ["мъжка", "мъжки", "за мъж", "за него", "мъжко"];
const KIDS_TERMS = ["дете", "деца", "детски", "детска", "детско", "бебе", "бебешки", "бебешка", "бебешко"];
const TOY_TERMS = ["играчка", "играчки", "montessori", "монтесори", "пъзел", "мече", "кукла", "игра", "палатка", "пазарски щанд", "работилница"];
const KIDS_BOOK_TERMS = ["детски книги", "детска книга", "книга за деца", "книги за деца", "книжка", "книжки", "детски дневник", "бебешки дневник"];
const KIDS_COSMETICS_TERMS = [
  "грижа за бебе",
  "грижа за деца",
  "козметика за бебе",
  "козметика за деца",
  "бебешки балсам",
  "бебешки сапун",
  "детски сапун",
  "крем против подсичане",
  "подсичане",
  "шампоан за деца",
];
const KIDS_FURNITURE_TEXTILE_TERMS = [
  "детски мебели",
  "детски текстил",
  "бебешки текстил",
  "креватче",
  "кошара",
  "гнездо",
  "повивалник",
  "одеяло",
  "завивка",
  "възглавница",
  "спален комплект",
  "спално бельо",
  "чаршаф",
  "хавлия",
  "кърпа",
  "гардероб",
  "кула",
  "столче",
  "маса",
  "бюро",
  "текстил",
  "раница",
  "шише",
];
const HOME_TEXTILE_TERMS = [
  "домашен текстил",
  "спално бельо",
  "чаршаф",
  "завивка",
  "одеяло",
  "възглавница",
  "кърпа",
  "хавлия",
  "пештемал",
  "килим",
  "черга",
  "rug",
  "bed linen",
  "towel",
];
const HOME_GIFT_TERMS = ["свещ", "ваза", "декор", "картина", "лампа", "абажур", "чаша", "купа", "сервиране"];
const HOME_CLEANING_TERMS = ["почистване", "препарат", "сапун", "гъба", "четка", "садомиялна"];
const ART_OBJECT_TERMS = ["картина", "изкуство", "арт", "постер", "илюстрация", "скулптура", "стенно изкуство", "принт"];
const HOBBY_TERMS = ["хоби", "diy", "ръкоделие", "бродерия", "плетене", "творчество", "рисуване"];
const BOOK_TERMS = ["книга", "книги", "дневник", "планер", "четене", "разделител"];
const TSHIRT_TERMS = ["тениска", "t shirt", "tshirt", "tee"];
const TSHIRT_WOMEN_STRONG_TERMS = ["мама", "майка", "баба", "за мама", "за баба"];
const TSHIRT_MEN_STRONG_TERMS = ["татко", "дядо", "баща", "за татко", "за дядо"];
const KIDS_CLOTHING_TERMS = ["детско", "детски", "детска", "бебешко", "бебешки", "бебешка"];
const KIDS_CARE_CORE_TERMS = ["сапун", "шампоан", "крем", "балсам", "олио", "лосион", "грижа", "козметика", "подсичане"];
const KIDS_BOOK_CORE_TERMS = ["книга", "книжка", "книги", "дневник", "четене"];
const KIDS_FURNITURE_TEXTILE_CORE_TERMS = ["спално бельо", "текстил", "одеяло", "завивка", "възглавница", "чаршаф", "хавлия", "кърпа", "повивалник", "органайзер", "несесер", "кошара", "креватче", "количка", "муселин"];
const KIDS_FURNITURE_TEXTILE_STRONG_TERMS = [
  "детски мебели",
  "детски текстил",
  "бебешки текстил",
  "креватче",
  "кошара",
  "гнездо",
  "повивалник",
  "одеяло",
  "завивка",
  "възглавница",
  "спален комплект",
  "спално бельо",
  "чаршаф",
  "хавлия",
  "кърпа",
  "гардероб",
  "кула",
  "столче",
  "маса",
  "бюро",
  "текстил",
  "количка",
  "несесер",
  "органайзер",
  "муселин",
];
const KIDS_FURNITURE_TEXTILE_NURSERY_TERMS = [
  "детски мебели",
  "детски текстил",
  "бебешки текстил",
  "креватче",
  "кошара",
  "гнездо",
  "повивалник",
  "количка",
  "порт за изписване",
  "кърмене",
  "органайзер",
  "муселин",
];
const ACCESSORIES_JEWELRY_TERMS = ["бижута", "бижу", "обеци", "обица", "колие", "гривна", "гривни", "пръстен", "пръстени", "сребро", "сребърни", "silver", "jewelry"];
const ACCESSORIES_BAG_TERMS = ["чанта", "чанти", "bag", "bags", "портмоне", "несесер"];
const ACCESSORIES_SHOE_TERMS = ["обувки", "обувка", "shoe", "shoes", "боти", "бота", "ботуш", "ботуши", "boots", "boot", "маратонки", "сандали"];
const ACCESSORIES_BELT_TERMS = ["колан", "колани", "belt", "belts"];
const ACCESSORIES_HEADWEAR_TERMS = ["шапка", "барета", "диадема", "кърпа за глава", "кърпа за коса", "headband", "hat"];
const KIDS_TOY_EXCLUSION_TERMS = [
  ...ACCESSORIES_JEWELRY_TERMS,
  ...ACCESSORIES_HEADWEAR_TERMS,
  ...ACCESSORIES_BAG_TERMS,
  ...ACCESSORIES_BELT_TERMS,
];

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .trim();

const normalizePhrase = (value: unknown) =>
  normalize(value)
    .replace(/[\/_,;:.!?()[\]{}"'`´’“”]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const unique = <T,>(values: T[]) => Array.from(new Set(values));

export const TAXONOMY_CATEGORIES: TaxonomyCategory[] = [
  {
    key: "gifts",
    label: "Подаръци",
    icon: "🎁",
    slug: "bulgarski-podaratsi",
    queryAliases: ["подарък", "подаръци", "идеи за подарък", "български подаръци"],
    legacySlugs: ["idei-za-podarak", "podaraci"],
    legacyLabels: ["подарък"],
    subcategories: [
      {
        key: "gifts_for_her",
        label: "За жена",
        slug: "za-zhena",
        viewAllLabel: "Подаръци за жена",
        queryAliases: ["подарък за жена", "подаръци за жена", "за жена"],
        matchAny: ["за нея", "за жена", "дамска", "дамски", "дама"],
        legacySlugs: ["podaraci-za-jena"],
      },
      {
        key: "gifts_for_him",
        label: "За мъж",
        slug: "za-mazh",
        viewAllLabel: "Подаръци за мъж",
        queryAliases: ["подарък за мъж", "подаръци за мъж", "за мъж"],
        matchAny: ["за него", "за мъж", "мъжка", "мъжки"],
        legacySlugs: ["podaraci-za-nego"],
      },
      {
        key: "gifts_for_child",
        label: "За дете",
        slug: "za-dete",
        viewAllLabel: "Подаръци за дете",
        queryAliases: ["подарък за дете", "подаръци за дете", "за дете"],
        matchAny: ["за дете", "дете", "деца", "детски", "детско"],
      },
      {
        key: "gifts_for_baby",
        label: "За бебе",
        slug: "za-bebe",
        viewAllLabel: "Подаръци за бебе",
        queryAliases: ["подарък за бебе", "подаръци за бебе", "за бебе"],
        matchAny: ["за бебе", "бебе", "новородено"],
        legacySlugs: ["podaraci-za-bebe"],
      },
      {
        key: "gifts_for_wedding",
        label: "За сватба",
        slug: "za-svatba",
        viewAllLabel: "Подаръци за сватба",
        queryAliases: ["подарък за сватба", "подаръци за сватба"],
        matchAny: ["сватба", "сватбен", "младоженци", "wedding"],
        legacySlugs: ["podaraci-za-svatba"],
      },
    ],
  },
  {
    key: "clothing",
    label: "Облекло",
    icon: "👕",
    slug: "bulgarski-drehi",
    queryAliases: ["облекло", "български дрехи", "дрехи"],
    legacySlugs: ["obleklo"],
    subcategories: [
      {
        key: "clothing_women",
        label: "Дамско",
        slug: "damsko-obleklo",
        viewAllLabel: "Дамско облекло",
        queryAliases: ["дамско облекло", "дамско"],
        matchAny: ["дамска", "дамско", "за жена", "рокля", "пола", "блуза"],
      },
      {
        key: "clothing_men",
        label: "Мъжко",
        slug: "mazhko-obleklo",
        viewAllLabel: "Мъжко облекло",
        queryAliases: ["мъжко облекло", "мъжко"],
        matchAny: ["мъжка", "мъжки", "мъжко", "за мъж", "за него"],
      },
      {
        key: "clothing_lingerie",
        label: "Бельо",
        slug: "belio",
        viewAllLabel: "Бельо",
        queryAliases: ["бельо"],
        matchAny: ["бельо", "пижама", "нощница", "халат"],
      },
    ],
  },
  {
    key: "home",
    label: "Дом и интериор",
    icon: "🏠",
    slug: "za-doma",
    queryAliases: ["дом и интериор", "за дома", "дом"],
    legacyLabels: ["за дома"],
    legacySlugs: ["dom-i-interior"],
    subcategories: [
      {
        key: "home_kitchen",
        label: "Кухня",
        slug: "kuhnya",
        viewAllLabel: "Кухня",
        queryAliases: ["кухня"],
        matchAny: ["кухня", "чаша", "купа", "сервиране", "готвене"],
      },
      {
        key: "home_textiles",
        label: "Домашен текстил",
        slug: "domashen-tekstil",
        viewAllLabel: "Домашен текстил",
        queryAliases: ["домашен текстил", "текстил за дома"],
        matchAny: HOME_TEXTILE_TERMS,
      },
      {
        key: "home_bath",
        label: "Баня",
        slug: "banya",
        viewAllLabel: "Баня",
        queryAliases: ["баня"],
        matchAny: ["баня", "сапунерка", "поставка за сапун", "аксесоари за баня"],
      },
      {
        key: "home_decor",
        label: "Декор",
        slug: "dekoraciq-za-doma",
        viewAllLabel: "Декор",
        queryAliases: ["декор", "декорация за дома"],
        matchAny: ["декор", "декорация", "свещ", "ваза", "картина"],
        legacySlugs: ["dekor"],
      },
      {
        key: "home_cleaning",
        label: "Почистване",
        slug: "pochistvane",
        viewAllLabel: "Почистване",
        queryAliases: ["почистване"],
        matchAny: ["почистване", "препарат", "четка", "гъба"],
      },
      {
        key: "home_garden",
        label: "Градина и тераса",
        slug: "gradina-i-terasa",
        viewAllLabel: "Градина и тераса",
        queryAliases: ["градина и тераса", "градина", "тераса"],
        matchAny: ["градина", "тераса", "саксия", "растение"],
      },
    ],
  },
  {
    key: "kids",
    label: "Деца",
    icon: "👶",
    slug: "deca",
    queryAliases: ["деца", "за деца", "дете"],
    legacyLabels: ["за деца"],
    subcategories: [
      {
        key: "kids_clothing",
        label: "Облекло",
        slug: "detsko-obleklo",
        viewAllLabel: "Облекло",
        queryAliases: ["детско облекло", "облекло за деца", "детско"],
        matchAny: ["детско облекло", "бебешко облекло", "детска тениска", "детска рокля", "бебешки комплект"],
      },
      {
        key: "kids_toys",
        label: "Играчки",
        slug: "detski-igrachki",
        viewAllLabel: "Играчки",
        queryAliases: ["детски играчки", "играчки"],
        matchAny: ["играчки", "играчка", "toy", "игра"],
      },
      {
        key: "kids_books",
        label: "Детски книги",
        slug: "detski-knigi",
        viewAllLabel: "Детски книги",
        queryAliases: ["детски книги", "книги за деца"],
        matchAny: ["детски книги", "книга за деца", "книги за деца", "книжка", "книжки"],
      },
      {
        key: "kids_cosmetics",
        label: "Козметика за деца",
        slug: "kozmetika-za-deca",
        viewAllLabel: "Козметика за деца",
        queryAliases: ["козметика за деца", "козметика за бебе", "детска козметика"],
        matchAny: KIDS_COSMETICS_TERMS,
        legacySlugs: ["grizha-za-deca"],
      },
      {
        key: "kids_furniture_textiles",
        label: "Детски мебели и текстил",
        slug: "detski-mebeli-i-tekstil",
        viewAllLabel: "Детски мебели и текстил",
        queryAliases: ["детски мебели и текстил", "детски мебели", "детски текстил"],
        matchAny: KIDS_FURNITURE_TEXTILE_TERMS,
        legacySlugs: ["detski-aksesoari"],
      },
    ],
  },
  {
    key: "health",
    label: "Здраве и грижа",
    icon: "🌿",
    slug: "zdrave-i-grizha",
    queryAliases: ["здраве и грижа", "здраве"],
    subcategories: [
      {
        key: "health_tea_herbs",
        label: "Чай и билки",
        slug: "chai-i-bilki",
        viewAllLabel: "Чай и билки",
        queryAliases: ["чай и билки", "чай", "билки"],
        matchAny: ["чай", "билки", "билка"],
      },
      {
        key: "health_supplements",
        label: "Добавки и екстракти",
        slug: "dobavki-i-ekstrakti",
        viewAllLabel: "Добавки и екстракти",
        queryAliases: ["добавки и екстракти", "добавки", "екстракти", "витамини", "имунитет"],
        matchAny: ["добавка", "добавки", "екстракт", "екстракти", "витамин", "витамини", "тинктура", "имунитет"],
        legacySlugs: ["vitamini", "imunitet"],
      },
      {
        key: "health_sport",
        label: "Спорт",
        slug: "sport",
        viewAllLabel: "Спорт",
        queryAliases: ["спорт"],
        matchAny: ["спорт", "fitness", "фитнес", "протеин"],
      },
    ],
  },
  {
    key: "cosmetics",
    label: "Козметика",
    icon: "💄",
    slug: "kozmetika",
    queryAliases: ["козметика"],
    subcategories: [
      {
        key: "cosmetics_face",
        label: "Лице",
        slug: "kozmetika-lice",
        viewAllLabel: "Лице",
        queryAliases: ["козметика лице", "лице"],
        matchAny: ["лице", "серум", "крем за лице", "тоник"],
      },
      {
        key: "cosmetics_body",
        label: "Тяло",
        slug: "kozmetika-tyalo",
        viewAllLabel: "Тяло",
        queryAliases: ["козметика тяло", "тяло"],
        matchAny: ["тяло", "body", "лосион", "масло за тяло"],
      },
      {
        key: "cosmetics_hair",
        label: "Коса",
        slug: "kozmetika-kosa",
        viewAllLabel: "Коса",
        queryAliases: ["козметика коса", "коса"],
        matchAny: ["коса", "шампоан", "балсам", "маска за коса"],
      },
      {
        key: "cosmetics_makeup",
        label: "Грим",
        slug: "grim",
        viewAllLabel: "Грим",
        queryAliases: ["грим"],
        matchAny: ["грим", "червило", "спирала", "сенки"],
      },
      {
        key: "cosmetics_men",
        label: "За мъже",
        slug: "kozmetika-za-mazhe",
        viewAllLabel: "За мъже",
        queryAliases: ["козметика за мъже", "за мъже"],
        matchAny: ["за мъже", "мъжка козметика", "брада", "aftershave"],
      },
    ],
  },
  {
    key: "accessories",
    label: "Аксесоари",
    icon: "👜",
    slug: "aksesoari",
    queryAliases: ["аксесоари", "бижута"],
    legacyLabels: ["бижута"],
    subcategories: [
      {
        key: "accessories_jewelry",
        label: "Бижута",
        slug: "bijuta",
        viewAllLabel: "Бижута",
        queryAliases: ["бижута", "сребърни бижута"],
        matchAny: ["бижута", "бижу", "jewelry", "сребро", "сребърни", "silver"],
        legacySlugs: ["srebarni-bijuta"],
      },
      {
        key: "accessories_bags",
        label: "Чанти",
        slug: "chanti",
        viewAllLabel: "Чанти",
        queryAliases: ["чанти", "чанта"],
        matchAny: ["чанта", "чанти", "портмоне"],
      },
      {
        key: "accessories_shoes",
        label: "Обувки",
        slug: "obuvki",
        viewAllLabel: "Обувки",
        queryAliases: ["обувки"],
        matchAny: ["обувки", "боти", "сандали", "маратонки"],
      },
      {
        key: "accessories_belts",
        label: "Колани",
        slug: "kolani",
        viewAllLabel: "Колани",
        queryAliases: ["колани", "колан"],
        matchAny: ["колан", "колани"],
      },
      {
        key: "accessories_headwear",
        label: "За глава",
        slug: "za-glava",
        viewAllLabel: "За глава",
        queryAliases: ["за глава", "аксесоари за глава"],
        matchAny: ["шапка", "барета", "диадема", "кърпа за глава", "кърпа за коса", "headband", "hat"],
      },
    ],
  },
  {
    key: "fun",
    label: "Забавление",
    icon: "🎲",
    slug: "zabavlenie",
    queryAliases: ["забавление", "хоби"],
    subcategories: [
      {
        key: "fun_games",
        label: "Игри",
        slug: "igri",
        viewAllLabel: "Игри",
        queryAliases: ["игри"],
        matchAny: ["игри", "игра", "board game", "пъзел"],
      },
      {
        key: "fun_hobby",
        label: "Хоби",
        slug: "hobi",
        viewAllLabel: "Хоби",
        queryAliases: ["хоби"],
        matchAny: ["хоби", "diy", "ръкоделие", "плетене"],
      },
      {
        key: "fun_books",
        label: "Книги",
        slug: "knigi",
        viewAllLabel: "Книги",
        queryAliases: ["книги"],
        matchAny: ["книги", "книга", "reading"],
      },
      {
        key: "fun_art",
        label: "Изкуство",
        slug: "izkustvo",
        viewAllLabel: "Изкуство",
        queryAliases: ["изкуство", "арт"],
        matchAny: ["изкуство", "арт", "art", "илюстрация", "постер"],
      },
    ],
  },
  {
    key: "pets",
    label: "Домашни любимци",
    icon: "🐾",
    slug: "domashni-lyubimci",
    queryAliases: ["домашни любимци", "любимци", "pet", "pets"],
    legacyLabels: ["домашни любимци"],
    subcategories: [
      {
        key: "pets_food",
        label: "Храна",
        slug: "hrana-za-domashni-lyubimci",
        viewAllLabel: "Храна",
        queryAliases: ["храна за домашни любимци", "храна за куче", "храна за котка", "pet food"],
        matchAny: ["храна за куче", "храна за котка", "pet food", "dog food", "cat food", "лакомство", "гранули"],
      },
      {
        key: "pets_accessories",
        label: "Аксесоари",
        slug: "aksesoari-za-domashni-lyubimci",
        viewAllLabel: "Аксесоари",
        queryAliases: ["аксесоари за домашни любимци", "pet accessories"],
        matchAny: ["pet accessories", "аксесоари за куче", "аксесоари за котка", "нашийник", "каишка", "купа"],
      },
      {
        key: "pets_toys",
        label: "Играчки",
        slug: "igrachki-za-domashni-lyubimci",
        viewAllLabel: "Играчки",
        queryAliases: ["играчки за домашни любимци", "pet toys"],
        matchAny: ["играчки за куче", "играчки за котка", "pet toys", "играчка за куче", "играчка за котка"],
      },
      {
        key: "pets_beds",
        label: "Легла и комфорт",
        slug: "legla-i-komfort-za-domashni-lyubimci",
        viewAllLabel: "Легла и комфорт",
        queryAliases: ["легла за домашни любимци", "легла и комфорт"],
        matchAny: ["легло за куче", "легло за котка", "одеяло за куче", "комфорт за домашни любимци", "pet bed"],
      },
      {
        key: "pets_care",
        label: "Грижа",
        slug: "grizha-za-domashni-lyubimci",
        viewAllLabel: "Грижа",
        queryAliases: ["грижа за домашни любимци", "pet care"],
        matchAny: ["pet care", "грижа за куче", "грижа за котка", "шампоан за куче", "козметика за домашни любимци"],
      },
    ],
  },
  {
    key: "food_drink",
    label: "Храна и напитки",
    icon: "🍷",
    slug: "hrana-i-napitki",
    queryAliases: ["храна и напитки", "храна", "напитки", "food", "drinks"],
    subcategories: [
      {
        key: "food_sweets",
        label: "Сладки",
        slug: "sladki",
        viewAllLabel: "Сладки",
        queryAliases: ["сладки", "десерти", "sweet treats"],
        matchAny: ["сладки", "десерт", "бонбони", "шоколад", "бисквити", "sweet"],
      },
      {
        key: "food_savory",
        label: "Солени",
        slug: "soleni",
        viewAllLabel: "Солени",
        queryAliases: ["солени", "солени храни", "savory"],
        matchAny: ["солени", "соленки", "snack", "снакс", "крекери", "разядка"],
      },
      {
        key: "food_drinks",
        label: "Напитки",
        slug: "napitki",
        viewAllLabel: "Напитки",
        queryAliases: ["напитки", "drinks"],
        matchAny: ["напитки", "drink", "чай", "сироп", "сок", "кафе", "вино"],
      },
      {
        key: "food_spices",
        label: "Подправки",
        slug: "podpravki",
        viewAllLabel: "Подправки",
        queryAliases: ["подправки", "spices"],
        matchAny: ["подправки", "spices", "сол", "пипер", "микс от подправки"],
      },
      {
        key: "food_gifts",
        label: "Подаръчни",
        slug: "podarachni-hrani-i-napitki",
        viewAllLabel: "Подаръчни",
        queryAliases: ["подаръчни храни", "подаръчни напитки", "gift box food"],
        matchAny: ["подаръчна кутия", "gift box", "подаръчен комплект", "подаръчен сет", "деликатеси"],
      },
    ],
  },
];

const CATEGORY_BY_KEY = new Map(TAXONOMY_CATEGORIES.map((category) => [category.key, category]));
const SUBCATEGORY_LIST = TAXONOMY_CATEGORIES.flatMap((category) =>
  category.subcategories.map((subcategory) => ({ ...subcategory, categoryKey: category.key, categoryLabel: category.label }))
);
const SUBCATEGORY_BY_KEY = new Map(SUBCATEGORY_LIST.map((subcategory) => [subcategory.key, subcategory]));

const CATEGORY_KEY_ALIASES: Record<string, CategoryKey> = {};
const LANDING_ALIAS_TO_KEY = new Map<string, string>();

for (const category of TAXONOMY_CATEGORIES) {
  CATEGORY_KEY_ALIASES[normalize(category.label)] = category.key;
  CATEGORY_KEY_ALIASES[normalize(category.key)] = category.key;
  CATEGORY_KEY_ALIASES[normalize(category.slug)] = category.key;
  (category.queryAliases || []).forEach((alias) => {
    CATEGORY_KEY_ALIASES[normalize(alias)] = category.key;
  });
  (category.legacyLabels || []).forEach((alias) => {
    CATEGORY_KEY_ALIASES[normalize(alias)] = category.key;
  });

  LANDING_ALIAS_TO_KEY.set(category.slug, category.key);
  (category.legacySlugs || []).forEach((slug) => LANDING_ALIAS_TO_KEY.set(slug, category.key));
}

for (const subcategory of SUBCATEGORY_LIST) {
  LANDING_ALIAS_TO_KEY.set(subcategory.slug, subcategory.key);
  (subcategory.legacySlugs || []).forEach((slug) => LANDING_ALIAS_TO_KEY.set(slug, subcategory.key));
}

const tokenPhrases = (value: unknown) => {
  const normalized = normalizePhrase(value);
  if (!normalized) return [];
  return normalized
    .split(/[,\n]/)
    .flatMap((entry) => entry.split(/\s+/))
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const productCorpus = (product: Product) => {
  const values = [
    product.category,
    ...(Array.isArray(product.tags) ? product.tags : []),
    product.name_bg,
    product.short_desc_bg,
    product.long_desc_bg,
  ];

  return unique(values.map((value) => normalizePhrase(value)).filter(Boolean)).join(" | ");
};

const productKeywordCorpus = (product: Product) => {
  const values = [
    product.category,
    ...(Array.isArray(product.tags) ? product.tags : []),
    product.name_bg,
  ];

  return unique(values.map((value) => normalizePhrase(value)).filter(Boolean)).join(" | ");
};

const corpusIncludes = (corpus: string, term: string) => {
  const normalizedTerm = normalizePhrase(term);
  if (!normalizedTerm) return false;
  const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|\\s|\\|)${escapedTerm}(?=$|\\s|\\|)`);
  return pattern.test(corpus);
};

const corpusIncludesAny = (corpus: string, terms: string[]) => terms.some((term) => corpusIncludes(corpus, term));

const hasKidsToyIntent = (corpus: string) => corpusIncludesAny(corpus, TOY_TERMS);
const hasStrongKidsFurnitureTextileIntent = (corpus: string) =>
  corpusIncludesAny(corpus, KIDS_FURNITURE_TEXTILE_STRONG_TERMS) ||
  corpusIncludesAny(corpus, KIDS_FURNITURE_TEXTILE_NURSERY_TERMS);

const getProductNameCorpus = (product: Product) => normalizePhrase(product.name_bg);

const subcategoryPassesContext = (
  product: Product,
  categoryKey: CategoryKey,
  subcategoryKey: SubcategoryKey,
  keywordCorpus: string,
  fullCorpus: string,
  explicitCategoryKey: CategoryKey | ""
) => {
  const isExplicitCategory = explicitCategoryKey === categoryKey;

  if (categoryKey === "cosmetics") {
    if (explicitCategoryKey !== "cosmetics") return false;

    if ([ "cosmetics_face", "cosmetics_body", "cosmetics_hair" ].includes(subcategoryKey)) {
      if (corpusIncludesAny(fullCorpus, KIDS_TERMS)) return false;
    }

    if (subcategoryKey === "cosmetics_hair") {
      return corpusIncludesAny(fullCorpus, ["коса", "шампоан", "балсам за коса", "маска за коса", "серум за коса"]);
    }

    if (subcategoryKey === "cosmetics_body") {
      return corpusIncludesAny(fullCorpus, ["тяло", "олио за тяло", "лосион", "балсам за тяло", "сапун", "мехлем"]);
    }

    if (subcategoryKey === "cosmetics_face") {
      return corpusIncludesAny(fullCorpus, ["лице", "крем за лице", "серум за лице", "тоник", "почистващ гел"]);
    }
  }

  if (categoryKey === "fun") {
    if (subcategoryKey === "fun_games") {
      return (
        explicitCategoryKey === "fun" ||
        corpusIncludesAny(fullCorpus, ["забавление", "игри", "board game", "табла", "ролеви игри"]) ||
        corpusIncludesAny(fullCorpus, TOY_TERMS)
      );
    }

    if (subcategoryKey === "fun_hobby") {
      return (explicitCategoryKey === "fun" || corpusIncludes(fullCorpus, "забавление")) && corpusIncludesAny(fullCorpus, HOBBY_TERMS);
    }

    if (subcategoryKey === "fun_books") {
      return (
        (explicitCategoryKey === "fun" || corpusIncludes(fullCorpus, "забавление")) &&
        corpusIncludesAny(fullCorpus, BOOK_TERMS) &&
        !corpusIncludesAny(fullCorpus, KIDS_BOOK_TERMS)
      );
    }

    if (subcategoryKey === "fun_art") {
      return (
        (explicitCategoryKey === "fun" || explicitCategoryKey === "home") &&
        corpusIncludesAny(fullCorpus, ART_OBJECT_TERMS) &&
        !corpusIncludesAny(fullCorpus, APPAREL_TERMS) &&
        !corpusIncludesAny(fullCorpus, ["бижута", "обици", "колие", "гривна", "тениска", "риза", "сако"])
      );
    }
  }

  if (categoryKey === "clothing") {
    const hasApparelIntent = isExplicitCategory || corpusIncludesAny(keywordCorpus, APPAREL_TERMS);
    if (!hasApparelIntent) return false;

    if (subcategoryKey === "clothing_women") {
      return corpusIncludesAny(fullCorpus, WOMEN_TERMS) && !corpusIncludesAny(fullCorpus, [...MEN_TERMS, ...KIDS_TERMS]);
    }

    if (subcategoryKey === "clothing_men") {
      return corpusIncludesAny(fullCorpus, MEN_TERMS) && !corpusIncludesAny(fullCorpus, [...WOMEN_TERMS, ...KIDS_TERMS]);
    }
  }

  if (categoryKey === "kids") {
    if (subcategoryKey === "kids_clothing") {
      return corpusIncludesAny(fullCorpus, KIDS_TERMS) && corpusIncludesAny(fullCorpus, APPAREL_TERMS);
    }

    if (subcategoryKey === "kids_toys") {
      return (
        hasKidsToyIntent(fullCorpus) &&
        !hasStrongKidsFurnitureTextileIntent(fullCorpus) &&
        !corpusIncludesAny(fullCorpus, KIDS_TOY_EXCLUSION_TERMS)
      );
    }

    if (subcategoryKey === "kids_books") {
      return (
        corpusIncludesAny(fullCorpus, KIDS_BOOK_TERMS) ||
        (corpusIncludesAny(fullCorpus, KIDS_TERMS) && corpusIncludesAny(fullCorpus, KIDS_BOOK_CORE_TERMS))
      );
    }

    if (subcategoryKey === "kids_cosmetics") {
      return (
        !hasStrongKidsFurnitureTextileIntent(fullCorpus) &&
        !corpusIncludesAny(fullCorpus, KIDS_FURNITURE_TEXTILE_CORE_TERMS) &&
        (
          corpusIncludesAny(fullCorpus, KIDS_COSMETICS_TERMS) ||
          (corpusIncludesAny(fullCorpus, KIDS_TERMS) && corpusIncludesAny(fullCorpus, KIDS_CARE_CORE_TERMS))
        )
      );
    }

    if (subcategoryKey === "kids_furniture_textiles") {
      return (
        (hasStrongKidsFurnitureTextileIntent(fullCorpus) ||
          (corpusIncludesAny(fullCorpus, KIDS_TERMS) && corpusIncludesAny(fullCorpus, KIDS_FURNITURE_TEXTILE_CORE_TERMS))) &&
        !(hasKidsToyIntent(fullCorpus) && !hasStrongKidsFurnitureTextileIntent(fullCorpus))
      );
    }
  }

  if (categoryKey === "accessories") {
    if (subcategoryKey === "accessories_jewelry") {
      return corpusIncludesAny(fullCorpus, ACCESSORIES_JEWELRY_TERMS);
    }

    if (subcategoryKey === "accessories_bags") {
      return corpusIncludesAny(fullCorpus, ACCESSORIES_BAG_TERMS);
    }

    if (subcategoryKey === "accessories_shoes") {
      return corpusIncludesAny(fullCorpus, ACCESSORIES_SHOE_TERMS);
    }

    if (subcategoryKey === "accessories_belts") {
      return corpusIncludesAny(fullCorpus, ACCESSORIES_BELT_TERMS);
    }

    if (subcategoryKey === "accessories_headwear") {
      return corpusIncludesAny(fullCorpus, ACCESSORIES_HEADWEAR_TERMS);
    }
  }

  if (categoryKey === "home") {
    if (subcategoryKey === "home_textiles") {
      return corpusIncludesAny(fullCorpus, HOME_TEXTILE_TERMS) && !corpusIncludesAny(fullCorpus, KIDS_TERMS);
    }
  }

  return true;
};

const hasPriceAtMost = (product: Product, max: number) => {
  const min = product.price_min_eur;
  const high = product.price_max_eur;
  if (typeof min === "number" && min <= max) return true;
  if (typeof high === "number" && high <= max) return true;
  return false;
};

const getDefaultSubcategoryKeys = (product: Product, categoryKey: CategoryKey | "") => {
  const rawCategory = normalize(product.category);
  const keywordCorpus = productKeywordCorpus(product);
  const fullCorpus = productCorpus(product);
  if (!categoryKey) return [];
  if (categoryKey === "kids") {
    if (rawCategory === "козметика" && !hasStrongKidsFurnitureTextileIntent(fullCorpus)) {
      return ["kids_cosmetics" as SubcategoryKey];
    }
    if (hasKidsToyIntent(fullCorpus) && !hasStrongKidsFurnitureTextileIntent(fullCorpus)) {
      return ["kids_toys" as SubcategoryKey];
    }
    if (hasStrongKidsFurnitureTextileIntent(fullCorpus) || corpusIncludesAny(fullCorpus, KIDS_FURNITURE_TEXTILE_CORE_TERMS)) {
      return ["kids_furniture_textiles" as SubcategoryKey];
    }
    if (corpusIncludesAny(fullCorpus, KIDS_COSMETICS_TERMS) || (corpusIncludesAny(fullCorpus, KIDS_TERMS) && corpusIncludesAny(fullCorpus, KIDS_CARE_CORE_TERMS))) {
      return ["kids_cosmetics" as SubcategoryKey];
    }
    if (corpusIncludesAny(fullCorpus, KIDS_BOOK_TERMS) || (corpusIncludesAny(fullCorpus, KIDS_TERMS) && corpusIncludesAny(fullCorpus, KIDS_BOOK_CORE_TERMS))) {
      return ["kids_books" as SubcategoryKey];
    }
    if (corpusIncludesAny(fullCorpus, KIDS_TERMS) && corpusIncludesAny(fullCorpus, KIDS_CARE_CORE_TERMS) && !hasStrongKidsFurnitureTextileIntent(fullCorpus)) {
      return ["kids_cosmetics" as SubcategoryKey];
    }
    if (hasKidsToyIntent(fullCorpus)) {
      return ["kids_toys" as SubcategoryKey];
    }
    if (corpusIncludesAny(fullCorpus, KIDS_TERMS) && corpusIncludesAny(fullCorpus, APPAREL_TERMS)) {
      return ["kids_clothing" as SubcategoryKey];
    }
  }
  if (categoryKey === "accessories") {
    if (rawCategory === "бижута" || corpusIncludesAny(fullCorpus, ACCESSORIES_JEWELRY_TERMS)) {
      return ["accessories_jewelry" as SubcategoryKey];
    }
    if (corpusIncludesAny(fullCorpus, ACCESSORIES_BAG_TERMS)) {
      return ["accessories_bags" as SubcategoryKey];
    }
    if (corpusIncludesAny(fullCorpus, ACCESSORIES_SHOE_TERMS)) {
      return ["accessories_shoes" as SubcategoryKey];
    }
    if (corpusIncludesAny(fullCorpus, ACCESSORIES_BELT_TERMS)) {
      return ["accessories_belts" as SubcategoryKey];
    }
    if (corpusIncludesAny(fullCorpus, ACCESSORIES_HEADWEAR_TERMS)) {
      return ["accessories_headwear" as SubcategoryKey];
    }
  }
  if (rawCategory === "бижута" && categoryKey === "accessories") {
    return ["accessories_jewelry" as SubcategoryKey];
  }
  return [];
};

const matchesCategoryTerms = (category: TaxonomyCategory, corpus: string) =>
  [category.label, ...category.queryAliases, ...(category.legacyLabels || [])].some((term) => corpusIncludes(corpus, term));

const CATEGORY_DEFAULT_SUBCATEGORY: Record<CategoryKey, SubcategoryKey> = {
  gifts: "gifts_for_wedding",
  clothing: "clothing_women",
  home: "home_decor",
  kids: "kids_toys",
  health: "health_supplements",
  cosmetics: "cosmetics_face",
  accessories: "accessories_jewelry",
  fun: "fun_games",
  pets: "pets_accessories",
  food_drink: "food_drinks",
};

const findFirstMatchingSubcategory = (
  product: Product,
  category: TaxonomyCategory,
  keywordCorpus: string,
  fullCorpus: string,
  explicitCategoryKey: CategoryKey | ""
) =>
  category.subcategories.find((subcategory) => {
    if (subcategory.priceMax != null && !hasPriceAtMost(product, subcategory.priceMax)) {
      return false;
    }

    const matchesAll = (subcategory.matchAll || []).every((term) => corpusIncludes(fullCorpus, term));
    const matchesAny =
      !subcategory.matchAny?.length || subcategory.matchAny.some((term) => corpusIncludes(fullCorpus, term));

    return (
      matchesAll &&
      matchesAny &&
      subcategoryPassesContext(product, category.key, subcategory.key, keywordCorpus, fullCorpus, explicitCategoryKey)
    );
  }) || null;

const resolveCanonicalCategoryKey = (product: Product, keywordCorpus: string, fullCorpus: string): CategoryKey | "" => {
  const explicitCategoryKey = getCategoryKey(product.category);

  if (
    explicitCategoryKey === "home" &&
    corpusIncludesAny(fullCorpus, HOME_TEXTILE_TERMS) &&
    !hasStrongKidsFurnitureTextileIntent(fullCorpus)
  ) {
    return "home";
  }

  if (
    explicitCategoryKey === "accessories" &&
    corpusIncludesAny(fullCorpus, [
      ...ACCESSORIES_JEWELRY_TERMS,
      ...ACCESSORIES_BAG_TERMS,
      ...ACCESSORIES_SHOE_TERMS,
      ...ACCESSORIES_BELT_TERMS,
      ...ACCESSORIES_HEADWEAR_TERMS,
    ])
  ) {
    return "accessories";
  }

  if (corpusIncludesAny(keywordCorpus, KIDS_TERMS)) {
    return "kids";
  }

  if (corpusIncludesAny(keywordCorpus, KIDS_CLOTHING_TERMS)) {
    return "kids";
  }

  if (corpusIncludesAny(fullCorpus, KIDS_TERMS) && corpusIncludesAny(fullCorpus, KIDS_FURNITURE_TEXTILE_TERMS)) {
    return "kids";
  }

  if (explicitCategoryKey === "cosmetics" && corpusIncludesAny(fullCorpus, KIDS_TERMS) && corpusIncludesAny(fullCorpus, KIDS_COSMETICS_TERMS)) {
    return "kids";
  }

  if (explicitCategoryKey === "kids" && corpusIncludesAny(fullCorpus, APPAREL_TERMS)) {
    return "kids";
  }

  if (explicitCategoryKey) {
    return explicitCategoryKey;
  }

  const inferredCategory = TAXONOMY_CATEGORIES.find((category) => {
    const firstMatch = findFirstMatchingSubcategory(product, category, keywordCorpus, fullCorpus, category.key);
    return matchesCategoryTerms(category, keywordCorpus) || Boolean(firstMatch);
  });

  return inferredCategory?.key || "";
};

const resolveCanonicalSubcategoryKey = (
  product: Product,
  category: TaxonomyCategory,
  keywordCorpus: string,
  fullCorpus: string,
  explicitCategoryKey: CategoryKey | ""
) => {
  const explicitDefaults = getDefaultSubcategoryKeys(product, category.key);
  if (explicitDefaults.length) return explicitDefaults[0];

  const matched = findFirstMatchingSubcategory(product, category, keywordCorpus, fullCorpus, explicitCategoryKey);
  if (matched) return matched.key;

  return CATEGORY_DEFAULT_SUBCATEGORY[category.key];
};

const GIFT_TARGET_TO_SUBCATEGORY: Record<GiftTarget, SubcategoryKey> = {
  her: "gifts_for_her",
  him: "gifts_for_him",
  child: "gifts_for_child",
  baby: "gifts_for_baby",
  wedding: "gifts_for_wedding",
};

const getGiftSubcategoryKeys = (product: Product) => {
  if (!product.giftable) return [];
  const targets = product.gift_targets.length ? product.gift_targets : [];
  return targets.map((target) => GIFT_TARGET_TO_SUBCATEGORY[target]).filter(Boolean);
};

const getSupplementalClothingSubcategoryKeys = (product: Product, keywordCorpus: string) => {
  const titleCorpus = getProductNameCorpus(product);
  const hasTshirtIntent = corpusIncludesAny(keywordCorpus, TSHIRT_TERMS);
  if (!hasTshirtIntent) return [];

  const titleSaysWomen = corpusIncludesAny(titleCorpus, TSHIRT_WOMEN_STRONG_TERMS);
  const titleSaysMen = corpusIncludesAny(titleCorpus, TSHIRT_MEN_STRONG_TERMS);
  const titleSaysKids = corpusIncludesAny(titleCorpus, KIDS_TERMS);

  if (titleSaysKids) return ["kids_clothing" as SubcategoryKey];
  if (titleSaysWomen) return ["clothing_women" as SubcategoryKey];
  if (titleSaysMen) return ["clothing_men" as SubcategoryKey];

  return ["clothing_women" as SubcategoryKey, "clothing_men" as SubcategoryKey];
};

export const getCategoryKey = (category: string): CategoryKey | "" => CATEGORY_KEY_ALIASES[normalize(category)] || "";

export const getCategoryConfig = (categoryKey: CategoryKey | "") =>
  (categoryKey ? CATEGORY_BY_KEY.get(categoryKey) : null) || null;

export const getCategoryLabel = (category: string) => {
  const categoryKey = getCategoryKey(category);
  return getCategoryConfig(categoryKey)?.label || String(category || "").trim();
};

export const getCategoryLabelForLang = (categoryOrKey: string, lang: SupportedLang = "bg") => {
  const categoryKey = getCategoryKey(categoryOrKey) || (String(categoryOrKey || "") as CategoryKey);
  const category = getCategoryConfig(categoryKey);
  if (!category) return String(categoryOrKey || "").trim();
  return lang === "en" ? CATEGORY_EN_LABELS[category.key] || category.label : category.label;
};

export const getCategoryChipLabel = (categoryKey: CategoryKey) => {
  const category = CATEGORY_BY_KEY.get(categoryKey);
  return category ? `${category.icon} ${category.label}` : "";
};

export const getCategoryChipLabelForLang = (categoryKey: CategoryKey, lang: SupportedLang = "bg") => {
  const category = CATEGORY_BY_KEY.get(categoryKey);
  if (!category) return "";
  const label = lang === "en" ? CATEGORY_EN_LABELS[category.key] || category.label : category.label;
  return `${category.icon} ${label}`;
};

export const getSubcategoryLabelForLang = (subcategoryKey: SubcategoryKey, lang: SupportedLang = "bg") => {
  const subcategory = SUBCATEGORY_BY_KEY.get(subcategoryKey);
  if (!subcategory) return "";
  return lang === "en" ? SUBCATEGORY_EN_LABELS[subcategory.key] || subcategory.label : subcategory.label;
};

export const getSubcategoryViewAllLabelForLang = (subcategoryKey: SubcategoryKey, lang: SupportedLang = "bg") => {
  const subcategory = SUBCATEGORY_BY_KEY.get(subcategoryKey);
  if (!subcategory) return "";
  if (lang === "bg") return subcategory.viewAllLabel;

  const translated = SUBCATEGORY_EN_LABELS[subcategory.key] || subcategory.label;
  const categoryTranslated = CATEGORY_EN_LABELS[subcategory.categoryKey as CategoryKey] || subcategory.categoryLabel;

  if (subcategory.categoryKey === "gifts") return `Gifts ${translated.toLowerCase()}`;
  if (subcategory.categoryKey === "kids" && subcategory.key === "kids_books") return translated;
  if (subcategory.categoryKey === "home" && subcategory.key === "home_textiles") return translated;
  if (subcategory.categoryKey === "health" && subcategory.key === "health_supplements") return translated;
  return subcategory.key === "clothing_women" || subcategory.key === "clothing_men"
    ? `${translated} clothing`
    : translated.includes(categoryTranslated) ? translated : translated;
};

export const getTaxonomyForProduct = (product: Product): ProductTaxonomy => {
  const keywordCorpus = productKeywordCorpus(product);
  const corpus = productCorpus(product);
  const categoryKey = resolveCanonicalCategoryKey(product, keywordCorpus, corpus);
  const category = getCategoryConfig(categoryKey);

  if (!category) {
    return {
      categoryKey: "",
      categoryLabel: String(product.category || "").trim(),
      categoryKeys: [],
      categoryLabels: [],
      subcategoryKeys: [],
      subcategoryLabels: [],
    };
  }

  const subcategoryKey = resolveCanonicalSubcategoryKey(product, category, keywordCorpus, corpus, getCategoryKey(product.category));
  const subcategory = SUBCATEGORY_BY_KEY.get(subcategoryKey);
  const categoryKeys: CategoryKey[] = [category.key];
  const subcategoryKeys: SubcategoryKey[] = subcategory ? [subcategory.key] : [];

  if (category.key !== "gifts" && product.giftable) {
    if (!categoryKeys.includes("gifts")) categoryKeys.push("gifts");
    const giftSubcategoryKeys = getGiftSubcategoryKeys(product);
    if (giftSubcategoryKeys.length) {
      giftSubcategoryKeys.forEach((key) => {
        if (!subcategoryKeys.includes(key)) subcategoryKeys.push(key);
      });
    }
  }

  if (category.key === "clothing") {
    getSupplementalClothingSubcategoryKeys(product, keywordCorpus).forEach((key) => {
      if (!subcategoryKeys.includes(key)) subcategoryKeys.push(key);
    });
  }

  return {
    categoryKey: category.key,
    categoryLabel: category.label,
    categoryKeys,
    categoryLabels: [category.label],
    subcategoryKeys,
    subcategoryLabels: subcategoryKeys
      .map((key) => SUBCATEGORY_BY_KEY.get(key)?.label || "")
      .filter(Boolean),
  };
};

export const getTopLevelCategories = () =>
  TAXONOMY_CATEGORIES.map((category) => ({
    key: category.key,
    label: category.label,
    labelEn: CATEGORY_EN_LABELS[category.key] || category.label,
    chipLabel: `${category.icon} ${category.label}`,
    chipLabelEn: `${category.icon} ${CATEGORY_EN_LABELS[category.key] || category.label}`,
    slug: category.slug,
    query: category.queryAliases[0] || category.label,
    subcategories: category.subcategories.map((subcategory) => ({
      key: subcategory.key,
      label: subcategory.label,
      labelEn: SUBCATEGORY_EN_LABELS[subcategory.key] || subcategory.label,
      slug: subcategory.slug,
      query: subcategory.queryAliases[0] || subcategory.label,
    })),
  }));

export const resolveLandingKeyFromSlug = (slug: string) => LANDING_ALIAS_TO_KEY.get(String(slug || "").trim()) || null;
