import type { Product } from "./products";
import type { GiftTarget } from "./gifts";
import { sortGiftProducts } from "./gifts";
import { buildSearchDocument, matchesSearchValueAgainstDocument } from "./search";
import { getClothingTypeMatches, ALL_CLOTHING_TYPE_OPTIONS } from "./clothing-types";
import {
  type CategoryKey,
  type SubcategoryKey,
  getCategoryConfig,
  getCategoryKey,
  getCategoryLabel,
  getTaxonomyForProduct,
  resolveLandingKeyFromSlug,
  TAXONOMY_CATEGORIES,
} from "./taxonomy";

export { getCategoryKey } from "./taxonomy";

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .trim();

export type SeoLanding = {
  slug: string;
  categoryKey: string;
  subcategoryKey?: string;
  kind: "category" | "subcategory";
  label: string;
  viewAllLabel: string;
  h1: string;
  intro: string[];
  title: string;
  description: string;
  queryAliases?: string[];
  hidden?: boolean;
  canonicalSlug?: string;
  canonicalPath?: string;
  editorialHeader?: {
    kicker?: string;
    title: string;
    intro?: string;
    ariaLabel?: string;
  };
  editorialSections?: Array<{ title: string; paragraphs: string[] }>;
};

export type SeoIntentLanding = {
  key: string;
  path: string;
  categoryKey: CategoryKey;
  subcategoryKey?: SubcategoryKey;
  audienceSubcategoryKey?: SubcategoryKey;
  kind: "keyword";
  label: string;
  labelEn: string;
  h1: string;
  intro: string[];
  title: string;
  description: string;
  queryAliases?: string[];
  group: "gifts" | "clothing" | "fun" | "discovery";
  matchQueries?: string[];
  matchCategoryKeys?: CategoryKey[];
  giftTarget?: GiftTarget;
  requiresGiftable?: boolean;
  requiresHandmade?: boolean;
  clothingTypeKeys?: string[];
  editorialHeader?: {
    kicker?: string;
    title: string;
    intro?: string;
    ariaLabel?: string;
  };
  editorialSections?: Array<{ title: string; paragraphs: string[] }>;
};

const buildCategoryTitle = (label: string) => `${label} | Български продукти | Българитъм`;
const buildCategoryDescription = (label: string) =>
  `Открий ${label.toLowerCase()} от български марки в Българитъм. Подбрани продукти, ясна структура и по-лесно откриване.`;

const buildCategoryIntro = (label: string) => [
  `Открий ${label.toLowerCase()} от български марки, подредени така, че да стигаш по-бързо до точните продукти и брандове.`,
  `Тази страница събира внимателно подбрани находки в ${label.toLowerCase()} и прави разглеждането по-ясно, спокойно и смислено.`,
];

const buildSubcategoryTitle = (label: string, categoryLabel: string) =>
  `${label} | ${categoryLabel} | Българитъм`;

const buildSubcategoryDescription = (label: string, categoryLabel: string) =>
  `Открий ${label.toLowerCase()} в ${categoryLabel.toLowerCase()} от български марки в Българитъм. Подбрани продукти и по-лесно откриване.`;

const buildSubcategoryIntro = (label: string, categoryLabel: string) => [
  `Открий ${label.toLowerCase()} в ${categoryLabel.toLowerCase()} от български марки, подредени в ясен и удобен за разглеждане контекст.`,
  `Запазвай продуктите, които ти правят впечатление, събирай ги в свои списъци и се връщай към тях по-късно или ги споделяй с линк.`,
];

const HANDMADE_TERMS = ["ръчна изработка", "ръчно изработени", "ръчно изработен", "ръчно изработена", "handmade", "hand crafted"];
const WOMEN_AUDIENCE_TERMS = ["дамско", "дамска", "за жена", "за нея", "мама", "баба"];
const MEN_AUDIENCE_TERMS = ["мъжко", "мъжка", "мъжки", "за мъж", "за него", "татко", "дядо", "баща"];
const KIDS_AUDIENCE_TERMS = ["детско", "детска", "детски", "бебе", "бебешко", "бебешки"];

const categoryLandings = TAXONOMY_CATEGORIES.map((category) => ({
  slug: category.slug,
  categoryKey: category.key,
  kind: "category" as const,
  label: category.label,
  viewAllLabel: `Всички ${category.label}`,
  h1: category.label,
  intro: buildCategoryIntro(category.label),
  title: buildCategoryTitle(category.label),
  description: buildCategoryDescription(category.label),
  queryAliases: category.queryAliases,
  canonicalPath:
    category.key === "gifts"
      ? "/bulgarski-podaratsi/"
      : category.key === "clothing"
        ? "/bulgarski-drehi/"
        : undefined,
}));

const subcategoryLandings = TAXONOMY_CATEGORIES.flatMap((category) =>
  category.subcategories.map((subcategory) => ({
    slug: subcategory.slug,
    categoryKey: category.key,
    subcategoryKey: subcategory.key,
    kind: "subcategory" as const,
    label: subcategory.label,
    viewAllLabel: subcategory.viewAllLabel,
    h1: subcategory.viewAllLabel,
    intro: buildSubcategoryIntro(subcategory.viewAllLabel, category.label),
    title: buildSubcategoryTitle(subcategory.viewAllLabel, category.label),
    description: buildSubcategoryDescription(subcategory.viewAllLabel, category.label),
    queryAliases: subcategory.queryAliases,
    canonicalPath:
      category.key === "gifts"
        ? `/bulgarski-podaratsi/${subcategory.slug}/`
        : undefined,
  }))
);

const legacyAliasLandings = TAXONOMY_CATEGORIES.flatMap((category) => {
  const categoryAliases = (category.legacySlugs || []).map((slug) => ({
    ...categoryLandings.find((landing) => landing.categoryKey === category.key)!,
    slug,
    hidden: true,
    canonicalSlug: category.slug,
  }));

  const subcategoryAliases = category.subcategories.flatMap((subcategory) =>
    (subcategory.legacySlugs || []).map((slug) => ({
      ...subcategoryLandings.find((landing) => landing.subcategoryKey === subcategory.key)!,
      slug,
      hidden: true,
      canonicalSlug: subcategory.slug,
    }))
  );

  return [...categoryAliases, ...subcategoryAliases];
});

export const CATEGORY_LANDINGS: SeoLanding[] = categoryLandings;
export const SUBCATEGORY_LANDINGS: SeoLanding[] = subcategoryLandings;
export const SEO_LANDINGS: SeoLanding[] = [...categoryLandings, ...subcategoryLandings, ...legacyAliasLandings];

export const SEO_INTENT_LANDINGS: SeoIntentLanding[] = [
  {
    key: "gifts_handmade",
    path: "/bulgarski-podaratsi/rachno-izraboteni/",
    categoryKey: "gifts",
    kind: "keyword",
    label: "Ръчно изработени",
    labelEn: "Handmade",
    h1: "Ръчно изработени български подаръци",
    intro: [
      "Открий ръчно изработени подаръци от български марки и автори, подредени по-ясно и по-лесно за избор.",
      "Тук по-лесно откриваш подаръци, в които личат времето, материалът и човешката ръка зад изработката."
    ],
    title: "Ръчно изработени подаръци | Българитъм",
    description: "Открий ръчно изработени подаръци от български марки в Българитъм.",
    queryAliases: ["ръчно изработени подаръци", "handmade gifts", "традиционни български подаръци"],
    group: "gifts",
    requiresGiftable: true,
    requiresHandmade: true,
  },
  {
    key: "clothing_dresses",
    path: "/bulgarski-drehi/rokli/",
    categoryKey: "clothing",
    audienceSubcategoryKey: "clothing_women",
    kind: "keyword",
    label: "Рокли",
    labelEn: "Dresses",
    h1: "Български рокли",
    intro: [
      "Открий български рокли от локални брандове, подредени така, че да стигаш по-бързо до точния стил.",
      "Запазвай моделите, които ти харесват, и подреждай идеи, към които можеш да се върнеш по-късно."
    ],
    title: "Български рокли | Българитъм",
    description: "Открий български рокли от локални марки в Българитъм.",
    queryAliases: ["български рокли", "рокли", "dresses"],
    group: "clothing",
    matchQueries: ["рокля", "рокли", "dress", "dresses"],
    matchCategoryKeys: ["clothing"],
    clothingTypeKeys: ["dresses"],
  },
  {
    key: "clothing_pajamas",
    path: "/bulgarski-drehi/pizhami/",
    categoryKey: "clothing",
    audienceSubcategoryKey: "clothing_women",
    kind: "keyword",
    label: "Пижами",
    labelEn: "Pajamas",
    h1: "Български пижами",
    intro: [
      "Открий български пижами и нощни сетове от локални марки в по-ясна селекция.",
      "Тук по-лесно намираш продукти за спокоен ритуал у дома и по-меко ежедневие."
    ],
    title: "Български пижами | Българитъм",
    description: "Открий български пижами и нощни сетове от локални марки.",
    queryAliases: ["български пижами", "пижами", "pajamas", "nightwear"],
    group: "clothing",
    matchQueries: ["пижама", "пижами", "нощница", "nightwear", "pajamas", "pyjamas"],
    matchCategoryKeys: ["clothing"],
    clothingTypeKeys: ["pajamas"],
  },
  {
    key: "clothing_bags",
    path: "/bulgarski-drehi/chanti/",
    categoryKey: "clothing",
    audienceSubcategoryKey: "clothing_women",
    kind: "keyword",
    label: "Чанти",
    labelEn: "Bags",
    h1: "Български чанти",
    intro: [
      "Открий български чанти с по-ясна селекция според материал, характер и ежедневна употреба.",
      "Тук можеш да сравняваш по-лесно различни модели и да запазваш онези, които пасват на твоя ритъм."
    ],
    title: "Български чанти | Българитъм",
    description: "Открий български чанти от локални марки в Българитъм.",
    queryAliases: ["български чанти", "чанти", "bags"],
    group: "clothing",
    matchQueries: ["чанта", "чанти", "bag", "bags"],
    matchCategoryKeys: ["accessories", "clothing"],
    clothingTypeKeys: ["bags"],
  },
  {
    key: "clothing_shoes",
    path: "/bulgarski-drehi/obuvki/",
    categoryKey: "clothing",
    audienceSubcategoryKey: "clothing_women",
    kind: "keyword",
    label: "Обувки",
    labelEn: "Shoes",
    h1: "Български обувки",
    intro: [
      "Открий български обувки в по-подредена селекция, когато искаш бърз достъп до локални марки.",
      "Събирай любимите си модели в лични списъци и се връщай към тях, когато искаш да сравниш спокойно."
    ],
    title: "Български обувки | Българитъм",
    description: "Открий български обувки от локални марки в Българитъм.",
    queryAliases: ["български обувки", "обувки", "shoes"],
    group: "clothing",
    matchQueries: ["обувки", "обувка", "shoe", "shoes"],
    matchCategoryKeys: ["accessories", "clothing"],
    clothingTypeKeys: ["shoes"],
  },
  {
    key: "mens_tracksuits",
    path: "/bulgarski-mazhki-antsuzi/",
    categoryKey: "clothing",
    audienceSubcategoryKey: "clothing_men",
    kind: "keyword",
    label: "Анцузи",
    labelEn: "Tracksuits",
    h1: "Български мъжки анцузи",
    intro: [
      "Открий български мъжки анцузи и по-спортни сетове от локални марки в по-подредена селекция.",
      "Тук по-лесно сравняваш модели за движение, пътуване и по-спокойно ежедневно носене."
    ],
    title: "Български мъжки анцузи | Българитъм",
    description: "Открий български мъжки анцузи от локални марки в Българитъм.",
    queryAliases: ["български мъжки анцузи", "мъжки анцузи", "анцузи"],
    group: "clothing",
    matchQueries: ["анцуг", "анцузи", "tracksuit", "tracksuits", "sweatsuit", "спортен комплект"],
    matchCategoryKeys: ["clothing"],
    clothingTypeKeys: ["tracksuits"],
  },
  {
    key: "mens_pajamas",
    path: "/bulgarski-mazhki-pizhami/",
    categoryKey: "clothing",
    audienceSubcategoryKey: "clothing_men",
    kind: "keyword",
    label: "Пижами",
    labelEn: "Pajamas",
    h1: "Български мъжки пижами",
    intro: [
      "Открий български мъжки пижами и домашни сетове от локални марки в по-ясна селекция.",
      "Тук по-лесно намираш модели за по-удобни вечери у дома и по-спокоен ритъм."
    ],
    title: "Български мъжки пижами | Българитъм",
    description: "Открий български мъжки пижами от локални марки.",
    queryAliases: ["български мъжки пижами", "мъжки пижами", "пижами"],
    group: "clothing",
    matchQueries: ["пижама", "пижами", "nightwear", "sleepwear", "pyjamas", "pajamas"],
    matchCategoryKeys: ["clothing"],
    clothingTypeKeys: ["pajamas"],
  },
  {
    key: "mens_sweaters",
    path: "/bulgarski-mazhki-puloveri/",
    categoryKey: "clothing",
    audienceSubcategoryKey: "clothing_men",
    kind: "keyword",
    label: "Пуловери",
    labelEn: "Sweaters",
    h1: "Български мъжки пуловери",
    intro: [
      "Открий български мъжки пуловери и по-меките връхни модели от локални марки в една по-подредена селекция.",
      "Тук можеш по-лесно да намериш варианти за студени дни, работа и ежедневно носене."
    ],
    title: "Български мъжки пуловери | Българитъм",
    description: "Открий български мъжки пуловери от локални марки.",
    queryAliases: ["български мъжки пуловери", "мъжки пуловери", "пуловери"],
    group: "clothing",
    matchQueries: ["пуловер", "пуловери", "sweater", "sweaters", "суичър", "суичъри", "hoodie"],
    matchCategoryKeys: ["clothing"],
    clothingTypeKeys: ["sweaters"],
  },
  {
    key: "mens_jackets",
    path: "/bulgarski-mazhki-yaketa/",
    categoryKey: "clothing",
    audienceSubcategoryKey: "clothing_men",
    kind: "keyword",
    label: "Якета",
    labelEn: "Jackets",
    h1: "Български мъжки якета",
    intro: [
      "Открий български мъжки якета и по-плътни връхни модели от локални марки в по-ясна селекция.",
      "Тук по-лесно сравняваш варианти за сезон, стил и ежедневно носене."
    ],
    title: "Български мъжки якета | Българитъм",
    description: "Открий български мъжки якета от локални марки.",
    queryAliases: ["български мъжки якета", "мъжки якета", "якета"],
    group: "clothing",
    matchQueries: ["яке", "якета", "jacket", "jackets", "палто", "палта"],
    matchCategoryKeys: ["clothing"],
    clothingTypeKeys: ["outerwear"],
  },
  {
    key: "mens_shoes",
    path: "/bulgarski-mazhki-obuvki/",
    categoryKey: "clothing",
    audienceSubcategoryKey: "clothing_men",
    kind: "keyword",
    label: "Обувки",
    labelEn: "Shoes",
    h1: "Български мъжки обувки",
    intro: [
      "Открий български мъжки обувки в по-подредена селекция, когато търсиш локални марки с по-ясен стил.",
      "Тук по-лесно запазваш модели и се връщаш към тях, когато искаш да сравниш спокойно."
    ],
    title: "Български мъжки обувки | Българитъм",
    description: "Открий български мъжки обувки от локални марки в Българитъм.",
    queryAliases: ["български мъжки обувки", "мъжки обувки", "обувки"],
    group: "clothing",
    matchQueries: ["обувки", "обувка", "shoe", "shoes", "боти", "маратонки", "сандали"],
    matchCategoryKeys: ["accessories", "clothing"],
    clothingTypeKeys: ["shoes"],
  },
  {
    key: "souvenirs",
    path: "/bulgarski-suveniri/",
    categoryKey: "fun",
    kind: "keyword",
    label: "Сувенири",
    labelEn: "Souvenirs",
    h1: "Български сувенири",
    intro: [
      "Открий български сувенири и по-малки предмети с характер, които носят локален контекст и спомен.",
      "Тук по-лесно намираш предмети, които носят усещане за място, спомен и по-личен български жест."
    ],
    title: "Български сувенири | Българитъм",
    description: "Открий български сувенири и малки локални находки в Българитъм.",
    queryAliases: ["български сувенири", "сувенири", "традиционни български подаръци"],
    group: "fun",
    matchQueries: ["сувенир", "сувенири", "souvenir", "традиционен", "традиционни", "български подарък"],
    matchCategoryKeys: ["fun", "gifts", "accessories", "home"],
  },
  {
    key: "handmade",
    path: "/rachno-izraboteni/",
    categoryKey: "gifts",
    kind: "keyword",
    label: "Ръчно изработени",
    labelEn: "Handmade",
    h1: "Ръчно изработени български продукти",
    intro: [
      "Открий ръчно изработени български продукти от автори и малки брандове, подредени в по-ясна селекция.",
      "Тази страница събира изделия с видим почерк, по-близка изработка и по-смислено откриване."
    ],
    title: "Ръчно изработени български продукти | Българитъм",
    description: "Открий ръчно изработени български продукти и подаръци в Българитъм.",
    queryAliases: ["ръчно изработени", "ръчно изработени бижута", "handmade bulgarian products"],
    group: "discovery",
    requiresHandmade: true,
  },
];

export const getLandingBySlug = (slug: string) => {
  const normalizedSlug = String(slug || "").trim();
  return SEO_LANDINGS.find((landing) => landing.slug === normalizedSlug) || null;
};

export const getIntentLandingByPath = (path: string) =>
  SEO_INTENT_LANDINGS.find((landing) => landing.path === path) || null;

export const getIntentLandingsForCategory = (categoryKey: CategoryKey, group?: SeoIntentLanding["group"]) =>
  SEO_INTENT_LANDINGS.filter((landing) => landing.categoryKey === categoryKey && (!group || landing.group === group));

export const getIntentLandingsForAudienceSubcategory = (
  categoryKey: CategoryKey,
  audienceSubcategoryKey: SubcategoryKey,
  group?: SeoIntentLanding["group"]
) =>
  SEO_INTENT_LANDINGS.filter(
    (landing) =>
      landing.categoryKey === categoryKey &&
      landing.audienceSubcategoryKey === audienceSubcategoryKey &&
      (!group || landing.group === group)
  );

export const getIntentLandingByKey = (key: string) =>
  SEO_INTENT_LANDINGS.find((landing) => landing.key === key) || null;

export const getCategoryLanding = (categoryKey: string) =>
  CATEGORY_LANDINGS.find((landing) => landing.categoryKey === categoryKey) || null;

export const getSubcategoryLandings = (categoryKey: string) =>
  SUBCATEGORY_LANDINGS.filter((landing) => landing.categoryKey === categoryKey);

export function productMatchesLanding(product: Product, landing: SeoLanding) {
  const taxonomy = getTaxonomyForProduct(product);
  if (!taxonomy.categoryKeys.includes(landing.categoryKey as never)) return false;
  if (landing.kind === "category") return true;
  return Boolean(landing.subcategoryKey && taxonomy.subcategoryKeys.includes(landing.subcategoryKey as never));
}

export function getProductsForLanding(products: Product[], landing: SeoLanding) {
  const matches = products.filter((product) => productMatchesLanding(product, landing));
  return landing.categoryKey === "gifts" ? sortGiftProducts(matches) : matches;
}

const getProductSearchDocument = (product: Product) =>
  buildSearchDocument(
    product.name_bg,
    product.short_desc_bg,
    product.long_desc_bg,
    product.tags,
    product.brand_name,
    product.category
  );

const productMatchesIntentQueries = (product: Product, queries: string[]) => {
  const document = getProductSearchDocument(product);
  return queries.some((query) => matchesSearchValueAgainstDocument(document, query));
};

const productMatchesHandmade = (product: Product) => productMatchesIntentQueries(product, HANDMADE_TERMS);

const productMatchesAudienceContext = (product: Product, audienceSubcategoryKey: SubcategoryKey) => {
  const document = getProductSearchDocument(product);
  const saysWomen = WOMEN_AUDIENCE_TERMS.some((term) => matchesSearchValueAgainstDocument(document, term));
  const saysMen = MEN_AUDIENCE_TERMS.some((term) => matchesSearchValueAgainstDocument(document, term));
  const saysKids = KIDS_AUDIENCE_TERMS.some((term) => matchesSearchValueAgainstDocument(document, term));

  if (audienceSubcategoryKey === "clothing_women") {
    return !saysMen && !saysKids;
  }

  if (audienceSubcategoryKey === "clothing_men") {
    return !saysWomen && !saysKids;
  }

  return true;
};

export function getProductsForIntentLanding(products: Product[], landing: SeoIntentLanding) {
  const matches = products.filter((product) => {
    const taxonomy = getTaxonomyForProduct(product);
    const matchedTypes = landing.clothingTypeKeys?.length
      ? getClothingTypeMatches(product, ALL_CLOTHING_TYPE_OPTIONS)
      : [];

    if (landing.matchCategoryKeys?.length && !landing.matchCategoryKeys.some((key) => taxonomy.categoryKeys.includes(key))) {
      return false;
    }

    if (landing.audienceSubcategoryKey) {
      const isBagLanding = landing.clothingTypeKeys?.includes("bags");
      const isShoeLanding = landing.clothingTypeKeys?.includes("shoes");

      if (isBagLanding || isShoeLanding) {
        const accessoryMatch = isBagLanding
          ? taxonomy.subcategoryKeys.includes("accessories_bags")
          : taxonomy.subcategoryKeys.includes("accessories_shoes");
        const audienceMatch = taxonomy.subcategoryKeys.includes(landing.audienceSubcategoryKey);

        if (!accessoryMatch && !audienceMatch) return false;
        if (!productMatchesAudienceContext(product, landing.audienceSubcategoryKey)) return false;
      } else if (!taxonomy.subcategoryKeys.includes(landing.audienceSubcategoryKey)) {
        return false;
      }
    }

    if (landing.requiresGiftable && !product.giftable) return false;
    if (landing.giftTarget && !product.gift_targets.includes(landing.giftTarget)) return false;
    if (landing.requiresHandmade && !productMatchesHandmade(product)) return false;
    if (landing.clothingTypeKeys?.length) {
      if (!landing.clothingTypeKeys.some((key) => matchedTypes.includes(key))) return false;
    }
    if (landing.matchQueries?.length && !productMatchesIntentQueries(product, landing.matchQueries)) return false;

    return true;
  });

  return landing.categoryKey === "gifts" ? sortGiftProducts(matches) : matches;
}

export function getRelevantLandingsForProduct(product: Product, limit = 3) {
  const taxonomy = getTaxonomyForProduct(product);
  if (!taxonomy.categoryKeys.length) return [];

  const categoryLandings = taxonomy.categoryKeys
    .map((categoryKey) => getCategoryLanding(categoryKey))
    .filter(Boolean);
  const matchingSubcategories = SUBCATEGORY_LANDINGS.filter((landing) =>
    landing.subcategoryKey ? taxonomy.subcategoryKeys.includes(landing.subcategoryKey as never) : false
  );

  return [...categoryLandings, ...matchingSubcategories].slice(0, limit);
}

export function getLandingForQuery(categoryKey: string, query: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return getCategoryLanding(categoryKey);

  return (
    SUBCATEGORY_LANDINGS.find((landing) => {
      if (landing.categoryKey !== categoryKey) return false;
      return (landing.queryAliases || []).some((alias) => normalize(alias) === normalizedQuery);
    }) || getCategoryLanding(categoryKey)
  );
}

export function getLandingDisplayLabel(landing: SeoLanding) {
  if (landing.kind === "subcategory") return landing.viewAllLabel;
  return landing.label;
}

export function getCanonicalSlugForLanding(landing: SeoLanding) {
  return landing.canonicalSlug || landing.slug;
}

export function getCanonicalPathForLanding(landing: SeoLanding) {
  return landing.canonicalPath || `/k/${getCanonicalSlugForLanding(landing)}/`;
}

export function getDisplayCategoryForProduct(product: Product) {
  return getTaxonomyForProduct(product).categoryLabel || getCategoryLabel(product.category);
}

const CLOTHING_EDITORIAL_BY_KEY: Record<
  string,
  {
    header: { kicker?: string; title: string; intro?: string; ariaLabel?: string };
    sections: Array<{ title: string; paragraphs: string[] }>;
  }
> = {
  clothing: {
    header: {
      kicker: "Още контекст",
      title: "Защо хората търсят български дрехи все по-целенасочено",
      intro: "Когато търсенето започва от български дрехи, то обикновено не е само за продукт. Често е за по-ясен стил, по-близък произход и усещане, че откриваш марки с характер."
    },
    sections: [
      {
        title: "Как изглежда по-доброто откриване на български дрехи",
        paragraphs: [
          "Все повече хора търсят български дрехи не само защото искат да купуват локално, а защото искат по-смислен избор. Когато една марка е по-близо като произход и като мащаб, по-лесно можеш да усетиш материала, кройката и посоката, в която е създадена колекцията. Това прави избора по-личен и по-малко анонимен.",
          "Търсенето на български дрехи често започва с нужда от нещо конкретно: рокля, пижама, сако, обувки или чанта. Но в основата стои и нещо друго - желание да откриеш марка, към която можеш да се върнеш. Именно затова страниците за дрехи трябва да помагат не само да разглеждаш, а и да запазваш, сравняваш и подреждаш идеи за по-късно.",
          "Добрата селекция не те залива с всичко наведнъж. Тя ти дава отправна точка към стил, материя и начин на живот. Това е и по-силният смисъл зад думите български дрехи: не просто списък от артикули, а подбран вход към локални марки, които създават с последователност."
        ]
      },
      {
        title: "Защо дрехите от локални марки се откриват по-добре през ясни страници",
        paragraphs: [
          "Когато някой търси български дрехи, той често използва конкретна фраза: български рокли, български пижами, български мъжки пуловери. Това означава, че най-полезните страници са онези, които запазват продукта в центъра, но дават и достатъчно контекст, за да стане изборът по-бърз и по-уверен.",
          "Точно тук се намесва ролята на добре подредените страници. Те позволяват да стигнеш по-бързо до правилната група продукти, да събереш харесаните модели в лична галерия и да се върнеш към тях по-късно. Това прави откриването на български дрехи по-практично и по-близко до реалния начин, по който хората избират какво да носят.",
          "Когато локалните марки са подредени по този начин, се вижда и тяхното разнообразие: от по-ежедневни модели до по-специални находки, от по-мек домашен ритъм до по-изразен градски стил. Така страницата за български дрехи остава лека за използване и по-полезна, когато искаш да откриеш нещо с повече яснота."
        ]
      }
    ]
  },
  clothing_women: {
    header: {
      kicker: "Още контекст",
      title: "Българско дамско облекло с повече яснота и стил",
      intro: "Когато търсиш българско дамско облекло, най-полезното е да имаш по-ясна посока: какво търсиш, какво искаш да запазиш и към кои марки би се върнала отново."
    },
    sections: [
      {
        title: "Какво прави търсенето на българско дамско облекло по-смислено",
        paragraphs: [
          "Българското дамско облекло обикновено се търси с конкретна нагласа. Понякога това е рокля за повод, понякога риза за ежедневно носене, понякога по-спокоен сет за дома. Но зад тази конкретност често стои по-широка нужда: да откриеш марки, които имат собствен стил и не изглеждат като взаимозаменяеми масови предложения.",
          "Именно затова една по-добре подредена страница за българско дамско облекло носи реална стойност. Тя ти помага да стигнеш по-бързо до дрехи, които могат да станат част от твоя ритъм, а не просто до произволни модели. Това е особено полезно, когато искаш да събираш идеи и да сравняваш спокойно, вместо да избираш под натиск.",
          "Българските марки в тази категория често работят с по-видима чувствителност към материята, силуета и настроението на дрехата. Това прави самото търсене на българско дамско облекло по-интересно, защото не се свежда само до размер или цвят, а и до усещане."
        ]
      },
      {
        title: "Как да използваш страницата по-умно, когато търсиш дамски находки",
        paragraphs: [
          "Най-добрият начин да използваш тази страница е да тръгнеш от това, което наистина ти трябва в момента: рокли, пижами, чанти, обувки или нещо по-общо като дамско облекло. После можеш да запазиш моделите, които ти харесват, да направиш собствена галерия и да се върнеш към нея, когато искаш да решиш по-спокойно.",
          "Това е важна част от доброто онлайн откриване. Вместо всичко да зависи от един моментен избор, имаш възможност да подредиш свои малки селекции и да ги споделиш с линк, ако искаш второ мнение. Така страницата за българско дамско облекло става не само място за разглеждане, а и работещ инструмент за избор.",
          "Когато подобни страници се поддържат добре, те помагат и на локалните марки да бъдат откривани по-лесно по търсения като българско дамско облекло, български рокли и български пижами. Това прави избора по-лесен, без страницата да губи усещането си за лекота."
        ]
      }
    ]
  },
  clothing_men: {
    header: {
      kicker: "Още контекст",
      title: "Българско мъжко облекло с по-ясен път към точните модели",
      intro: "Търсенето на българско мъжко облекло обикновено е по-конкретно. Хората по-често започват от тип дреха и затова най-полезна е ясната посока към точните модели."
    },
    sections: [
      {
        title: "Защо българското мъжко облекло се търси по различен начин",
        paragraphs: [
          "Когато някой търси българско мъжко облекло, много често започва с практична дума: мъжки пижами, мъжки пуловери, мъжки якета, мъжки обувки. Това значи, че страницата трябва да пази продукта в центъра, но и да дава достатъчно яснота, за да се стигне бързо до правилния тип дреха.",
          "Точно тук локалните марки могат да се откроят. Вместо да разчиташ само на големи международни каталози, можеш да откриеш българско мъжко облекло с по-собствено присъствие, по-ясна материя и по-добра връзка между стил и реално носене. Това е ценна част от откриването, особено когато търсиш нещо, към което да се връщаш и в бъдеще.",
          "По-добре подредената страница прави този избор по-лесен. Вместо да губиш време в хаотично разглеждане, можеш да минеш през най-търсените групи, да запазиш модели и да подредиш собствена селекция за по-късно."
        ]
      },
      {
        title: "Как да използваш най-търсените мъжки филтри по-полезно",
        paragraphs: [
          "Най-търсените филтри при мъжкото облекло са полезни не само за бърз достъп, а и като начин да влезеш по-точно в логиката на търсенето. Ако знаеш, че ти трябва нещо за дома, започни от пижами. Ако търсиш по-спокойна връхна дреха, започни от пуловери или якета. Ако ти трябва нещо по-подвижно и ежедневно, анцузите са естествена първа стъпка.",
          "Това е важно, защото хората рядко започват от твърде общо търсене. По-често искат точно определен тип дреха и очакват да стигнат до него бързо и без излишен шум.",
          "Когато филтрите и отделните подстраници работят заедно, откриването на българско мъжко облекло става по-полезно. Страницата остава продуктова и чиста, но същевременно помага да намериш онова, което наистина търсиш."
        ]
      }
    ]
  },
  clothing_dresses: {
    header: {
      kicker: "Още контекст",
      title: "Български рокли с по-ясен избор според стил и повод",
      intro: "Когато търсенето започва от български рокли, изборът рядко е само визуален. Често е и търсене на настроение, материя и усещане за това как една рокля влиза в живота ти."
    },
    sections: [
      {
        title: "Как роклите влизат в различни моменти от деня и повода",
        paragraphs: [
          "Фразата български рокли все по-често се използва от хора, които искат по-близки марки, по-ясен стил и усещане, че откриват нещо с характер. Това не означава непременно повод. Понякога става дума за рокля за ежедневно носене, понякога за по-специален момент, а понякога просто за силует, който стои по-меко и по-естествено.",
          "Именно затова страницата за български рокли трябва да помага повече от това да показва продукти. Тя трябва да улеснява сравняването, запазването и връщането към модели, които са ти направили впечатление. Така можеш да избереш рокля не под натиск, а след като видиш какво наистина пасва на твоя стил.",
          "Когато локалните марки са събрани по този начин, по-лесно се вижда и разликата между тях. Някои са по-романтични, други по-минималистични, трети по-артистични. Това прави търсенето на български рокли по-интересно и по-малко шаблонно."
        ]
      },
      {
        title: "Защо една добра страница за рокли помага на избора",
        paragraphs: [
          "Хората обикновено не търсят просто рокля. Търсят нещо за конкретен ден, за конкретно настроение или за момент, в който искат да се чувстват по свой начин. Затова е важно селекцията да дава посока, а не просто много продукти наведнъж.",
          "Ако харесаш модел, можеш да го запазиш, да го добавиш в своя галерия и да се върнеш към него, когато искаш да решиш по-спокойно.",
          "Така страницата за български рокли става полезна и днес, и когато се върнеш към нея по-късно. Тя дава по-ясен вход към точните модели, без да превръща избора в шумен каталог."
        ]
      }
    ]
  },
  clothing_pajamas: {
    header: {
      kicker: "Още контекст",
      title: "Български пижами за по-мек ритъм у дома",
      intro: "Български пижами се търсят не просто като домашно облекло, а като част от по-спокоен ритуал у дома и по-удобно ежедневие."
    },
    sections: [
      {
        title: "Как хората търсят български пижами",
        paragraphs: [
          "Когато някой търси български пижами, той често търси и нещо повече: по-мека материя, по-приятна кройка, усещане за домашен комфорт. Това прави страницата за пижами по-важна, отколкото изглежда на пръв поглед. Тя е вход към продукти, които стоят близо до ежедневието и затова изборът трябва да е ясен.",
          "Българските марки в тази категория често работят с по-внимателен подбор на платове и по-спокойна визуална среда. Това е ценен контраст с масовото търсене, в което пижамата е сведена до функционален артикул. Тук тя може да бъде и част от ритуал, настроение и начин на живот.",
          "Затова страницата за български пижами има смисъл както за откриване, така и за по-ясно присъствие при конкретни търсения. Тя събира точната група продукти на едно място, без да размива избора."
        ]
      },
      {
        title: "Защо е полезно да запазваш и сравняваш домашни сетове",
        paragraphs: [
          "Домашното облекло често се избира по-бавно. Нещо може да ти хареса визуално, но после да поискаш да го сравниш с друга материя, цвят или кройка. Именно тук възможността да запазваш продукти и да правиш собствени галерии става особено полезна.",
          "Когато разглеждаш български пижами, можеш да събереш няколко модела, да се върнеш към тях по-късно и да решиш без излишно бързане. Това е част от по-доброто онлайн откриване: да не избираш всичко в един момент, а да подреждаш идеи по начин, който е удобен за теб.",
          "Така страницата носи две ползи едновременно: по-ясно откриване на български пижами и по-добра подредба за търсенията, с които хората влизат на нея."
        ]
      }
    ]
  },
  clothing_bags: {
    header: {
      kicker: "Още контекст",
      title: "Български чанти и по-ясен избор според стил и употреба",
      intro: "Търсенето на български чанти обикновено е много конкретно. Хората знаят, че им трябва чанта, но искат по-добре подбрани локални марки, а не безкраен каталог."
    },
    sections: [
      {
        title: "Защо страницата за български чанти има собствена стойност",
        paragraphs: [
          "Когато някой търси български чанти, той често сравнява материал, силует, размер и усещане за стил. Това означава, че страницата трябва да бъде едновременно визуално чиста и достатъчно ясна като подбор. Ако всичко е смесено в един общ каталог, добрите находки лесно се губят.",
          "Българските чанти често носят по-силен характер, защото идват от по-малки марки с по-видима естетика. Някои работят с кожа, други с мъниста, трети със собствена авторска форма. Именно тази разлика прави отделната селекция полезна за човека, който търси нещо разпознаваемо за всеки ден или за повод.",
          "Страницата за български чанти така става не само удобна за избор, а и място, където по-лесно различаваш стилове, материали и посоки."
        ]
      },
      {
        title: "Как да използваш страницата, когато сравняваш модели",
        paragraphs: [
          "Чантата е продукт, който хората често сравняват по-бавно. Първо идва визуалното впечатление, после функцията, после въпросът дали моделът наистина пасва на ежедневието. Затова тази страница е полезна, когато искаш да запазиш няколко модела и да се върнеш към тях след ден или два.",
          "Най-приятният вариант е страницата да остане продуктова, а по-широкият контекст да стои по-долу. Така тя е удобна за разглеждане, но и дава достатъчно усещане за стиловете и посоките, които можеш да откриеш тук.",
          "Когато подобна селекция е добре подредена, по-лесно стигаш до точните модели и можеш да ги запазиш за по-късно, вместо да губиш добрите находки в по-широка категория."
        ]
      }
    ]
  },
  clothing_shoes: {
    header: {
      kicker: "Още контекст",
      title: "Български обувки и ботуши в по-подредена селекция",
      intro: "Когато търсенето е за български обувки или ботуши, хората обикновено искат бърз достъп до модели с характер и ясно изразена локална марка."
    },
    sections: [
      {
        title: "Какво търсят хората, когато пишат български обувки",
        paragraphs: [
          "Търсенето на български обувки често е много практично. То може да е за обувки за всеки ден, за по-конкретен сезон или дори за ботуши, когато времето и стилът го изискват. Именно затова е полезно да виждаш точната група продукти на едно място, без шум от останалите категории.",
          "Когато обувките идват от локални марки, много хора търсят и по-ясно усещане за материал, изработка и дълготрайност. Това прави избора по-внимателен и по-бавен. Не е нещо, което се решава с един бърз scroll. Нужно е да можеш да сравниш модели и да се върнеш към тях по-късно.",
          "Затова страницата за български обувки и ботуши трябва да помага както на търсенето, така и на подреждането на идеи. Така продуктите остават в центъра, но изборът става по-лек."
        ]
      },
      {
        title: "Защо тази страница помага и на реалния избор",
        paragraphs: [
          "При обувките хората най-често сравняват форма, предназначение и това дали даден модел би се вписал в ежедневието им. Затова страницата работи най-добре, когато ти позволява бързо да отделиш моделите, които си струва да запазиш за по-късно.",
          "Ако изборът не се случва веднага, можеш да си направиш собствена галерия и да се върнеш към нея, когато решаваш по-спокойно.",
          "Това е по-естественият начин да откриеш точния модел, особено при обувки."
        ]
      }
    ]
  },
  mens_tracksuits: {
    header: {
      kicker: "Още контекст",
      title: "Български мъжки анцузи за движение и по-спокойно ежедневие",
      intro: "Страницата за български мъжки анцузи е полезна точно защото това е много конкретно търсене. Хората знаят какво искат и очакват ясен избор."
    },
    sections: [
      {
        title: "Кога мъжките анцузи стават наистина полезна находка",
        paragraphs: [
          "Мъжките анцузи обикновено се търсят за съвсем реални моменти от деня: пътуване, разходка, работа от вкъщи, спорт, по-спокоен уикенд или просто дрехи, в които да се движиш леко. Точно затова селекцията има смисъл, когато не е разпиляна, а събира модели, които пасват на такъв ритъм.",
          "Когато разглеждаш подобна страница, е по-лесно да сравниш материи, кройки и усещане за комфорт, вместо да минаваш през всичко в мъжкото облекло. Така изборът става по-спокоен и по-близък до начина, по който човек наистина решава какво ще носи.",
          "Най-полезни са онези модели, които можеш да си представиш в живота си веднага: за сутрин в движение, за дълъг път, за неангажиращ ден или за по-спортно ежедневие."
        ]
      },
      {
        title: "Как да използваш селекцията по-спокойно и практично",
        paragraphs: [
          "Ако не искаш да решаваш веднага, запази няколко модела в своя галерия и се върни към тях по-късно. Това е особено удобно при дрехи, които избирате по усещане и удобство, а не само по снимка.",
          "Можеш и да подредиш кратък списък за сравнение: кои модели изглеждат по-спортни, кои са по-чисти и минимални, кои биха паснали на всекидневието ти. Така селекцията започва да работи като помощник, а не само като списък с продукти.",
          "Ако искаш второ мнение, можеш да споделиш галерията си с линк. Това прави избора по-лек и по-полезен, когато търсиш нещо за реалния си ритъм на живот."
        ]
      }
    ]
  },
  mens_pajamas: {
    header: {
      kicker: "Още контекст",
      title: "Български мъжки пижами с по-ясен достъп до точните модели",
      intro: "Това е търсене с много конкретна функция и затова страницата трябва да е стегната, ясна и лесна за сравнение."
    },
    sections: [
      {
        title: "Защо удобството е в центъра, когато избираш мъжки пижами",
        paragraphs: [
          "Мъжките пижами почти винаги се избират с мисъл за удобство, материя и това как се усеща дрехата у дома. Това не е импулсивна покупка. Често е избор за по-спокоен вечерен ритъм, за по-приятни сутрини и за усещане, че си добре в собственото си ежедневие.",
          "Когато селекцията е ясна, по-лесно виждаш кои модели са по-леки, кои са по-топли и кои биха паснали на навиците ти през различните сезони. Това прави избора по-личен, а не просто бърз.",
          "Точно затова страницата е най-полезна, когато оставя продукта в центъра и ти позволява да сравняваш спокойно, без да се разсейваш от несвързани дрехи."
        ]
      },
      {
        title: "Защо е полезно да запазваш домашните модели",
        paragraphs: [
          "Домашното облекло често се избира по-бавно, защото удобството и усещането са важни. Ако не искаш да решаваш веднага, можеш да запазиш няколко мъжки пижами в галерия и да се върнеш към тях по-късно.",
          "Това е особено полезно, когато искаш да сравниш материи, кройки или просто да си оставиш няколко добри идеи за момент, в който решаваш по-спокойно. Вместо да започваш отначало, вече имаш подреден свой кратък списък.",
          "Ако искаш, можеш и да споделиш тази галерия с линк. Така изборът остава лек и практичен, а страницата се превръща в нещо повече от каталог."
        ]
      }
    ]
  },
  mens_sweaters: {
    header: {
      kicker: "Още контекст",
      title: "Български мъжки пуловери и по-добре подреден избор за студени дни",
      intro: "Тук по-лесно стигаш до модели, които хората най-често търсят по сезон, материя и усещане."
    },
    sections: [
      {
        title: "Как пуловерите се вписват в студените дни и ежедневния ритъм",
        paragraphs: [
          "Търсенето на български мъжки пуловери е конкретно и сезонно, но не само. Много хора търсят модели, които да пасват на работа, на ежедневно носене или на по-спокоен зимен гардероб. Това означава, че отделната селекция има реална стойност като вход към точната група продукти.",
          "Вместо човекът да преглежда цялата категория мъжко облекло, той попада директно в модели, които отговарят на тази нужда. Това прави сравнението по-лесно и по-малко уморително.",
          "А когато локалните марки са представени в такъв фокус, различията между тях изпъкват по-ясно: текстура, материал, визуален език и настроение."
        ]
      },
      {
        title: "Как да използваш страницата, когато сравняваш модели",
        paragraphs: [
          "Пуловерът е дреха, която често избираш след известно сравнение. Искаш да видиш как стои, какъв е материалът, колко е ежедневен или по-елегантен. В такъв тип категории възможността да запазваш модели и да се връщаш към тях е особено полезна.",
          "Това прави страницата за български мъжки пуловери по-практична. Тя е удобен начин да подредиш идеи за нещо, което наистина планираш да носиш.",
          "Точно така подобна страница помага едновременно на избора и на по-доброто откриване: ясна тема, ясен подбор и възможност за по-бавен, по-уверен избор."
        ]
      }
    ]
  },
  mens_jackets: {
    header: {
      kicker: "Още контекст",
      title: "Български мъжки якета с по-ясна посока според сезон и стил",
      intro: "Когато някой търси български мъжки якета, той най-често има конкретна нужда. Затова тук най-важни са яснотата и спокойният избор."
    },
    sections: [
      {
        title: "Какво прави търсенето на български мъжки якета различно",
        paragraphs: [
          "При якетата изборът обикновено е функционален, но и стилов. Хората търсят нещо, което да пасне на сезон, ежедневие и общ силует. Затова фразата български мъжки якета носи много по-конкретно намерение от общото мъжко облекло.",
          "Когато тази страница е добре подредена, тя отговаря по-точно на очакването на потребителя и дава по-полезен избор на самия човек, който е влязъл тук с конкретна идея.",
          "В тази категория локалните марки могат да се откроят със собствено усещане за форма, материя и сезонност. Отделната селекция дава шанс това да се види по-ясно."
        ]
      },
      {
        title: "Защо подредбата е важна и за потребителя, и за марките",
        paragraphs: [
          "Когато моделите са събрани на едно място, можеш да ги сравняваш спокойно и да запазиш онези, които ти говорят най-много. Това е особено полезно при връхни дрехи, където изборът рядко се случва импулсивно.",
          "Тази възможност да създаваш собствени списъци прави страницата по-ценна и след първото посещение. Човек може да се върне към нея, когато е готов да реши. Това е силен слой за по-спокоен избор, който подкрепя цялото откриване.",
          "Затова подобна страница работи най-добре, когато остава лека и продуктова, но ти дава достатъчно смисъл, за да избираш по-уверено."
        ]
      }
    ]
  },
  mens_shoes: {
    header: {
      kicker: "Още контекст",
      title: "Български мъжки обувки и ботуши в по-ясна селекция",
      intro: "Тук можеш по-лесно да стигнеш до конкретни модели, когато вече знаеш, че търсиш обувки или ботуши."
    },
    sections: [
      {
        title: "Как хората търсят български мъжки обувки",
        paragraphs: [
          "Когато някой търси мъжки обувки или ботуши, той обикновено знае какво му трябва и очаква да попадне на точна, а не разлята селекция. Именно затова тази по-тясна селекция е полезна.",
          "Когато обувките са подредени по този начин, по-лесно се сравняват модели, материали и стилове. Това е полезно за потребителя, защото помага да отдели моделите, към които би се върнал по-късно.",
          "Страницата работи най-добре, когато запази продукта в центъра и в същото време ясно показва какъв тип артикули събира."
        ]
      },
      {
        title: "Защо обувките са категория, към която хората се връщат",
        paragraphs: [
          "Обувките рядко се избират за секунди. Човек често разглежда, сравнява и запазва варианти, преди да вземе решение. Именно затова е полезно страницата да позволява да събираш модели в лична галерия и да се връщаш към тях по-късно.",
          "Това я прави реално полезна и след първия клик. Връщането към вече запазени модели е част от по-спокойното откриване, а не просто от импулсивното разглеждане.",
          "Така страницата за български мъжки обувки и ботуши не е само вход към търсене. Тя е вход към по-качествен избор и по-добро откриване на локални марки."
        ]
      }
    ]
  }
};

export function getClothingEditorialForLanding(landing: { categoryKey: string; subcategoryKey?: string; key?: string }) {
  if (landing.categoryKey !== "clothing") return null;
  if (landing.key && CLOTHING_EDITORIAL_BY_KEY[landing.key]) return CLOTHING_EDITORIAL_BY_KEY[landing.key];
  if (landing.subcategoryKey && CLOTHING_EDITORIAL_BY_KEY[landing.subcategoryKey]) return CLOTHING_EDITORIAL_BY_KEY[landing.subcategoryKey];
  if (CLOTHING_EDITORIAL_BY_KEY[landing.categoryKey]) return CLOTHING_EDITORIAL_BY_KEY[landing.categoryKey];
  return null;
}

export function getResolvedLandingFromSlug(slug: string) {
  const key = resolveLandingKeyFromSlug(slug);
  if (!key) return getLandingBySlug(slug);

  const category = getCategoryConfig(getCategoryKey(key));
  if (category && category.key === key) {
    return getCategoryLanding(key);
  }

  return SUBCATEGORY_LANDINGS.find((landing) => landing.subcategoryKey === key) || null;
}
