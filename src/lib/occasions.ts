import type { Product } from "./products";

export type OccasionKey =
  | "summer"
  | "zero_waste"
  | "eco"
  | "bio"
  | "minimal_home"
  | "winter"
  | "mediterranean"
  | "boho"
  | "scandinavian"
  | "vintage"
  | "modern_luxury"
  | "cozy_home"
  | "self_care"
  | "slow_mornings"
  | "home_evenings"
  | "work_from_home"
  | "serving"
  | "home_organization"
  | "daily_organization"
  | "travel"
  | "table_decor"
  | "workspace";

type OccasionGroupKey = "seasonal" | "style" | "lifestyle" | "home";

type OccasionFilter = {
  key: OccasionKey;
  label: string;
  labelEn: string;
  group: OccasionGroupKey;
  terms: string[];
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[.,/#!$%^*;:{}=_~()@\[\]+<>?\\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const corpusIncludes = (corpus: string, term: string) => {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return false;
  const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s|\\|)${escapedTerm}(?=$|\\s|\\|)`).test(corpus);
};

const corpusIncludesAny = (corpus: string, terms: string[]) => terms.some((term) => corpusIncludes(corpus, term));

export const OCCASION_GROUPS: Array<{ key: OccasionGroupKey; label: string; labelEn: string }> = [
  { key: "seasonal", label: "Сезонни", labelEn: "Seasonal" },
  { key: "style", label: "Стил и атмосфера", labelEn: "Style & atmosphere" },
  { key: "lifestyle", label: "Ритъм и начин на живот", labelEn: "Lifestyle & rhythm" },
  { key: "home", label: "Дом и всекидневие", labelEn: "Home & daily life" },
];

export const OCCASION_FILTERS: OccasionFilter[] = [
  { key: "summer", label: "Летни", labelEn: "Summer", group: "seasonal", terms: ["лято", "летен", "летни", "summer", "beach", "море"] },
  { key: "winter", label: "Зимни", labelEn: "Winter", group: "seasonal", terms: ["зима", "зимен", "зимни", "winter", "пухкаво", "топло"] },
  { key: "zero_waste", label: "Zero Waste", labelEn: "Zero Waste", group: "lifestyle", terms: ["zero waste", "многократен", "многократна", "без отпадък", "устойчив избор"] },
  { key: "eco", label: "Еко", labelEn: "Eco", group: "lifestyle", terms: ["еко", "eco", "sustainable", "устойчив", "биоразградим", "reusable", "recyclable"] },
  { key: "bio", label: "Био", labelEn: "Bio", group: "lifestyle", terms: ["био", "bio", "organic", "органичен", "натурален", "natural"] },
  { key: "minimal_home", label: "Минималистичен дом", labelEn: "Minimal home", group: "style", terms: ["минимал", "minimal", "clean lines", "изчистен", "minimalist"] },
  { key: "mediterranean", label: "Средиземноморски стил", labelEn: "Mediterranean style", group: "style", terms: ["средиземноморски", "mediterranean", "coastal", "теракота", "olive", "лимон"] },
  { key: "boho", label: "Бохо стил", labelEn: "Boho style", group: "style", terms: ["бохо", "boho", "ethnic", "арт текстил", "fringe"] },
  { key: "scandinavian", label: "Скандинавски стил", labelEn: "Scandinavian style", group: "style", terms: ["скандинавски", "scandinavian", "nordic", "светло дърво"] },
  { key: "vintage", label: "Винтидж", labelEn: "Vintage", group: "style", terms: ["винтидж", "vintage", "retro", "носталгичен"] },
  { key: "modern_luxury", label: "Модерен лукс", labelEn: "Modern luxury", group: "style", terms: ["лукс", "luxury", "elegant", "премиум", "statement"] },
  { key: "cozy_home", label: "Уют у дома", labelEn: "Cozy home", group: "home", terms: ["уют", "cozy", "home comfort", "мека светлина", "аромат", "soft home"] },
  { key: "self_care", label: "Грижа за себе си", labelEn: "Self-care", group: "lifestyle", terms: ["грижа", "self care", "ритуал", "ритуали", "wellness", "spa"] },
  { key: "slow_mornings", label: "Бавни сутрини", labelEn: "Slow mornings", group: "lifestyle", terms: ["бавни сутрини", "morning ritual", "morning", "чай", "кафе", "закуска"] },
  { key: "home_evenings", label: "Вечери у дома", labelEn: "Evenings at home", group: "lifestyle", terms: ["вечер", "вечери у дома", "home evenings", "candlelight", "movie night"] },
  { key: "work_from_home", label: "Работа от вкъщи", labelEn: "Work from home", group: "lifestyle", terms: ["работа от вкъщи", "home office", "remote work", "desk"] },
  { key: "serving", label: "Сервиране и поднасяне", labelEn: "Serving & hosting", group: "home", terms: ["сервиране", "поднасяне", "табла", "plate", "platter", "чаша", "купа"] },
  { key: "home_organization", label: "Организация на дома", labelEn: "Home organization", group: "home", terms: ["организация на дома", "съхранение", "органайзер", "storage", "подредба"] },
  { key: "daily_organization", label: "Организация на ежедневието", labelEn: "Daily organization", group: "lifestyle", terms: ["организация на ежедневието", "планер", "planner", "journal", "дневник"] },
  { key: "travel", label: "Пътувания", labelEn: "Travel", group: "lifestyle", terms: ["пътуване", "пътувания", "travel", "trip", "несесер", "travel album"] },
  { key: "table_decor", label: "Декорация за маса", labelEn: "Table decor", group: "home", terms: ["декорация за маса", "table decor", "tablescape", "table styling", "център за маса"] },
  { key: "workspace", label: "Работно пространство", labelEn: "Workspace", group: "home", terms: ["работно пространство", "workspace", "desk", "бюро", "office"] },
];

export const getOccasionKeysForProduct = (product: Product) => {
  const corpus = [
    product.name_bg,
    product.category,
    ...(Array.isArray(product.tags) ? product.tags : []),
    product.short_desc_bg,
    product.long_desc_bg,
  ]
    .map((value) => normalize(value))
    .filter(Boolean)
    .join(" | ");

  return OCCASION_FILTERS
    .filter((occasion) => corpusIncludesAny(corpus, occasion.terms))
    .map((occasion) => occasion.key);
};

export const getOccasionLabel = (key: OccasionKey) =>
  OCCASION_FILTERS.find((occasion) => occasion.key === key)?.label || "";
