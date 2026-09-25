import type { Product } from "./products";
import primaryClusterSpecs from "../data/primary-cluster-landings.json";
import { getPublicBrowseForProduct, PUBLIC_BROWSE_CATEGORIES } from "./public-browse-taxonomy";
import type { GiftTarget } from "./gifts";
import { sortGiftProducts } from "./gifts";
import { isNaturalMaterialClothing } from "./natural-material-clothing";
import { buildSearchDocument, matchesSearchValueAgainstDocument } from "./search";
import { getClothingTypeMatches, ALL_CLOTHING_TYPE_OPTIONS } from "./clothing-types";
import {
  type CategoryKey,
  type SubcategoryKey,
  getCategoryConfig,
  getCategoryKey,
  getCategoryLabel,
  getCategoryLabelForLang,
  getSubcategoryLabelForLang,
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
  giftFilters?: GiftLandingFilters;
  structuredState?: Record<string, string[]>;
  editorialHeader?: {
    kicker?: string;
    title: string;
    intro?: string;
    ariaLabel?: string;
  };
  editorialSections?: Array<{ title: string; paragraphs: string[] }>;
};

export type GiftLandingFilters = {
  giftable: true;
  recipients?: string[];
  occasions?: string[];
  ages?: string[];
  genders?: string[];
  attributes?: string[];
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
  attributes?: string[];
  recipients?: string[];
  occasions?: string[];
  ages?: string[];
  genders?: string[];
  productTypes?: string[];
  structuredCategory?: string;
  structuredSubcategory?: string;
  materials?: string[];
  textAny?: string[];
  textAll?: string[];
  clothingTypeKeys?: string[];
  structuredState?: Record<string, string[]>;
  parentKey?: string | null;
  primaryKeyword?: string;
  clusterKeywords?: string[];
  showInParentNavigation?: boolean;
  editorialHeader?: {
    kicker?: string;
    title: string;
    intro?: string;
    ariaLabel?: string;
  };
  editorialSections?: Array<{ title: string; paragraphs: string[] }>;
};

export type SeoBrandLanding = {
  key: string;
  path: string;
  categoryKey: CategoryKey;
  kind: "brand-directory";
  h1: string;
  title: string;
  description: string;
  intro: string[];
};

export type PublicLanding = SeoLanding | SeoIntentLanding | SeoBrandLanding;

export type LandingSeoTarget = {
  primaryKeyword: string;
  h1: string;
  title: string;
  description: string;
  intro: string[];
};

export type LandingGraphNode = {
  key: string;
  parentKey: string | null;
  pageType: "category" | "subcategory" | "intent" | "brand-directory";
  canonicalUrl: string;
  navigationLabel: string;
  navigationLabelEn: string;
  seoLabel: string;
  seo: LandingSeoTarget;
  order: number;
  showInParentNavigation: boolean;
  audienceContext?: SubcategoryKey;
  landing: PublicLanding;
};

export type LandingPill = {
  key: string;
  label: string;
  labelEn: string;
  href: string;
  isActive: boolean;
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
  `Открий ${label.toLowerCase()} от български марки и разгледай подбрани продукти на едно място.`,
  `Сравнявай предложенията спокойно, запазвай любимите си находки и се връщай към тях по-късно.`,
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
  h1: category.key === "cosmetics" ? "Българска козметика" : category.label,
  intro: buildCategoryIntro(category.label),
  title: category.key === "cosmetics" ? "Българска козметика | Българитъм" : buildCategoryTitle(category.label),
  description: category.key === "cosmetics"
    ? "Открий българска козметика за лице, тяло и коса от локални марки в Българитъм."
    : buildCategoryDescription(category.label),
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
    label: subcategory.key === "accessories_bags" ? "Чанти и портфейли" : subcategory.label,
    viewAllLabel: subcategory.key === "accessories_bags" ? "Чанти и портфейли" : subcategory.viewAllLabel,
    h1: subcategory.key === "accessories_bags" ? "Чанти и портфейли" : subcategory.viewAllLabel,
    intro: buildSubcategoryIntro(subcategory.viewAllLabel, category.label),
    title: buildSubcategoryTitle(subcategory.key === "accessories_bags" ? "Чанти и портфейли" : subcategory.viewAllLabel, category.label),
    description: buildSubcategoryDescription(subcategory.key === "accessories_bags" ? "Чанти и портфейли" : subcategory.viewAllLabel, category.label),
    queryAliases: subcategory.queryAliases,
    giftFilters: category.key === "gifts" ? ({
      giftable: true,
      ...(subcategory.key === "gifts_for_her" ? { recipients: ["За жена"] } : {}),
      ...(subcategory.key === "gifts_for_him" ? { recipients: ["За мъж"] } : {}),
      ...(subcategory.key === "gifts_for_child" ? { recipients: ["За дете"] } : {}),
      ...(subcategory.key === "gifts_for_baby" ? { recipients: ["За бебе"] } : {}),
      ...(subcategory.key === "gifts_for_wedding" ? { occasions: ["Сватба"] } : {}),
    } satisfies GiftLandingFilters) : undefined,
    canonicalPath:
      category.key === "gifts"
        ? `/bulgarski-podaratsi/${subcategory.slug}/`
        : subcategory.key === "kids_clothing" ? "/bulgarski-detski-drehi/" : undefined,
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

const BASE_SEO_INTENT_LANDINGS: SeoIntentLanding[] = [
  {
    key: "gifts_handmade",
    path: "/bulgarski-podaratsi/rachno-izraboteni/",
    categoryKey: "gifts",
    kind: "keyword",
    label: "Ръчно изработени",
    labelEn: "Handmade",
    h1: "Ръчно изработени подаръци",
    intro: [
      "Открий ръчно изработени подаръци от български марки и автори, подредени по-ясно и по-лесно за избор.",
      "Тук по-лесно откриваш подаръци, в които личат времето, материалът и човешката ръка зад изработката."
    ],
    title: "Ръчно изработени подаръци | Българитъм",
    description: "Открий ръчно изработени подаръци от български марки в Българитъм.",
    queryAliases: ["ръчно изработени подаръци", "handmade gifts", "традиционни български подаръци"],
    group: "gifts",
    requiresGiftable: true,
    attributes: ["Ръчна изработка"],
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
    structuredCategory: "Облекло",
    structuredSubcategory: "Дамско облекло",
    productTypes: ["Пижами и домашни комплекти"],
    matchQueries: ["пижама", "пижами", "нощница", "nightwear", "pajamas", "pyjamas"],
    matchCategoryKeys: ["clothing"],
    clothingTypeKeys: ["pajamas"],
  },
  {
    key: "clothing_bags",
    path: "/bulgarski-drehi/chanti/",
    // The historical URL is retained; product hierarchy comes from structured data.
    categoryKey: "accessories",
    subcategoryKey: "accessories_bags",
    kind: "keyword",
    label: "Чанти",
    labelEn: "Bags",
    h1: "Чанти от български брандове",
    intro: ["Запознай се с разнообразието от текстури, материали и силуети, създадени от българските производители на чанти. Навигирай филтрите на Българитъм за материал, бюджет и стил, за да намериш правилната находка."],
    title: "Български чанти | Българитъм",
    description: "Открий български чанти от локални марки в Българитъм.",
    primaryKeyword: "български чанти",
    queryAliases: ["български чанти", "чанти", "bags"],
    group: "discovery",
    structuredCategory: "Аксесоари",
    structuredSubcategory: "Чанти и портфейли",
    productTypes: ["Чанти"],
    structuredState: { category: ["Аксесоари"], subcategory: ["Чанти и портфейли"], product_type: ["Чанти"] },
    editorialHeader: { title: "Българските чанти като показател за разнообразието на родния пазар" },
    editorialSections: [{
      title: "",
      paragraphs: [
        "Изучавайки българските производители, именно българските чанти са една от нишите, които за нас от Българитъм са много показателни за красотата на родното производство.",
        "На пръв поглед, когато човек търси, да речем, кожена чанта от местен производител, вероятно си представя определен силует. Нещо, което сме свикнали да виждаме при големите компании за бърза мода, или стандартни модели, които заради сигурността на дизайна си са широко разпространени.",
        "Това, което ние обичаме да намираме в Българитъм, е именно разновидността на този привидно стандартен продукт.",
        "Когато разглеждаме дори толкова конкретен продуктов тип като чантите от естествена кожа, стигаме до заключението, че красотата на нишата е именно в това, че всеки производител интерпретира продукта по свой собствен начин.",
        "Различни силуети, различна функционалност, различни материали и различни причини тези материали да бъдат използвани. Това е част от красотата на българското производство — че зад всеки един от тези продукти стои преценен избор, който следва визуалния език и посоката на конкретния бранд.",
      ],
    }],
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
    structuredCategory: "Облекло",
    structuredSubcategory: "Мъжко облекло",
    productTypes: ["Пижами и домашни комплекти"],
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
    h1: "Ръчно изработени",
    intro: [
      "Открий ръчно изработени български продукти от автори и малки брандове, подредени в по-ясна селекция.",
      "Тази страница събира изделия с видим почерк, по-близка изработка и по-смислено откриване."
    ],
    title: "Ръчно изработени | Българитъм",
    description: "Открий ръчно изработени български продукти и подаръци в Българитъм.",
    queryAliases: ["ръчно изработени", "ръчно изработени бижута", "handmade bulgarian products"],
    group: "discovery",
    requiresHandmade: true,
  },
  {
    key: "cosmetics_natural", path: "/naturalna-bulgarska-kozmetika/", categoryKey: "cosmetics", kind: "keyword",
    label: "Натурална козметика", labelEn: "Natural cosmetics", h1: "Натурална българска козметика",
    intro: ["Разгледай натурална българска козметика от локални марки и сравни различни продукти за ежедневна грижа."],
    title: "Натурална българска козметика | Българитъм", description: "Разгледай натурална българска козметика от локални марки в Българитъм.",
    group: "discovery", structuredCategory: "Козметика", attributes: ["Натурален"],
  },
  {
    key: "cosmetics_bio", path: "/bulgarska-bio-kozmetika/", categoryKey: "cosmetics", kind: "keyword",
    label: "Био козметика", labelEn: "Organic cosmetics", h1: "Българска био козметика",
    intro: ["Разгледай българска био козметика от локални марки и сравни наличните продукти за ежедневна грижа."],
    title: "Българска био козметика | Българитъм", description: "Разгледай българска био козметика от локални марки в Българитъм.",
    group: "discovery", structuredCategory: "Козметика", attributes: ["Био сертифициран"],
  },
  {
    key: "jewelry_medical_steel", path: "/bizhuta-ot-meditsinska-stomana/", categoryKey: "accessories", subcategoryKey: "accessories_jewelry", kind: "keyword",
    label: "Медицинска стомана", labelEn: "Medical steel", h1: "Бижута от медицинска стомана",
    intro: ["Открий бижута от медицинска стомана от български брандове и автори.", "Разгледай наличните обеци, гривни и други модели в ясна продуктова селекция."],
    title: "Бижута от медицинска стомана | Българитъм", description: "Открий бижута от медицинска стомана от български марки в Българитъм.",
    group: "discovery", textAll: ["медицинска стомана"],
  },
  {
    key: "jewelry_gilded", path: "/pozlateni-bizhuta/", categoryKey: "accessories", subcategoryKey: "accessories_jewelry", kind: "keyword",
    label: "Позлатени бижута", labelEn: "Gold-plated jewelry", h1: "Позлатени бижута",
    intro: ["Открий позлатени бижута от български марки и автори.", "Сравни наличните модели и запази изделията, които най-добре пасват на твоя стил."],
    title: "Позлатени бижута | Българитъм", description: "Открий позлатени бижута от български марки в Българитъм.",
    group: "discovery", textAny: ["позлатен", "позлатени", "позлата"],
  },
  {
    key: "jewelry_men", path: "/mazhki-bizhuta/", categoryKey: "accessories", subcategoryKey: "accessories_jewelry", kind: "keyword",
    label: "Мъжки бижута", labelEn: "Men's jewelry", h1: "Мъжки бижута",
    intro: ["Открий мъжки бижута и аксесоари от български брандове.", "Разгледай селекцията по вид продукт, материал и стил."],
    title: "Мъжки бижута | Българитъм", description: "Открий мъжки бижута и аксесоари от български марки.",
    group: "discovery", structuredCategory: "Аксесоари", structuredSubcategory: "Мъжки бижута", productTypes: ["Гривни", "Пръстени"],
  },
  {
    key: "jewelry_handmade", path: "/rachno-izraboteni-bizhuta/", categoryKey: "accessories", subcategoryKey: "accessories_jewelry", kind: "keyword",
    label: "Ръчно изработени бижута", labelEn: "Handmade jewelry", h1: "Ръчно изработени бижута",
    intro: ["Открий ръчно изработени бижута от български автори и малки брандове.", "Разгледай изделия с видим почерк, внимание към материала и по-малки серии."],
    title: "Ръчно изработени бижута | Българитъм", description: "Открий ръчно изработени бижута от български автори в Българитъм.",
    group: "discovery", attributes: ["Ръчна изработка"], productTypes: ["Обеци", "Гривни", "Колиета"],
  },
  {
    key: "jewelry_pearls", path: "/bizhuta-s-perli/", categoryKey: "accessories", subcategoryKey: "accessories_jewelry", kind: "keyword",
    label: "Бижута с перли", labelEn: "Pearl jewelry", h1: "Бижута с перли",
    intro: ["Открий бижута с перли от български брандове и автори.", "Разгледай колиета, обеци и други модели с перлени детайли."],
    title: "Бижута с перли | Българитъм", description: "Открий бижута с перли от български марки в Българитъм.",
    group: "discovery", textAny: ["перла", "перли", "перлен"],
  },
  {
    key: "jewelry_box", path: "/kutiya-za-bizhuta/", categoryKey: "accessories", kind: "keyword",
    label: "Кутия за бижута", labelEn: "Jewelry box", h1: "Кутия за бижута",
    intro: ["Открий кутия за бижута от български марки и автори.", "Тук ще добавяме практични и красиви решения за съхранение на любимите ти бижута."],
    title: "Кутия за бижута | Българитъм", description: "Открий кутия за бижута от български брандове в Българитъм.",
    group: "discovery", textAll: ["кутия", "бижута"],
  },
  {
    key: "handmade_cards", path: "/rachno-izraboteni-kartichki/", categoryKey: "books", kind: "keyword",
    label: "Ръчно изработени картички", labelEn: "Handmade cards", h1: "Ръчно изработени картички",
    intro: ["Открий ръчно изработени картички от български илюстратори и малки студиа.", "Разгледай картички за рожден ден, сватба и други лични поводи."],
    title: "Ръчно изработени картички | Българитъм", description: "Открий ръчно изработени картички от български автори.",
    group: "discovery", attributes: ["Ръчна изработка"], textAny: ["картичка", "картички"],
  },
  {
    key: "handmade_candles", path: "/rachno-izraboteni-sveshti/", categoryKey: "home", kind: "keyword",
    label: "Ръчно изработени свещи", labelEn: "Handmade candles", h1: "Ръчно изработени свещи",
    intro: ["Открий ръчно изработени свещи от български брандове.", "Разгледай ароматни и декоративни свещи за дома или подарък."],
    title: "Ръчно изработени свещи | Българитъм", description: "Открий ръчно изработени свещи от български марки.",
    group: "discovery", attributes: ["Ръчна изработка"], productTypes: ["Ароматни свещи"],
  },
  {
    key: "handmade_earrings", path: "/rachno-izraboteni-obetsi/", categoryKey: "accessories", subcategoryKey: "accessories_jewelry", kind: "keyword",
    label: "Ръчно изработени обеци", labelEn: "Handmade earrings", h1: "Ръчно изработени обеци",
    intro: ["Открий ръчно изработени обеци от български автори.", "Разгледай различни материали, форми и малки авторски серии."],
    title: "Ръчно изработени обеци | Българитъм", description: "Открий ръчно изработени обеци от български автори.",
    group: "discovery", attributes: ["Ръчна изработка"], productTypes: ["Обеци"],
  },
  {
    key: "handmade_bracelets", path: "/rachno-izraboteni-grivni/", categoryKey: "accessories", subcategoryKey: "accessories_jewelry", kind: "keyword",
    label: "Ръчно изработени гривни", labelEn: "Handmade bracelets", h1: "Ръчно изработени гривни",
    intro: ["Открий ръчно изработени гривни от български автори.", "Тук ще намираш модели от естествени камъни, мъниста, метал и други материали."],
    title: "Ръчно изработени гривни | Българитъм", description: "Открий ръчно изработени гривни от български марки и автори.",
    group: "discovery", attributes: ["Ръчна изработка"], productTypes: ["Гривни"],
  },
  {
    key: "women_bags", path: "/bulgarski-drehi/damski-chanti/", categoryKey: "accessories", subcategoryKey: "accessories_bags", kind: "keyword",
    label: "Дамски чанти", labelEn: "Women's bags", h1: "Български дамски чанти",
    intro: ["Открий български дамски чанти от локални марки и малки дизайнерски студиа.", "Разгледай модели за ежедневието, специален повод и подарък."],
    title: "Български дамски чанти | Българитъм", description: "Открий български дамски чанти от локални марки в Българитъм.",
    group: "discovery", productTypes: ["Чанти"],
    structuredState: { category: ["Аксесоари"], subcategory: ["Чанти и портфейли"], product_type: ["Чанти"], audience: ["Жени"] },
  },
  {
    key: "women_tracksuits", path: "/bulgarski-damski-sportni-ekipi/", categoryKey: "clothing", audienceSubcategoryKey: "clothing_women", kind: "keyword",
    label: "Дамски спортни екипи", labelEn: "Women's tracksuits", h1: "Български дамски спортни екипи",
    intro: ["Открий български дамски спортни екипи от локални марки.", "Тук ще добавяме комплекти за движение, пътуване и удобно ежедневие."],
    title: "Български дамски спортни екипи | Българитъм", description: "Открий български дамски спортни екипи от локални марки.",
    group: "clothing", structuredCategory: "Облекло", structuredSubcategory: "Дамско облекло", productTypes: ["Спортни екипи"],
  },
  {
    key: "women_pajamas", path: "/bulgarski-damski-pizhami/", categoryKey: "clothing", audienceSubcategoryKey: "clothing_women", kind: "keyword",
    label: "Дамски пижами", labelEn: "Women's pajamas", h1: "Български дамски пижами",
    intro: ["Открий български дамски пижами и домашни комплекти от локални марки.", "Разгледай модели за спокоен ритъм у дома и избери според своя стил."],
    title: "Български дамски пижами | Българитъм", description: "Открий български дамски пижами и домашни комплекти от локални марки.",
    group: "clothing", structuredCategory: "Облекло", structuredSubcategory: "Дамско облекло", productTypes: ["Пижами и домашни комплекти"],
  },
  {
    key: "clothing_linen",
    path: "/bulgarski-leneni-drehi/",
    categoryKey: "clothing",
    kind: "keyword",
    label: "Ленени дрехи",
    labelEn: "Linen clothing",
    h1: "Български ленени дрехи",
    intro: ["Разгледай български ленени дрехи от български марки в Българитъм."],
    title: "Български ленени дрехи от български марки | Българитъм",
    description: "Открий български ленени дрехи от български марки и сравни наличните модели от лен и ленени смеси в Българитъм.",
    group: "clothing",
    matchCategoryKeys: ["clothing"],
    materials: ["Лен"],
    editorialHeader: {
      kicker: "Материал и контекст",
      title: "Повече за ленените дрехи",
      intro: "Кратък контекст за лена като текстил и за мястото му в българското производство и съвременното облекло.",
      ariaLabel: "Повече за лена и ленените дрехи",
    },
    editorialSections: [
      {
        title: "Ленът и българската текстилна традиция",
        paragraphs: [
          "Отглеждането на лен и производството на ленен текстил имат исторически корени в България. Материалът е използван за тъкани с различно предназначение, включително за дома и за облекло, без това да означава, че съвременните продукти непременно използват лен, отгледан или изтъкан в страната.",
        ],
      },
      {
        title: "Самоков и „Рилски лен“",
        paragraphs: [
          "В Самоков инициатива за организирано ленено производство датира от 1939 г. По-късно предприятието „Рилски лен“ се разширява и модернизира, като произвежда ленени прежди и платове за интериор и облекло.",
          "През по-късните десетилетия на XX век платовете за облекло заемат важно място в производството, а български ленени текстили са представяни и изнасяни в чужбина.",
        ],
      },
      {
        title: "Ленът в облеклото",
        paragraphs: [
          "В облеклото ленът може да се срещне самостоятелно или в смес с памук, вискоза и други влакна. Затова провери състава на конкретния продукт, когато сравняваш различни модели и смеси.",
        ],
      },
      {
        title: "Български марки и ленени дрехи",
        paragraphs: [
          "Българитъм събира ленени дрехи от български марки на едно място, за да можеш да откриваш и сравняваш наличните модели. Така различни български марки за ленени дрехи могат да бъдат разглеждани в обща продуктова селекция, без да се създават отделни страници за близки варианти на едно и също търсене.",
        ],
      },
    ],
  },
  {
    key: "gift_man_birthday", path: "/podarak-za-mazh-za-rozhden-den/", categoryKey: "gifts", kind: "keyword",
    label: "За мъж за рожден ден", labelEn: "Birthday gifts for him", h1: "Подарък за мъж за рожден ден",
    intro: ["Открий подарък за мъж за рожден ден от български брандове.", "Разгледай практични, лични и ръчно изработени предложения за повода."],
    title: "Подарък за мъж за рожден ден | Българитъм", description: "Открий подарък за мъж за рожден ден от български марки.",
    group: "gifts", requiresGiftable: true, recipients: ["За мъж"], occasions: ["Рожден ден"],
  },

  {
    key: "gift_man_christmas", path: "/koleden-podarak-za-mazh/", categoryKey: "gifts", kind: "keyword",
    label: "Коледен подарък за мъж", labelEn: "Christmas gifts for him", h1: "Коледен подарък за мъж",
    intro: ["Открий коледен подарък за мъж от български брандове.", "Тук събираме сезонни комплекти, аксесоари и лични подаръци."],
    title: "Коледен подарък за мъж | Българитъм", description: "Открий коледен подарък за мъж от български марки.",
    group: "gifts", requiresGiftable: true, recipients: ["За мъж"], occasions: ["Коледа"],
  },
  {
    key: "gift_woman_christmas", path: "/koleden-podarak-za-zhena/", categoryKey: "gifts", kind: "keyword",
    label: "Коледен подарък за жена", labelEn: "Christmas gifts for her", h1: "Коледен подарък за жена",
    intro: ["Открий коледен подарък за жена от български брандове.", "Разгледай сезонни комплекти, грижа, бижута и продукти за уют."],
    title: "Коледен подарък за жена | Българитъм", description: "Открий коледен подарък за жена от български марки.",
    group: "gifts", requiresGiftable: true, recipients: ["За жена"], occasions: ["Коледа"],
  },
  {
    key: "gift_man_name_day", path: "/podarak-za-mazh-za-imen-den/", categoryKey: "gifts", kind: "keyword",
    label: "За мъж за имен ден", labelEn: "Name-day gifts for him", h1: "Подарък за мъж за имен ден",
    intro: ["Открий подарък за мъж за имен ден от български брандове.", "Селекцията ще расте с практични и лични предложения за повода."],
    title: "Подарък за мъж за имен ден | Българитъм", description: "Открий подарък за мъж за имен ден от български марки.",
    group: "gifts", requiresGiftable: true, recipients: ["За мъж"], occasions: ["Имен ден"],
  },
  {
    key: "gift_man_valentine", path: "/podarak-za-mazh-za-sveti-valentin/", categoryKey: "gifts", kind: "keyword",
    label: "Подарък за мъж за Свети Валентин", labelEn: "Valentine gifts for him", h1: "Подарък за мъж за св валентин",
    intro: ["Открий подарък за мъж за св валентин от български брандове.", "Разгледай лични, романтични и ръчно изработени идеи."],
    title: "Подарък за мъж за св валентин | Българитъм", description: "Открий подарък за мъж за св валентин от български марки.",
    group: "gifts", requiresGiftable: true, recipients: ["За мъж"], occasions: ["Свети Валентин"],
  },
  {
    key: "gift_man_50", path: "/podarak-za-mazh-na-50/", categoryKey: "gifts", kind: "keyword",
    label: "За мъж на 50", labelEn: "Gifts for a 50-year-old man", h1: "Подарък за мъж на 50",
    intro: ["Открий подарък за мъж на 50 от български брандове.", "Тук ще добавяме качествени предложения за юбилей, хоби и ежедневие."],
    title: "Подарък за мъж на 50 | Българитъм", description: "Открий подарък за мъж на 50 от български марки.",
    group: "gifts", requiresGiftable: true, recipients: ["За мъж"], ages: ["50"],
  },
  {
    key: "gift_woman_50", path: "/podarak-za-zhena-na-50/", categoryKey: "gifts", kind: "keyword",
    label: "За жена на 50", labelEn: "Gifts for a 50-year-old woman", h1: "Подарък за жена на 50",
    intro: ["Открий подарък за жена на 50 от български брандове.", "Тук ще добавяме красиви и лични предложения за юбилей и специален повод."],
    title: "Подарък за жена на 50 | Българитъм", description: "Открий подарък за жена на 50 от български марки.",
    group: "gifts", requiresGiftable: true, recipients: ["За жена"], ages: ["50"],
  },
  {
    key: "gift_child_one", path: "/podarak-za-dete-na-1-godina/", categoryKey: "gifts", kind: "keyword",
    label: "За дете на 1 година", labelEn: "Gifts for a one-year-old", h1: "Подарък за дете на 1 година",
    intro: ["Открий подарък за дете на 1 година от български брандове.", "Селекцията ще включва подходящи играчки, книги, текстил и продукти за развитие."],
    title: "Подарък за дете на 1 година | Българитъм", description: "Открий подарък за дете на 1 година от български марки.",
    group: "gifts", requiresGiftable: true, recipients: ["За дете"], ages: ["1 година"],
  },
  {
    key: "gift_baby_girl", path: "/podarak-za-bebe-momiche/", categoryKey: "gifts", kind: "keyword",
    label: "За бебе момиче", labelEn: "Gifts for a baby girl", h1: "Подарък за бебе момиче",
    intro: ["Открий подарък за бебе момиче от български брандове.", "Разгледай кутии, текстил, спомени и ръчно изработени предложения."],
    title: "Подарък за бебе момиче | Българитъм", description: "Открий подарък за бебе момиче от български марки.",
    group: "gifts", requiresGiftable: true, recipients: ["За бебе"], genders: ["Момиче"],
  },
  {
    key: "handmade_wedding_album", path: "/svatben-album-rachna-izrabotka/", categoryKey: "books", kind: "keyword",
    label: "Сватбен албум", labelEn: "Handmade wedding album", h1: "Сватбен албум ръчна изработка",
    intro: ["Открий сватбен албум ръчна изработка от български автори.", "Тук ще добавяме персонализирани албуми за снимки и спомени от сватбения ден."],
    title: "Сватбен албум ръчна изработка | Българитъм", description: "Открий сватбен албум ръчна изработка от български автори.",
    group: "discovery", structuredCategory: "Книги, игри и творчество", structuredSubcategory: "Албуми и хартиени продукти", attributes: ["Ръчна изработка"], productTypes: ["Фотоалбуми"], textAny: ["сватба", "сватбен"],
  },
  {
    key: "custom_jewelry", path: "/bizhuta-po-porachka/", categoryKey: "accessories", subcategoryKey: "accessories_jewelry", kind: "keyword",
    label: "Бижута по поръчка", labelEn: "Custom jewelry", h1: "Бижута по поръчка",
    intro: ["Открий бижута по поръчка от български автори и малки студиа.", "Тук ще добавяме персонализируеми модели и изделия, създадени специално за получателя."],
    title: "Бижута по поръчка | Българитъм", description: "Открий бижута по поръчка от български автори.",
    group: "discovery", attributes: ["Персонализируем"], productTypes: ["Обеци", "Гривни", "Колиета"],
  },
];

type PrimaryClusterSpec = {
  key: string;
  path: string;
  primaryKeyword: string;
  h1: string;
  title: string;
  description: string;
  intro: string[];
  editorialSections: Array<{ title: string; paragraphs: string[] }>;
  structuredState: Record<string, string[]>;
  parentKey: string | null;
  clusterKeywords: string[];
};

const categoryKeyForStructuredState = (state: Record<string, string[]>): CategoryKey => {
  const category = normalize(state.category?.[0]);
  if (category === normalize("Облекло")) return "clothing";
  if (category === normalize("Козметика")) return "cosmetics";
  if (category === normalize("Аксесоари")) return "accessories";
  if (category === normalize("Дом и интериор")) return "home";
  if (category === normalize("Книги, игри и творчество")) return "fun";
  if (category === normalize("Деца и бебе")) return "kids";
  if (state.giftable?.some((value) => normalize(value) === "true") || state.recipient?.length || state.gift_occasion?.length) return "gifts";
  return "fun";
};

const introForPrimaryCluster = (spec: PrimaryClusterSpec) => [
  ...spec.intro,
];

const editorialForPrimaryCluster = (spec: PrimaryClusterSpec) => spec.editorialSections;

const clusterSpecs = primaryClusterSpecs as PrimaryClusterSpec[];
const clusterSpecByPath = new Map(clusterSpecs.map((spec) => [spec.path, spec]));
const enrichedBaseLandings = BASE_SEO_INTENT_LANDINGS.map((landing) => {
  const spec = clusterSpecByPath.get(landing.path);
  if (!spec) return landing;
  return {
    ...landing,
    h1: spec.h1,
    label: spec.h1,
    title: spec.title,
    description: spec.description,
    intro: introForPrimaryCluster(spec),
    editorialSections: editorialForPrimaryCluster(spec),
    structuredState: spec.structuredState,
    parentKey: spec.parentKey,
    primaryKeyword: spec.primaryKeyword,
    clusterKeywords: spec.clusterKeywords,
  } satisfies SeoIntentLanding;
});
const existingClusterPaths = new Set(enrichedBaseLandings.map((landing) => landing.path));
const generatedClusterLandings: SeoIntentLanding[] = clusterSpecs
  .filter((spec) => !existingClusterPaths.has(spec.path) && !spec.path.startsWith("/k/"))
  .map((spec) => ({
    key: spec.key,
    path: spec.path,
    categoryKey: categoryKeyForStructuredState(spec.structuredState),
    kind: "keyword",
    label: spec.h1,
    labelEn: spec.h1,
    h1: spec.h1,
    intro: introForPrimaryCluster(spec),
    title: spec.title,
    description: spec.description,
    group: categoryKeyForStructuredState(spec.structuredState) === "gifts" ? "gifts" : "discovery",
    structuredState: spec.structuredState,
    parentKey: spec.parentKey,
    primaryKeyword: spec.primaryKeyword,
    clusterKeywords: spec.clusterKeywords,
    showInParentNavigation: spec.key === "primary_cluster_103",
    editorialSections: editorialForPrimaryCluster(spec),
  }));

const finalBgIntentLanding = (
  key: string,
  path: string,
  primaryKeyword: string,
  structuredState: Record<string, string[]>,
  parentKey: string,
): SeoIntentLanding => {
  const h1 = primaryKeyword[0].toLocaleUpperCase("bg") + primaryKeyword.slice(1);
  const isJewelry = structuredState.subcategory?.includes("Бижута");
  const isShoes = structuredState.subcategory?.includes("Обувки");
  const isClothing = structuredState.category?.includes("Облекло") || structuredState.subcategory?.some((value) => /облекло|чорапи/i.test(value));
  const isCosmetics = structuredState.category?.includes("Козметика");
  const materials = structuredState.materials || [];
  const productTypes = (structuredState.product_type || []).filter((value, index, all) => !all.some((other, otherIndex) => otherIndex !== index && other.toLocaleLowerCase("bg").includes(value.toLocaleLowerCase("bg"))));
  const isMaterial = materials.length > 0;
  const materialText = materials.length ? materials.map((value) => value.toLocaleLowerCase("bg")).join(" и ") : "материал";
  const typeText = productTypes.length ? productTypes.map((value) => value.toLocaleLowerCase("bg")).join(" и ") : "модели";
  let intro = isMaterial
    ? `Разгледай ${primaryKeyword}, подбрани от български брандове. Сравни моделите според материала, конструкцията и предназначението им.`
    : isJewelry
    ? `Разгледай ${primaryKeyword} от български брандове и сравни моделите по материал, форма и размер.`
    : isShoes
      ? `Разгледай ${primaryKeyword} от български брандове и сравни размерите, материалите и конструкцията на отделните модели.`
      : isClothing
        ? `Разгледай ${primaryKeyword} от български брандове и открий ${typeText} от различни независими марки.`
        : isCosmetics
          ? `Разгледай ${primaryKeyword} от български брандове и сравни предназначението, състава и начина на употреба.`
          : `Разгледай ${primaryKeyword} от български брандове и сравни предложенията по вид, материал и предназначение.`;
  if (path === "/bulgarski-damski-pantaloni/") intro = "Разгледай дамски панталони от български брандове и открий модели отвъд имената, които вече познаваш.";
  if (path === "/bulgarski-damski-zhiletki/") intro = "Открий дамски жилетки от български марки. В момента подборът е малък, затова продуктовите данни и размерите са най-прекият ориентир за сравнение.";
  if (path === "/bulgarski-damski-rizi/") intro = "Разгледай дамски ризи от български брандове и сравни кройки от различни независими марки на едно място.";
  const heading = isMaterial ? `Материалът в контекста на ${typeText}` : isJewelry ? "Материал, форма и размер" : isShoes ? "Какво да сравниш" : isClothing ? "Какво включва колекцията" : isCosmetics ? "Предназначение и употреба" : "Практични ориентири";
  const paragraph = isMaterial
    ? `Структурният подбор за ${primaryKeyword} обхваща ${materialText}. Провери точния състав, обработката и указанията за поддръжка при конкретния продукт.`
    : isJewelry
      ? `Подборът следва структурните данни за ${materialText}. Провери точния материал, размера, теглото и закопчаването в страницата на конкретния продукт.`
    : isShoes
      ? "Размерът, конструкцията и материалът имат значение за различни маршрути и сезони. Сравни ги с обувките, които носиш най-често, а не само с идеалния повод."
      : isClothing
        ? `Сред зададените продуктови типове са ${typeText}. Сравни състава, размерите, пропорцията и указанията за поддръжка.`
        : isCosmetics
          ? "Съставът, предназначението и начинът на употреба трябва да се четат заедно. Разпознаваема съставка или маркетингов етикет не са достатъчни сами по себе си."
          : "Помисли къде и колко често ще се използва предметът. Размерът, материалът и поддръжката често казват повече за реалната му стойност от първото визуално впечатление.";
  return {
  key, path, categoryKey: categoryKeyForStructuredState(structuredState), kind: "keyword",
  label: h1, labelEn: primaryKeyword, h1,
  intro: [intro],
  title: `${h1} – български марки и идеи | Българитъм`,
  description: `${h1}: открий различни български марки и се ориентирай по важните детайли за избора.`,
  group: "discovery", structuredState, parentKey, primaryKeyword, clusterKeywords: [primaryKeyword],
  showInParentNavigation: true,
  editorialSections: isMaterial ? [
    { title: heading, paragraphs: [paragraph] },
    { title: "Какво да сравниш преди избор", paragraphs: [
      materials.includes("Злато")
        ? "При златните бижута сравни пробата, вида злато, размера и начина на закопчаване. Тези данни са по-полезни от общото описание на цвета или блясъка."
        : materials.includes("Сребро")
          ? "При сребърните бижута провери пробата, покритието, размерите и препоръките за почистване. Различната повърхностна обработка изисква различна грижа."
          : materials.some((value) => value.includes("Вълна"))
            ? "При вълнените дрехи сравни процентния състав, плътността, подплатата и начина на поддръжка. Смесите и конструкцията влияят върху усещането и сезона на носене."
            : materials.includes("Естествена кожа")
              ? "При изделията от естествена кожа провери вида и обработката на кожата, размерите, подплатата и обкова. Следвай указанията на бранда за почистване и съхранение."
              : `Сравни размера, конструкцията и предназначението на представените ${typeText}. Материалът е важен, но не заменя конкретните продуктови данни.`
    ] },
  ] : [{ title: heading, paragraphs: [paragraph] }],
  };
};

const FINAL_BG_INTENT_LANDINGS: SeoIntentLanding[] = [
  finalBgIntentLanding("bg_ceramics", "/bulgarska-keramika/", "българска керамика", { materials: ["Керамика"] }, "home"),
  finalBgIntentLanding("bg_baby_clothes", "/bulgarski-bebeshki-drehi/", "български бебешки дрехи", { category: ["Деца и бебе"], subcategory: ["Бебешко облекло"] }, "kids"),
  finalBgIntentLanding("bg_leather_boots", "/bulgarski-boti-estestvena-kozha/", "български боти естествена кожа", { category: ["Облекло"], subcategory: ["Обувки"], product_type: ["Боти"], materials: ["Естествена кожа"] }, "accessories_shoes"),
  finalBgIntentLanding("bg_wool_clothes", "/bulgarski-valneni-drehi/", "български вълнени дрехи", { category: ["Облекло"], subcategory: ["Дамско облекло", "Мъжко облекло", "Детско облекло", "Бебешко облекло", "Унисекс облекло"], materials: ["Вълна", "Мериносова вълна"] }, "clothing"),
  finalBgIntentLanding("bg_women_shoes", "/bulgarski-damski-obuvki/", "български дамски обувки", { category: ["Облекло"], subcategory: ["Обувки"], audience: ["Жени"] }, "accessories_shoes"),
  finalBgIntentLanding("bg_women_leather_shoes", "/bulgarski-damski-obuvki-estestvena-kozha/", "български дамски обувки естествена кожа", { category: ["Облекло"], subcategory: ["Обувки"], audience: ["Жени"], materials: ["Естествена кожа"] }, "bg_women_shoes"),
  finalBgIntentLanding("bg_women_trousers", "/bulgarski-damski-pantaloni/", "български дамски панталони", { category: ["Облекло"], subcategory: ["Дамско облекло"], product_type: ["Дънки и панталони", "Панталони"] }, "clothing_women"),
  finalBgIntentLanding("bg_women_leather_backpacks", "/bulgarski-damski-ranitsi-estestvena-kozha/", "български дамски раници от естествена кожа", { category: ["Аксесоари"], subcategory: ["Чанти и портфейли"], product_type: ["Раници"], audience: ["Жени"], materials: ["Естествена кожа"] }, "accessories_bags"),
  finalBgIntentLanding("bg_children_clothes", "/bulgarski-detski-drehi/", "български детски дрехи", { category: ["Деца и бебе"], subcategory: ["Детско облекло"] }, "kids"),
  finalBgIntentLanding("bg_children_shoes", "/bulgarski-detski-obuvki/", "български детски обувки", { category: ["Облекло"], subcategory: ["Обувки"], audience: ["Деца"] }, "accessories_shoes"),
  finalBgIntentLanding("bg_natural_material_clothes", "/bulgarski-drehi-estestveni-materii/", "български дрехи от естествени материи", { category: ["Облекло"], subcategory: ["Дамско облекло", "Мъжко облекло", "Детско облекло", "Бебешко облекло", "Унисекс облекло", "Бельо"], materials: ["Памук", "Органичен памук", "Лен", "Вълна", "Мериносова вълна", "Алпака", "Коприна", "Коноп"] }, "clothing"),
  finalBgIntentLanding("bg_men_trousers", "/bulgarski-mazhki-pantaloni/", "български мъжки панталони", { category: ["Облекло"], subcategory: ["Мъжко облекло"], product_type: ["Дънки и панталони", "Панталони"] }, "clothing_men"),
  finalBgIntentLanding("bg_socks", "/bulgarski-chorapi/", "български чорапи", { category: ["Облекло"], subcategory: ["Чорапи"] }, "clothing"),
  finalBgIntentLanding("bg_perfumes", "/bulgarski-parfyumi/", "български парфюми", { category: ["Козметика"], subcategory: ["Парфюми"] }, "cosmetics"),
  finalBgIntentLanding("bg_women_shirts", "/bulgarski-damski-rizi/", "български дамски ризи", { category: ["Облекло"], subcategory: ["Дамско облекло"], product_type: ["Ризи"] }, "clothing_women"),
  finalBgIntentLanding("bg_women_tshirts", "/bulgarski-damski-teniski/", "български дамски тениски", { category: ["Облекло"], subcategory: ["Дамско облекло"], product_type: ["Тениски и потници"] }, "clothing_women"),
  finalBgIntentLanding("bg_tshirts", "/bulgarski-teniski/", "български тениски", { category: ["Облекло"], product_type: ["Тениски и потници"] }, "clothing"),
  finalBgIntentLanding("bg_women_cardigans", "/bulgarski-damski-zhiletki/", "български дамски жилетки", { category: ["Облекло"], subcategory: ["Дамско облекло"], product_type: ["Жилетки"] }, "clothing_women"),
  finalBgIntentLanding("bg_women_leather_boots", "/bulgarski-damski-boti-estestvena-kozha/", "български дамски боти естествена кожа", { category: ["Облекло"], subcategory: ["Обувки"], product_type: ["Боти"], audience: ["Жени"], materials: ["Естествена кожа"] }, "bg_women_leather_shoes"),
  finalBgIntentLanding("bg_leather_bags", "/bulgarski-chanti-estestvena-kozha/", "български чанти от естествена кожа", { category: ["Аксесоари"], subcategory: ["Чанти и портфейли"], product_type: ["Чанти"], materials: ["Естествена кожа"] }, "accessories_bags"),
  finalBgIntentLanding("bg_silver_jewelry", "/bulgarski-srebarni-bizhuta/", "български сребърни бижута", { category: ["Аксесоари"], subcategory: ["Бижута"], materials: ["Сребро"] }, "accessories_jewelry"),
  finalBgIntentLanding("bg_women_coats", "/bulgarski-damski-palta/", "български дамски палта", { category: ["Облекло"], subcategory: ["Дамско облекло"], product_type: ["Палта"] }, "clothing_women"),
  finalBgIntentLanding("bg_gold_jewelry", "/bulgarski-zlatni-bizhuta/", "български златни бижута", { category: ["Аксесоари"], subcategory: ["Бижута"], materials: ["Злато"] }, "accessories_jewelry"),
];

// Keep the kids taxonomy identity and functionality at its established SEO URL.
// Reuse its existing editorial content, with no second graph node or collection.
const childrenClothesPresentation = FINAL_BG_INTENT_LANDINGS.find((entry) => entry.key === "bg_children_clothes")!;
const childrenClothesTaxonomy = subcategoryLandings.find((entry) => entry.subcategoryKey === "kids_clothing")!;
Object.assign(childrenClothesTaxonomy, {
  label: childrenClothesPresentation.h1,
  h1: childrenClothesPresentation.h1,
  title: childrenClothesPresentation.title,
  description: childrenClothesPresentation.description,
  intro: childrenClothesPresentation.intro,
  structuredState: childrenClothesPresentation.structuredState,
  editorialSections: childrenClothesPresentation.editorialSections,
});

export const SEO_INTENT_LANDINGS: SeoIntentLanding[] = [
  ...enrichedBaseLandings, ...generatedClusterLandings,
  ...FINAL_BG_INTENT_LANDINGS.filter((entry) => entry.key !== "bg_children_clothes"),
];

// Explicit semantic parents for SEO intent pages. URLs are deliberately not used
// to infer hierarchy: an intent may keep a root-level URL while living below a
// taxonomy category or subcategory in public navigation.
const INTENT_PARENT_KEYS: Record<string, string | null> = {
  gifts_handmade: "gifts",
  clothing_dresses: "clothing_women",
  clothing_pajamas: "clothing_lingerie",
  clothing_bags: "accessories_bags",
  clothing_shoes: "accessories_shoes",
  mens_tracksuits: "clothing_men",
  mens_pajamas: "clothing_men",
  mens_sweaters: "clothing_men",
  mens_jackets: "clothing_men",
  mens_shoes: "clothing_men",
  souvenirs: "fun",
  handmade: "gifts",
  jewelry_medical_steel: "accessories_jewelry",
  jewelry_gilded: "accessories_jewelry",
  jewelry_men: "accessories_jewelry",
  jewelry_handmade: "accessories_jewelry",
  jewelry_pearls: "accessories_jewelry",
  jewelry_box: "accessories_jewelry",
  handmade_cards: null,
  handmade_candles: "home_decor",
  handmade_earrings: "accessories_jewelry",
  handmade_bracelets: "accessories_jewelry",
  women_bags: "accessories_bags",
  women_tracksuits: "clothing_women",
  women_pajamas: "clothing_women",
  clothing_linen: "clothing",
  gift_man_birthday: "gifts_for_him",
  gift_man_christmas: "gifts_for_him",
  gift_woman_christmas: "gifts_for_her",
  gift_man_name_day: "gifts_for_him",
  gift_man_valentine: "gifts_for_him",
  gift_man_50: "gifts_for_him",
  gift_woman_50: "gifts_for_her",
  gift_child_one: "gifts_for_child",
  gift_baby_girl: "gifts_for_baby",
  handmade_wedding_album: "gifts_for_wedding",
  custom_jewelry: "accessories_jewelry",
};

const INTENT_NAVIGATION_VISIBILITY: Partial<Record<string, boolean>> = {
  // The dedicated handmade gift child is the canonical gift-navigation entry.
  handmade: false,
  handmade_cards: false,
};

const TAXONOMY_PUBLIC_DESTINATION_OVERRIDES: Partial<Record<string, string>> = {
  // The indexable shoes collection already has this canonical public landing.
  accessories_shoes: "/bulgarski-drehi/obuvki/",
};

const canonicalUrlForTaxonomyLanding = (landing: SeoLanding) =>
  TAXONOMY_PUBLIC_DESTINATION_OVERRIDES[landing.kind === "category" ? landing.categoryKey : landing.subcategoryKey!]
  || landing.canonicalPath
  || `/k/${landing.canonicalSlug || landing.slug}/`;

const TAXONOMY_GRAPH_SEO_LABELS: Partial<Record<string, string>> = {
  clothing: "Български дрехи",
  gifts: "Идеи за подарък",
  gifts_for_her: "Подарък за жена",
  gifts_for_him: "Подарък за мъж",
  gifts_for_child: "Подарък за дете",
  gifts_for_baby: "Подарък за бебе",
};

// SEO-facing copy belongs to the canonical landing identity, not to the route
// that happens to render it. Navigation labels remain intentionally shorter.
const LANDING_SEO_TARGETS: Partial<Record<string, LandingSeoTarget>> = {
  cosmetics_face: {
    primaryKeyword: "българска козметика за лице", h1: "Българска козметика за лице",
    title: "Българска козметика за лице | Българитъм",
    description: "Разгледай българска козметика за лице от локални марки – кремове, серуми и продукти за почистване.",
    intro: ["Българска козметика за лице от локални марки, подредена по вид продукт за по-лесно сравнение."]
  },
  cosmetics_body: {
    primaryKeyword: "българска козметика за тяло", h1: "Българска козметика за тяло",
    title: "Българска козметика за тяло | Българитъм",
    description: "Разгледай българска козметика за тяло от локални марки – сапуни, душ гелове, кремове и масла.",
    intro: ["Българска козметика за тяло от локални марки, подредена по вид продукт и предназначение."]
  },
  cosmetics_hair: {
    primaryKeyword: "българска козметика за коса", h1: "Българска козметика за коса",
    title: "Българска козметика за коса | Българитъм",
    description: "Разгледай българска козметика за коса от локални марки – шампоани, маски и серуми.",
    intro: ["Българска козметика за коса от локални марки, подредена по вид продукт за по-лесен избор."]
  },
  cosmetics_makeup: {
    primaryKeyword: "български грим", h1: "Български грим",
    title: "Български грим от локални марки | Българитъм",
    description: "Разгледай български грим от локални марки в Българитъм.",
    intro: ["Български грим от локални марки, подреден по текущите продуктови типове в каталога."]
  },
  clothing: {
    primaryKeyword: "български дрехи",
    h1: "Български дрехи",
    title: "Български дрехи от български марки | Българитъм",
    description: "Български дрехи от различни български марки за жени и мъже. Разглеждай и сравнявай рокли, ризи, пижами, спортни екипи, палта и още модели.",
    intro: [
      "Български дрехи от различни български марки са събрани тук в общ продуктов каталог с дамско и мъжко облекло.",
      "Разглеждай и сравнявай различни видове дрехи — от рокли, ризи и пижами до спортни екипи, панталони и палта.",
    ],
  },
  clothing_women: {
    primaryKeyword: "български дамски дрехи",
    h1: "Български дамски дрехи",
    title: "Български дамски дрехи от локални марки | Българитъм",
    description: "Разгледай български дамски дрехи от локални марки – рокли, спортни екипи, пижами и други модели.",
    intro: [
      "Български дамски дрехи от локални марки са събрани на едно място за по-лесно разглеждане по вид продукт и стил.",
      "Открий рокли, спортни екипи, пижами и други предложения за дамско облекло.",
    ],
  },
  clothing_men: {
    primaryKeyword: "български мъжки дрехи",
    h1: "Български мъжки дрехи",
    title: "Български мъжки дрехи от локални марки | Българитъм",
    description: "Разгледай български мъжки дрехи от локални марки – анцузи, пуловери, якета, пижами и други модели.",
    intro: [
      "Български мъжки дрехи от локални марки са подредени тук по вид продукт за по-лесно откриване.",
      "Разгледай анцузи, пуловери, якета, пижами и други предложения за мъжко облекло.",
    ],
  },
  clothing_lingerie: {
    primaryKeyword: "българско бельо",
    h1: "Българско бельо",
    title: "Българско бельо от локални марки | Българитъм",
    description: "Разгледай българско бельо и домашно облекло от локални марки в Българитъм.",
    intro: [
      "Българско бельо от локални марки можеш да разгледаш тук в една обща продуктова селекция.",
      "Използвай продуктовите типове и филтрите, за да стигнеш до подходящите модели.",
    ],
  },
  clothing_dresses: {
    primaryKeyword: "български рокли",
    h1: "Български рокли",
    title: "Български рокли от локални марки | Българитъм",
    description: "Разгледай български рокли от локални марки и открий модели за различни стилове и поводи.",
    intro: [
      "Български рокли от локални марки са събрани тук, за да сравняваш по-лесно модели и стилове.",
      "Разгледай наличните предложения и запази роклите, към които искаш да се върнеш.",
    ],
  },
  clothing_bags: {
    primaryKeyword: "български чанти",
    h1: "Чанти от български брандове",
    title: "Български чанти от локални марки | Българитъм",
    description: "Разгледай български чанти от локални марки и сравни наличните модели по материал, стил и приложение.",
    intro: BASE_SEO_INTENT_LANDINGS.find((entry) => entry.key === "clothing_bags")!.intro,
  },
  clothing_shoes: {
    primaryKeyword: "български обувки",
    h1: "Български обувки",
    title: "Български обувки от локални марки | Българитъм",
    description: "Разгледай български обувки от локални марки и открий наличните модели на едно място.",
    intro: [
      "Български обувки от локални марки можеш да разгледаш тук в една обща селекция.",
      "Сравнявай наличните модели и запази тези, към които искаш да се върнеш.",
    ],
  },
  women_tracksuits: {
    primaryKeyword: "български дамски спортни екипи",
    h1: "Български дамски спортни екипи",
    title: "Български дамски спортни екипи | Българитъм",
    description: "Разгледай български дамски спортни екипи от локални марки за движение и ежедневно носене.",
    intro: [
      "Български дамски спортни екипи от локални марки са събрани тук в една продуктова селекция.",
      "Разгледай наличните комплекти за движение, пътуване и ежедневно носене.",
    ],
  },
  women_pajamas: {
    primaryKeyword: "български дамски пижами",
    h1: "Български дамски пижами",
    title: "Български дамски пижами от локални марки | Българитъм",
    description: "Разгледай български дамски пижами и домашни комплекти от локални марки в Българитъм.",
    intro: [
      "Български дамски пижами и домашни комплекти от локални марки са събрани тук за по-лесно разглеждане.",
      "Сравни наличните модели и избери според предпочитанията си за стил и материя.",
    ],
  },
  clothing_linen: {
    primaryKeyword: "български ленени дрехи",
    h1: "Български ленени дрехи",
    title: "Български ленени дрехи от български марки | Българитъм",
    description: "Открий български ленени дрехи от български марки и сравни наличните модели от лен и ленени смеси в Българитъм.",
    intro: [
      "Български ленени дрехи от български марки са събрани тук, за да сравняваш по-лесно различни модели.",
      "Селекцията включва дрехи от лен и ленени смеси; провери състава на конкретния продукт за точните влакна.",
    ],
  },
  accessories_jewelry: {
    primaryKeyword: "български бижута",
    h1: "Български бижута",
    title: "Български бижута от български марки | Българитъм",
    description: "Разгледай български бижута от български марки и автори – обеци, гривни, колиета и други модели.",
    intro: [
      "Български бижута от марки и автори са събрани тук за по-лесно разглеждане по вид и материал.",
      "Открий обеци, гривни, колиета и други налични модели в продуктовата селекция.",
    ],
  },
  accessories_belts: {
    primaryKeyword: "български колани",
    h1: "Български колани",
    title: "Български колани от локални марки | Българитъм",
    description: "Разгледай български колани от локални марки и открий наличните модели на едно място.",
    intro: [
      "Български колани от локални марки са събрани тук в една продуктова селекция.",
      "Разгледай наличните модели и използвай филтрите за по-точен избор.",
    ],
  },
  accessories_headwear: {
    primaryKeyword: "български аксесоари за коса",
    h1: "Български аксесоари за коса",
    title: "Български аксесоари за коса | Българитъм",
    description: "Разгледай български аксесоари за коса от локални марки и открий наличните модели в Българитъм.",
    intro: [
      "Български аксесоари за коса от локални марки са събрани тук за по-лесно разглеждане.",
      "Сравни наличните модели и запази предложенията, към които искаш да се върнеш.",
    ],
  },
  jewelry_medical_steel: {
    primaryKeyword: "български бижута от медицинска стомана",
    h1: "Български бижута от медицинска стомана",
    title: "Български бижута от медицинска стомана | Българитъм",
    description: "Разгледай български бижута от медицинска стомана от локални марки и автори в Българитъм.",
    intro: [
      "Български бижута от медицинска стомана от марки и автори са събрани тук в една продуктова селекция.",
      "Разгледай наличните обеци, гривни и други модели и сравни предложенията.",
    ],
  },
  jewelry_gilded: {
    primaryKeyword: "български позлатени бижута",
    h1: "Български позлатени бижута",
    title: "Български позлатени бижута от локални марки | Българитъм",
    description: "Разгледай български позлатени бижута от локални марки и автори и сравни наличните модели.",
    intro: [
      "Български позлатени бижута от марки и автори са събрани тук за по-лесно разглеждане.",
      "Сравни наличните модели и запази бижутата, които пасват на твоя стил.",
    ],
  },
  jewelry_handmade: {
    primaryKeyword: "български ръчно изработени бижута",
    h1: "Български ръчно изработени бижута",
    title: "Български ръчно изработени бижута | Българитъм",
    description: "Разгледай български ръчно изработени бижута от автори и малки марки в Българитъм.",
    intro: [
      "Български ръчно изработени бижута от автори и малки марки са събрани тук в една селекция.",
      "Разгледай наличните обеци, гривни, колиета и други изделия по вид и материал.",
    ],
  },
  jewelry_men: {
    primaryKeyword: "български мъжки бижута",
    h1: "Български мъжки бижута",
    title: "Български мъжки бижута от локални марки | Българитъм",
    description: "Разгледай български мъжки бижута и аксесоари от локални марки в Българитъм.",
    intro: [
      "Български мъжки бижута и аксесоари от локални марки са събрани тук в една селекция.",
      "Разгледай наличните гривни, пръстени и други модели по вид и материал.",
    ],
  },
  clothing_brands: {
    primaryKeyword: "български брандове за дрехи",
    h1: "Български брандове за дрехи",
    title: "Български брандове за дрехи и модни марки | Българитъм",
    description: "Открий български брандове за дрехи, модни марки и дизайнери с дамско, мъжко и детско облекло в Българитъм.",
    intro: [
      "Български брандове за дрехи са събрани тук за по-лесно откриване на марки, модни брандове и дизайнери.",
      "Разгледай брандове с дамско, мъжко и детско облекло, без да разделяме близките варианти на търсенето в отделни страници.",
    ],
  },
};

const resolveSeoTarget = (key: string, landing: PublicLanding): LandingSeoTarget =>
  (() => {
    const path = "path" in landing ? landing.path : canonicalUrlForTaxonomyLanding(landing as SeoLanding);
    const spec = clusterSpecByPath.get(path);
    return spec ? {
      primaryKeyword: spec.primaryKeyword,
      h1: spec.h1,
      title: spec.title,
      description: spec.description,
      intro: introForPrimaryCluster(spec),
    } : LANDING_SEO_TARGETS[key] || {
    primaryKeyword: landing.h1,
    h1: landing.h1,
    title: landing.title,
    description: landing.description,
    intro: landing.intro,
    };
  })();

export const CLOTHING_BRANDS_LANDING: SeoBrandLanding = {
  key: "clothing_brands",
  path: "/bulgarski-brandove-za-drehi/",
  categoryKey: "clothing",
  kind: "brand-directory",
  h1: "Български брандове за дрехи",
  title: "Български брандове за дрехи | Българитъм",
  description: "Открий български брандове за дрехи в Българитъм.",
  intro: ["Открий български брандове за дрехи в Българитъм."],
};

export const HOME_BRANDS_LANDING: SeoBrandLanding = {
  key: "home_brands",
  path: "/bulgarski-brandove-za-doma/",
  categoryKey: "home",
  kind: "brand-directory",
  h1: "Български брандове за дома",
  title: "Български брандове за дома | Българитъм",
  description: "Открий български брандове за дома, интериора, текстила и декорацията в Българитъм.",
  intro: ["Български брандове за дома с продукти за интериор, текстил, декорация и ежедневна употреба."],
};

const taxonomyNodes: LandingGraphNode[] = [...CATEGORY_LANDINGS, ...SUBCATEGORY_LANDINGS].map((landing, index) => {
  const key = landing.kind === "category" ? landing.categoryKey : landing.subcategoryKey!;
  const seo = resolveSeoTarget(key, landing);
  return {
  key,
  parentKey: landing.kind === "category" ? null : landing.categoryKey,
  pageType: landing.kind,
  canonicalUrl: canonicalUrlForTaxonomyLanding(landing),
  navigationLabel: landing.label,
  navigationLabelEn: landing.kind === "category"
    ? getCategoryLabelForLang(landing.categoryKey, "en")
    : getSubcategoryLabelForLang(landing.subcategoryKey!, "en"),
  seoLabel: LANDING_SEO_TARGETS[key]?.h1 || TAXONOMY_GRAPH_SEO_LABELS[key] || landing.h1,
  seo,
  order: index,
  showInParentNavigation: true,
  landing,
  };
});

const intentNodes: LandingGraphNode[] = SEO_INTENT_LANDINGS.map((landing, index) => {
  const seo = resolveSeoTarget(landing.key, landing);
  return {
  key: landing.key,
  parentKey: landing.parentKey ?? INTENT_PARENT_KEYS[landing.key] ?? null,
  pageType: "intent",
  canonicalUrl: landing.path,
  navigationLabel: landing.label,
  navigationLabelEn: landing.labelEn,
  seoLabel: seo.h1,
  seo,
  order: 10_000 + index,
  showInParentNavigation: landing.showInParentNavigation ?? INTENT_NAVIGATION_VISIBILITY[landing.key] !== false,
  audienceContext: landing.audienceSubcategoryKey,
  landing,
  };
});

const clothingBrandsSeo = resolveSeoTarget(CLOTHING_BRANDS_LANDING.key, CLOTHING_BRANDS_LANDING);
const brandDirectoryNodes: LandingGraphNode[] = [{
  key: CLOTHING_BRANDS_LANDING.key,
  parentKey: "clothing",
  pageType: "brand-directory",
  canonicalUrl: CLOTHING_BRANDS_LANDING.path,
  navigationLabel: "Брандове",
  navigationLabelEn: "Brands",
  seoLabel: clothingBrandsSeo.h1,
  seo: clothingBrandsSeo,
  order: 20_000,
  showInParentNavigation: false,
  landing: CLOTHING_BRANDS_LANDING,
}, {
  key: HOME_BRANDS_LANDING.key,
  parentKey: "home",
  pageType: "brand-directory",
  canonicalUrl: HOME_BRANDS_LANDING.path,
  navigationLabel: "Брандове за дома",
  navigationLabelEn: "Home brands",
  seoLabel: HOME_BRANDS_LANDING.h1,
  seo: { primaryKeyword: "български брандове за дома", h1: HOME_BRANDS_LANDING.h1, title: HOME_BRANDS_LANDING.title, description: HOME_BRANDS_LANDING.description, intro: HOME_BRANDS_LANDING.intro },
  order: 20_001,
  showInParentNavigation: false,
  landing: HOME_BRANDS_LANDING,
}];

export const PUBLIC_LANDING_GRAPH: LandingGraphNode[] = [...taxonomyNodes, ...intentNodes, ...brandDirectoryNodes];
const graphKeys = new Set(PUBLIC_LANDING_GRAPH.map((node) => node.key));
if (graphKeys.size !== PUBLIC_LANDING_GRAPH.length) {
  throw new Error("PUBLIC_LANDING_GRAPH contains duplicate stable keys");
}
const configuredSeoTargets = Object.entries(LANDING_SEO_TARGETS);
const configuredSeoTitles = new Set(configuredSeoTargets.map(([, target]) => target!.title));
const configuredSeoDescriptions = new Set(configuredSeoTargets.map(([, target]) => target!.description));
if (configuredSeoTitles.size !== configuredSeoTargets.length) {
  throw new Error("PUBLIC_LANDING_GRAPH contains duplicate configured SEO titles");
}
if (configuredSeoDescriptions.size !== configuredSeoTargets.length) {
  throw new Error("PUBLIC_LANDING_GRAPH contains duplicate configured SEO descriptions");
}
configuredSeoTargets.forEach(([key]) => {
  if (!graphKeys.has(key)) throw new Error(`SEO target ${key} is missing from PUBLIC_LANDING_GRAPH`);
});
PUBLIC_LANDING_GRAPH.forEach((node) => {
  if (node.parentKey && !graphKeys.has(node.parentKey)) {
    throw new Error(`PUBLIC_LANDING_GRAPH parent ${node.parentKey} is missing for ${node.key}`);
  }
  const visited = new Set([node.key]);
  let parentKey = node.parentKey;
  while (parentKey) {
    if (visited.has(parentKey)) throw new Error(`PUBLIC_LANDING_GRAPH contains a cycle at ${node.key}`);
    visited.add(parentKey);
    parentKey = PUBLIC_LANDING_GRAPH.find((entry) => entry.key === parentKey)?.parentKey || null;
  }
});
const LANDING_GRAPH_BY_KEY = new Map(PUBLIC_LANDING_GRAPH.map((node) => [node.key, node]));

export function getLandingGraphNode(landingOrKey: PublicLanding | string): LandingGraphNode | null {
  if (typeof landingOrKey === "string") {
    return LANDING_GRAPH_BY_KEY.get(landingOrKey)
      || PUBLIC_LANDING_GRAPH.find((node) => node.canonicalUrl === landingOrKey)
      || null;
  }
  if ("key" in landingOrKey) return LANDING_GRAPH_BY_KEY.get(landingOrKey.key) || null;
  const key = landingOrKey.kind === "category" ? landingOrKey.categoryKey : landingOrKey.subcategoryKey;
  return key ? LANDING_GRAPH_BY_KEY.get(key) || null : null;
}

export function getLandingAncestors(landingOrKey: PublicLanding | string): LandingGraphNode[] {
  const ancestors: LandingGraphNode[] = [];
  const visited = new Set<string>();
  let current = getLandingGraphNode(landingOrKey);
  while (current?.parentKey && !visited.has(current.parentKey)) {
    visited.add(current.parentKey);
    const parent = LANDING_GRAPH_BY_KEY.get(current.parentKey);
    if (!parent) break;
    ancestors.unshift(parent);
    current = parent;
  }
  return ancestors;
}

export function getLandingChildren(landingOrKey: PublicLanding | string): LandingGraphNode[] {
  const node = getLandingGraphNode(landingOrKey);
  if (!node) return [];
  return PUBLIC_LANDING_GRAPH
    .filter((entry) => entry.parentKey === node.key && entry.showInParentNavigation)
    .sort((a, b) => a.order - b.order);
}

export function getLandingSiblings(landingOrKey: PublicLanding | string): LandingGraphNode[] {
  const node = getLandingGraphNode(landingOrKey);
  if (!node?.parentKey) return [];
  return PUBLIC_LANDING_GRAPH
    .filter((entry) => entry.parentKey === node.parentKey && entry.showInParentNavigation)
    .sort((a, b) => a.order - b.order);
}

const toPill = (entry: LandingGraphNode, activeKey: string): LandingPill => ({
  key: entry.key,
  label: entry.navigationLabel,
  labelEn: entry.navigationLabelEn,
  href: entry.canonicalUrl,
  isActive: entry.key === activeKey,
});

export type SeoLandingCoverageGraph = {
  productCountByKey: Map<string, number>;
  contentfulKeys: Set<string>;
  parentNavigationByKey: Map<string, LandingGraphNode[]>;
  productLinksBySlug: Map<string, SeoIntentLanding[]>;
  fallbackSiblingLinksByKey: Map<string, LandingGraphNode[]>;
};

const seoLandingCoverageCache = new WeakMap<Product[], SeoLandingCoverageGraph>();

const exactStructuredLandingMatchesProduct = (landing: SeoIntentLanding, product: Product) =>
  Boolean(landing.structuredState && serializeSeoLandingState(landing.structuredState))
  && productMatchesStructuredState(product, landing.structuredState!);

const structuredLandingSpecificity = (landing: SeoIntentLanding) =>
  Object.entries(landing.structuredState || {}).reduce((score, [field, values]) =>
    score + (values?.length ? (field === "giftable" ? 0 : 1) : 0), 0);

export function getSeoLandingCoverageGraph(products: Product[]): SeoLandingCoverageGraph {
  const cached = seoLandingCoverageCache.get(products);
  if (cached) return cached;

  const productCountByKey = new Map<string, number>();
  for (const node of PUBLIC_LANDING_GRAPH) {
    const count = node.pageType === "intent"
      ? getProductsForIntentLanding(products, node.landing as SeoIntentLanding).length
      : node.pageType === "brand-directory"
        ? 0
        : getProductsForLanding(products, node.landing as SeoLanding).length;
    productCountByKey.set(node.key, count);
  }
  const contentfulKeys = new Set(
    PUBLIC_LANDING_GRAPH.filter((node) => (productCountByKey.get(node.key) || 0) > 0).map((node) => node.key)
  );

  const parentNavigationByKey = new Map<string, LandingGraphNode[]>();
  for (const parent of PUBLIC_LANDING_GRAPH) {
    const children = PUBLIC_LANDING_GRAPH
      .filter((node) => node.parentKey === parent.key && node.pageType === "intent" && contentfulKeys.has(node.key))
      .sort((a, b) => Number(b.showInParentNavigation) - Number(a.showInParentNavigation)
        || (productCountByKey.get(b.key) || 0) - (productCountByKey.get(a.key) || 0)
        || a.order - b.order)
      .slice(0, 8);
    parentNavigationByKey.set(parent.key, children);
  }

  const productLinksBySlug = new Map<string, SeoIntentLanding[]>();
  for (const product of products) {
    const intentMatches = intentNodes
      .filter((node) => contentfulKeys.has(node.key))
      .filter((node) => exactStructuredLandingMatchesProduct(node.landing as SeoIntentLanding, product))
      .sort((a, b) => structuredLandingSpecificity(b.landing as SeoIntentLanding) - structuredLandingSpecificity(a.landing as SeoIntentLanding)
        || (productCountByKey.get(a.key) || 0) - (productCountByKey.get(b.key) || 0)
        || a.order - b.order);
    const unique = new Map<string, SeoIntentLanding>();
    for (const node of intentMatches) unique.set(node.canonicalUrl, node.landing as SeoIntentLanding);
    productLinksBySlug.set(product.slug, [...unique.values()].slice(0, 4));
  }

  const incomingKeys = new Set<string>();
  for (const children of parentNavigationByKey.values()) {
    for (const child of children) incomingKeys.add(child.key);
  }
  for (const links of productLinksBySlug.values()) {
    for (const landing of links) {
      const node = getLandingGraphNode(landing);
      if (node) incomingKeys.add(node.key);
    }
  }

  const fallbackSiblingLinksByKey = new Map<string, LandingGraphNode[]>();
  const uncoveredIntentNodes = intentNodes.filter((node) => contentfulKeys.has(node.key) && !incomingKeys.has(node.key));
  for (const target of uncoveredIntentNodes) {
    const siblings = intentNodes
      .filter((node) => node.key !== target.key && node.parentKey === target.parentKey && contentfulKeys.has(node.key))
      .sort((a, b) => a.order - b.order);
    const source = siblings.find((node) => (fallbackSiblingLinksByKey.get(node.key)?.length || 0) < 6);
    if (!source) continue;
    const links = fallbackSiblingLinksByKey.get(source.key) || [];
    if (!links.some((node) => node.canonicalUrl === target.canonicalUrl)) links.push(target);
    fallbackSiblingLinksByKey.set(source.key, links);
    incomingKeys.add(target.key);
  }

  const graph = { productCountByKey, contentfulKeys, parentNavigationByKey, productLinksBySlug, fallbackSiblingLinksByKey };
  seoLandingCoverageCache.set(products, graph);
  return graph;
}

export function getFallbackSiblingLinks(landingOrKey: PublicLanding | string, products: Product[], limit = 6) {
  const current = getLandingGraphNode(landingOrKey);
  if (!current) return [];
  return (getSeoLandingCoverageGraph(products).fallbackSiblingLinksByKey.get(current.key) || [])
    .slice(0, limit)
    .map((entry) => toPill(entry, current.key));
}

export function getLandingPageHierarchy(landingOrKey: PublicLanding | string, availableProducts?: Product[]) {
  const current = getLandingGraphNode(landingOrKey);
  if (!current) throw new Error("Landing is missing from PUBLIC_LANDING_GRAPH");
  const ancestors = getLandingAncestors(current.key);
  const parent = current.parentKey ? LANDING_GRAPH_BY_KEY.get(current.parentKey) || null : null;
  const directChildren = getLandingChildren(current.key);
  const siblings = getLandingSiblings(current.key);
  const taxonomyParent = current.pageType === "intent" && parent?.pageType === "subcategory" ? parent : null;
  const taxonomyCategory = taxonomyParent?.parentKey ? LANDING_GRAPH_BY_KEY.get(taxonomyParent.parentKey) || null : null;

  const coverage = availableProducts ? getSeoLandingCoverageGraph(availableProducts) : null;
  const availableProductCount = (entry: LandingGraphNode) => {
    if (!availableProducts || !coverage) return 0;
    return coverage.productCountByKey.get(entry.key) || 0;
  };
  const isAvailable = (entry: LandingGraphNode) => !availableProducts || availableProductCount(entry) > 0;
  const contextualIntentNodes = (parentKey: string | null) => {
    if (!parentKey) return [];
    if (coverage) return coverage.parentNavigationByKey.get(parentKey) || [];
    return PUBLIC_LANDING_GRAPH
      .filter((entry) => entry.parentKey === parentKey && entry.pageType === "intent" && entry.showInParentNavigation)
      .sort((a, b) => a.order - b.order)
      .slice(0, 8);
  };

  const primaryNodes = (current.pageType === "category"
    ? directChildren.filter((entry) => entry.pageType === "subcategory")
    : current.pageType === "subcategory"
      ? siblings.filter((entry) => entry.pageType === "subcategory")
      : taxonomyCategory
        ? getLandingChildren(taxonomyCategory.key).filter((entry) => entry.pageType === "subcategory")
        : parent
          ? getLandingChildren(parent.key).filter((entry) => entry.pageType === "subcategory")
          : []).filter(isAvailable)
    .sort((a, b) => Number(b.key === taxonomyParent?.key) - Number(a.key === taxonomyParent?.key) || a.order - b.order)
    .slice(0, 8);

  const secondaryNodes = (current.pageType === "category" || current.pageType === "subcategory"
    ? contextualIntentNodes(current.key)
    : contextualIntentNodes(current.parentKey).filter((entry) => entry.key !== current.key));

  return {
    current,
    primaryKeyword: current.seo.primaryKeyword,
    seoLanding: {
      ...current.landing,
      h1: current.seo.h1,
      title: current.seo.title,
      description: current.seo.description,
      intro: current.seo.intro,
      editorialSections: clusterSpecByPath.get(current.canonicalUrl)?.editorialSections
        || (current.landing as SeoIntentLanding).editorialSections,
    } as PublicLanding,
    parent,
    ancestors,
    directChildren,
    siblings,
    canonicalUrl: current.canonicalUrl,
    breadcrumbs: [
      { name: "Начало", item: "/" },
      ...ancestors.map((entry) => ({ name: entry.seoLabel, item: entry.canonicalUrl })),
      { name: current.seoLabel, item: current.canonicalUrl },
    ],
    primaryPills: primaryNodes.map((entry) => toPill(entry, taxonomyParent?.key || current.key)),
    secondaryPills: secondaryNodes.map((entry) => toPill(entry, current.key)),
    parentLink: parent ? { label: parent.navigationLabel, href: parent.canonicalUrl } : null,
  };
}

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

const TAXONOMY_LANDING_STRUCTURED_OVERRIDES: Partial<Record<string, Record<string, string[]>>> = {
  fun: { category: ["Книги, игри и творчество"] },
  fun_games: { category: ["Книги, игри и творчество"], subcategory: ["Игри", "Настолни игри"] },
  fun_hobby: { category: ["Книги, игри и творчество"], subcategory: ["Творчески комплекти"] },
  fun_books: { category: ["Книги, игри и творчество"], subcategory: ["Книги"] },
  fun_art: { category: ["Книги, игри и творчество"], subcategory: ["Декорация"] },
  food_drink: { category: ["Храна и напитки"] },
  food_drinks: { category: ["Храна и напитки"], subcategory: ["Алкохолни напитки"] },
  kids_cosmetics: { category: ["Деца и бебе"], subcategory: ["Бебешка грижа"] },
  kids_furniture_textiles: {
    category: ["Деца и бебе"],
    subcategory: ["Бебешки текстил", "Детски мебели", "Детски текстил"],
  },
  health_sport: { category: ["Спорт и туризъм"] },
};

export function getStructuredStateForTaxonomyLanding(landing: SeoLanding): Record<string, string[]> {
  const key = landing.kind === "category" ? landing.categoryKey : landing.subcategoryKey || "";
  const override = TAXONOMY_LANDING_STRUCTURED_OVERRIDES[key];
  if (override) return override;

  const publicCategory = PUBLIC_BROWSE_CATEGORIES.find((entry) => entry.key === landing.categoryKey);
  const publicSubcategory = landing.kind === "subcategory"
    ? publicCategory?.subcategories.find((entry) =>
        entry.key === landing.subcategoryKey || normalize(entry.value) === normalize(landing.label)
      )
    : null;

  return {
    category: [publicCategory?.value || getCategoryLabel(landing.categoryKey)],
    ...(landing.kind === "subcategory"
      ? { subcategory: [publicSubcategory?.value || landing.label] }
      : {}),
  };
}

export function productMatchesLanding(product: Product, landing: SeoLanding) {
  if (landing.categoryKey === "gifts") {
    return matchesGiftLandingFilters(product, landing.giftFilters || { giftable: true });
  }
  return productMatchesStructuredState(product, getStructuredStateForTaxonomyLanding(landing));
}

export function getProductsForLanding(products: Product[], landing: SeoLanding) {
  const matches = products.filter((product) => productMatchesLanding(product, landing));
  return landing.categoryKey === "gifts" ? sortGiftProducts(matches) : matches;
}

export function getConsumerLandingIntro(landing: SeoLanding, products: Product[]): string[] {
  const productTypes = [...new Set(products.map((product) => normalize(product.product_type)).filter(Boolean))];
  const concepts = productTypes.slice(0, 3).join(", ").toLowerCase();
  const explicit: Partial<Record<string, string>> = {
    home_bath: "Подбрани хавлии, халати и продукти за банята от български брандове.",
    health_tea_herbs: "Подбрани чайове, билки и натурални продукти от български брандове.",
    kids_furniture_textiles: "Подбрани мебели и текстил за бебета и деца от български брандове.",
    fun_games: "Подбрани настолни и занимателни игри от български брандове.",
    fun_books: "Подбрани книги и аксесоари за четене от български брандове.",
    kids_cosmetics: "Подбрана грижа и козметика за бебета и деца от български брандове.",
    health_sport: "Подбрани продукти за спорт, фитнес и туризъм от български брандове.",
    food_drinks: "Подбрани напитки от български производители и брандове.",
    food_drink: "Подбрани храни и напитки от български производители и брандове.",
    fun: "Подбрани книги, игри и творчески продукти от български брандове.",
  };
  const key = landing.kind === "category" ? landing.categoryKey : landing.subcategoryKey || "";
  const sentence = explicit[key]
    || (concepts
      ? `Подбрани ${concepts} от български брандове.`
      : `Подбрани предложения за ${landing.label.toLowerCase()} от български брандове.`);
  return [sentence];
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

const hasAnyNormalized = (values: string[], expected: string[]) => {
  const normalized = values.map(normalize);
  return expected.some((value) => normalized.includes(normalize(value)));
};

export const matchesGiftLandingFilters = (product: Product, filters: GiftLandingFilters) => {
  if (product.giftable !== true) return false;
  if (filters.recipients?.length && !hasAnyNormalized(product.recipient, filters.recipients)) return false;
  if (filters.occasions?.length && !hasAnyNormalized(product.gift_occasion, filters.occasions)) return false;
  if (filters.ages?.length && !hasAnyNormalized(product.recipient_age, filters.ages)) return false;
  if (filters.genders?.length && !hasAnyNormalized(product.recipient_gender, filters.genders)) return false;
  if (filters.attributes?.length && !hasAnyNormalized(product.attributes, filters.attributes)) return false;
  return true;
};

const productMatchesHandmade = (product: Product) =>
  hasAnyNormalized(product.attributes, ["Ръчна изработка"]) || productMatchesIntentQueries(product, HANDMADE_TERMS);

const productMatchesAudienceContext = (product: Product, audienceSubcategoryKey: SubcategoryKey) => {
  const audience = product.audience.map(normalize);
  const isUnisex = audience.includes(normalize("Унисекс"));

  if (audienceSubcategoryKey === "clothing_women") {
    return isUnisex || audience.includes(normalize("Жени"));
  }

  if (audienceSubcategoryKey === "clothing_men") {
    return isUnisex || audience.includes(normalize("Мъже"));
  }

  return true;
};

const STRUCTURED_ARRAY_FIELDS = new Set([
  "recipient", "gift_occasion", "attributes", "recipient_age", "recipient_gender", "role_interest",
  "wedding_anniversary_type", "audience", "colors", "materials", "gemstone", "jewelry_detail", "clothing_style",
  "sleeve", "season", "ingredient", "skin_type", "skin_need", "hair_need",
]);

export const productMatchesStructuredState = (product: Product, state: Record<string, string[]>) =>
  Object.entries(state).every(([field, expected]) => {
    if (!expected?.length) return true;
    if (field === "giftable") return expected.some((value) => normalize(value) === String(product.giftable));
    if (field === "category" || field === "subcategory" || field === "product_type") {
      return expected.some((value) => normalize(value) === normalize(product[field]));
    }
    if (!STRUCTURED_ARRAY_FIELDS.has(field)) return false;
    const values = product[field as keyof Product];
    return Array.isArray(values) && hasAnyNormalized(values.map(String), expected);
  });

const normalizedStateEntries = (state: Record<string, string[]>) => Object.entries(state)
  .filter(([, values]) => values?.length)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([field, values]) => [field, [...new Set(values.map(normalize).filter(Boolean))].sort()] as const);

export const serializeSeoLandingState = (state: Record<string, string[]>) =>
  normalizedStateEntries(state).map(([field, values]) => `${field}=${values.join("|")}`).join("&");

const SEO_LANDING_STATE_REGISTRY = new Map<string, { path: string; key: string }>([
  [serializeSeoLandingState(childrenClothesPresentation.structuredState!), { path: getCanonicalPathForLanding(childrenClothesTaxonomy), key: "kids_clothing" }],
  ...SEO_INTENT_LANDINGS
    .filter((landing) => landing.structuredState && serializeSeoLandingState(landing.structuredState))
    .map((landing) => [serializeSeoLandingState(landing.structuredState!), { path: landing.path, key: landing.key }] as const),
  ...clusterSpecs
    .filter((spec) => serializeSeoLandingState(spec.structuredState))
    .map((spec) => [serializeSeoLandingState(spec.structuredState), { path: spec.path, key: spec.key }] as const),
]);

export const resolveSeoLandingForState = (state: Record<string, string[]>) =>
  SEO_LANDING_STATE_REGISTRY.get(serializeSeoLandingState(state)) || null;

export const getSeoLandingStateRegistry = () => Array.from(SEO_LANDING_STATE_REGISTRY.entries()).map(([stateKey, landing]) => ({
  stateKey,
  path: landing.path,
  key: landing.key,
}));

export function getProductsForIntentLanding(products: Product[], landing: SeoIntentLanding) {
  const matches = products.filter((product) => {
    if (landing.structuredState && serializeSeoLandingState(landing.structuredState)) {
      return productMatchesStructuredState(product, landing.structuredState)
        && (landing.key !== "bg_natural_material_clothes" || isNaturalMaterialClothing(product));
    }
    if (landing.group === "gifts") {
      return matchesGiftLandingFilters(product, {
        giftable: true,
        recipients: landing.recipients,
        occasions: landing.occasions,
        ages: landing.ages,
        genders: landing.genders,
        attributes: landing.attributes,
      });
    }
    if (landing.structuredCategory && normalize(product.category) !== normalize(landing.structuredCategory)) return false;
    if (landing.structuredSubcategory && normalize(product.subcategory) !== normalize(landing.structuredSubcategory)) return false;
    const hasStructuredTaxonomyTarget = Boolean(
      landing.structuredCategory || landing.structuredSubcategory || landing.productTypes?.length
    );
    const taxonomy = hasStructuredTaxonomyTarget ? null : getTaxonomyForProduct(product);
    const matchedTypes = !hasStructuredTaxonomyTarget && landing.clothingTypeKeys?.length
      ? getClothingTypeMatches(product, ALL_CLOTHING_TYPE_OPTIONS)
      : [];

    if (landing.matchCategoryKeys?.length && !hasStructuredTaxonomyTarget && !landing.matchCategoryKeys.some((key) => taxonomy?.categoryKeys.includes(key))) {
      return false;
    }

    if (landing.audienceSubcategoryKey && !landing.structuredSubcategory) {
      const isBagLanding = landing.clothingTypeKeys?.includes("bags");
      const isShoeLanding = landing.clothingTypeKeys?.includes("shoes");

      if (isBagLanding || isShoeLanding) {
        const browse = getPublicBrowseForProduct(product);
        const accessoryMatch = isBagLanding
          ? browse.subcategoryKey === "accessories_bags"
          : browse.subcategoryKey === "accessories_shoes";
        const audienceMatch = productMatchesAudienceContext(product, landing.audienceSubcategoryKey);

        if (!accessoryMatch && !audienceMatch) return false;
        if (!productMatchesAudienceContext(product, landing.audienceSubcategoryKey)) return false;
      } else if (!productMatchesAudienceContext(product, landing.audienceSubcategoryKey)) {
        return false;
      }
    }

    if (landing.requiresGiftable && !product.giftable) return false;
    if (landing.giftTarget && !product.gift_targets.includes(landing.giftTarget)) return false;
    if (landing.requiresHandmade && !productMatchesHandmade(product)) return false;
    if (landing.attributes?.length && !hasAnyNormalized(product.attributes, landing.attributes)) return false;
    if (landing.recipients?.length && !hasAnyNormalized(product.recipient, landing.recipients)) return false;
    if (landing.occasions?.length && !hasAnyNormalized(product.gift_occasion, landing.occasions)) return false;
    if (landing.materials?.length && !hasAnyNormalized(product.materials, landing.materials)) return false;
    if (landing.productTypes?.length && !landing.productTypes.some((value) => normalize(product.product_type) === normalize(value))) return false;
    if (!hasStructuredTaxonomyTarget && landing.textAll?.length && !landing.textAll.every((query) => productMatchesIntentQueries(product, [query]))) return false;
    if (!hasStructuredTaxonomyTarget && landing.textAny?.length && !productMatchesIntentQueries(product, landing.textAny)) return false;
    if (!hasStructuredTaxonomyTarget && landing.clothingTypeKeys?.length) {
      if (!landing.clothingTypeKeys.some((key) => matchedTypes.includes(key))) return false;
    }
    if (!hasStructuredTaxonomyTarget && landing.matchQueries?.length && !productMatchesIntentQueries(product, landing.matchQueries)) return false;

    return true;
  });

  return landing.categoryKey === "gifts" ? sortGiftProducts(matches) : matches;
}

export function getRelevantLandingsForProduct(product: Product, limit = 3, allProducts: Product[] = []) {
  if (!allProducts.length) return [];
  return (getSeoLandingCoverageGraph(allProducts).productLinksBySlug.get(product.slug) || []).slice(0, Math.min(limit, 4));
}

export function getPublicLandingPathForStructuredTaxonomy(
  product: Product,
  level: "category" | "subcategory" | "product_type"
) {
  const browse = getPublicBrowseForProduct(product);
  if (!browse.categoryKey) return "";

  if (level === "category") {
    const landing = getCategoryLanding(browse.categoryKey);
    return landing ? getCanonicalPathForLanding(landing) : "";
  }

  if (level === "subcategory") {
    const landing = SUBCATEGORY_LANDINGS.find((entry) =>
      entry.categoryKey === browse.categoryKey && entry.subcategoryKey === browse.subcategoryKey
    );
    return landing ? getCanonicalPathForLanding(landing) : "";
  }

  const productType = normalize(product.product_type);
  if (!productType) return "";
  const landing = SEO_INTENT_LANDINGS.find((entry) => {
    if (entry.group === "gifts" || !entry.productTypes?.some((value) => normalize(value) === productType)) return false;
    if (entry.structuredCategory && normalize(entry.structuredCategory) !== normalize(product.category)) return false;
    if (entry.structuredSubcategory && normalize(entry.structuredSubcategory) !== normalize(product.subcategory)) return false;
    return Boolean(entry.structuredCategory || entry.structuredSubcategory || entry.categoryKey === browse.categoryKey);
  });
  return landing?.path || "";
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
          "Търсенето на български дрехи често започва с нужда от нещо конкретно: рокля, пижама, риза, спортен екип, панталон или палто. Но в основата стои и нещо друго - желание да откриеш марка, към която можеш да се върнеш. Именно затова страниците за дрехи трябва да помагат не само да разглеждаш, а и да запазваш, сравняваш и подреждаш идеи за по-късно.",
          "Добрата селекция не те залива с всичко наведнъж. Тя ти дава отправна точка към стил, материя и начин на живот. Това е и по-силният смисъл зад думите български дрехи: не просто списък от артикули, а подбран вход към локални марки, които създават с последователност."
        ]
      },
      {
        title: "Защо дрехите от локални марки се откриват по-добре през ясни страници",
        paragraphs: [
          "Когато някой търси български дрехи, той често използва конкретна фраза: български рокли, български пижами, български мъжки пуловери. Това означава, че най-полезните страници са онези, които запазват продукта в центъра, но дават и достатъчно контекст, за да стане изборът по-бърз и по-уверен.",
          "Точно тук се намесва ролята на добре подредените страници. Те позволяват да стигнеш по-бързо до правилната група продукти, да събереш харесаните модели в лична галерия и да се върнеш към тях по-късно. Това прави откриването на български дрехи по-практично и по-близко до реалния начин, по който хората избират какво да носят.",
          "Когато хората търсят качествени български дрехи, те могат да сравнят реалните модели, материи и информация от брандовете. Разнообразието в каталога се простира от ежедневно и домашно облекло до спортни и по-елегантни модели, без страницата да губи фокуса си върху дрехите."
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
          "Когато разглеждаш български дамски рокли онлайн, използвай стила като ориентир, а не като обещание за конкретна изработка. При елегантните български рокли сравни кройката, материята и указанията на самия продукт, за да прецениш дали моделът е подходящ за търсения повод.",
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
          "Точно затова страницата е най-полезна, когато оставя продукта в центъра и ти позволява да сравняваш спокойно, без да се разсейваш от несвързани дрехи.",
          "Когато търсиш качествени мъжки пижами онлайн, сравни състава, плътността и начина на закопчаване. При мъжките пижами с дълъг ръкав или с копчета тези детайли често са по-полезни от общото име на модела. Ако предпочиташ мъжки памучни пижами, провери точния процент памук в състава — определението памучни мъжки пижами не означава непременно еднаква материя при всеки продукт."
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
  if (landing.key === "clothing_bags") {
    const bags = SEO_INTENT_LANDINGS.find((entry) => entry.key === "clothing_bags")!;
    return { header: bags.editorialHeader, sections: bags.editorialSections || [] };
  }
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
