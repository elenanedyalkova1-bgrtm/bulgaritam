import type { Product } from "./products";

export type ClothingTypeOption = {
  key: string;
  label: string;
  terms: string[];
  excludeTerms?: string[];
};

export const WOMEN_CLOTHING_TYPE_OPTIONS: ClothingTypeOption[] = [
  { key: "tshirts", label: "Тениски", terms: ["тениска", "тениски", "t-shirt", "tshirt", "tee"] },
  { key: "shirts", label: "Ризи и блузи", terms: ["риза", "ризи", "блуза", "блузи", "shirt", "shirts", "blouse", "top"] },
  { key: "dresses", label: "Рокли", terms: ["рокля", "рокли", "dress", "dresses"], excludeTerms: ["сако", "жакет", "палто", "жилетка", "яке", "кимоно", "dress code"] },
  { key: "pants", label: "Панталони и поли", terms: ["панталон", "панталони", "джинс", "джинси", "клин", "клинове", "пола", "поли", "pants", "trousers", "skirt"] },
  { key: "outerwear", label: "Сака и връхни дрехи", terms: ["сако", "жакет", "жакети", "палто", "палта", "жилетка", "жилетки", "яке", "якета", "kimono", "кимоно"] },
  { key: "pajamas", label: "Пижами", terms: ["пижама", "пижами", "нощница", "nightwear", "sleepwear", "pyjamas", "pajamas"] },
  { key: "bags", label: "Чанти", terms: ["чанта", "чанти", "bag", "bags", "портмоне", "несесер"] },
  { key: "shoes", label: "Обувки", terms: ["обувки", "обувка", "shoe", "shoes", "боти", "ботуши", "boots", "boot", "маратонки", "сандали"] },
  { key: "underwear", label: "Бельо", terms: ["бельо", "lingerie", "сутиен", "бикини", "боди", "bodysuit"] },
];

export const MEN_CLOTHING_TYPE_OPTIONS: ClothingTypeOption[] = [
  { key: "tshirts", label: "Тениски", terms: ["тениска", "тениски", "t-shirt", "tshirt", "tee"] },
  { key: "tracksuits", label: "Анцузи", terms: ["анцуг", "анцузи", "tracksuit", "tracksuits", "sweatsuit", "sweatsuits", "jogger set", "спортен комплект"] },
  { key: "shirts", label: "Ризи", terms: ["риза", "ризи", "shirt", "shirts"] },
  { key: "pants", label: "Панталони", terms: ["панталон", "панталони", "джинс", "джинси", "pants", "trousers"] },
  { key: "sweaters", label: "Пуловери", terms: ["пуловер", "пуловери", "sweater", "sweaters", "суичър", "суичъри", "hoodie", "hoodies"] },
  { key: "outerwear", label: "Якета", terms: ["яке", "якета", "jacket", "jackets", "палто", "палта"] },
  { key: "pajamas", label: "Пижами", terms: ["пижама", "пижами", "nightwear", "sleepwear", "pyjamas", "pajamas"] },
  { key: "shoes", label: "Обувки", terms: ["обувки", "обувка", "shoe", "shoes", "боти", "бота", "маратонки", "сандали"] },
  { key: "underwear", label: "Бельо", terms: ["бельо", "lingerie", "боксер", "боксерки", "slip", "briefs"] },
];

export const ALL_CLOTHING_TYPE_OPTIONS: ClothingTypeOption[] = [
  ...WOMEN_CLOTHING_TYPE_OPTIONS,
  ...MEN_CLOTHING_TYPE_OPTIONS,
].reduce<ClothingTypeOption[]>((acc, option) => {
  if (acc.some((entry) => entry.key === option.key)) return acc;
  acc.push(option);
  return acc;
}, []);

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[\/_,;:.!?()[\]{}"'`´’“”]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildCorpus = (product: Product) =>
  [
    product.name_bg,
    product.short_desc_bg,
    product.long_desc_bg,
    product.tags,
    product.category,
  ]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => normalize(value))
    .filter(Boolean)
    .join(" | ");

const corpusIncludes = (corpus: string, term: string) => {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return false;
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s|\\|)${escaped}(?=$|\\s|\\|)`).test(corpus);
};

export function getClothingTypeMatches(product: Product, options: ClothingTypeOption[]) {
  const corpus = buildCorpus(product);

  return options
    .filter((option) => {
      const matchesTerm = option.terms.some((term) => corpusIncludes(corpus, term));
      if (!matchesTerm) return false;
      if (option.excludeTerms?.some((term) => corpusIncludes(corpus, term))) return false;
      return true;
    })
    .map((option) => option.key);
}
