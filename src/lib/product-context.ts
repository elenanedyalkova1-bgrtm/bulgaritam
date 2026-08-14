import type { Product } from "./products";
import { getTaxonomyForProduct } from "./taxonomy";

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[\/_,;:.!?()[\]{}"'`´’“”]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const unique = <T,>(values: T[]) => Array.from(new Set(values));

const buildCorpus = (product: Product) =>
  unique([
    product.name_bg,
    product.short_desc_bg,
    product.long_desc_bg,
    ...(Array.isArray(product.tags) ? product.tags : []),
  ].map(normalize).filter(Boolean)).join(" | ");

const corpusIncludes = (corpus: string, term: string) => {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return false;
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s|\\|)${escaped}(?=$|\\s|\\|)`).test(corpus);
};

const CONTEXT_RULES = [
  {
    suitable: "уютен дом",
    perfect: "вечери у дома",
    terms: ["свещ", "аромат", "дом", "декор", "уют", "home", "candle", "diffuser", "текстил", "възглавница"],
  },
  {
    suitable: "организирано ежедневие",
    perfect: "работа от вкъщи",
    terms: ["органайзер", "планер", "planner", "organization", "организация", "workspace", "работно пространство"],
  },
  {
    suitable: "личен подарък",
    perfect: "специален повод",
    terms: ["подарък", "gift", "комплект", "set", "bundle", "ръчна изработка", "handmade"],
  },
  {
    suitable: "грижа за себе си",
    perfect: "бавни сутрини",
    terms: ["козметика", "крем", "ритуал", "ритуали", "self care", "body", "skin", "hair", "сапун", "масло"],
  },
  {
    suitable: "семейно ежедневие",
    perfect: "детска стая и грижа",
    terms: ["детско", "детски", "бебе", "бебешки", "kids", "baby", "играчка", "toy", "книга", "book"],
  },
  {
    suitable: "пътувания",
    perfect: "леко и практично ежедневие",
    terms: ["travel", "пътуване", "чанта", "bag", "несесер", "case"],
  },
];

export const getProductUsageContext = (product: Product) => {
  const corpus = buildCorpus(product);
  const matches = CONTEXT_RULES
    .map((rule) => ({
      rule,
      score: rule.terms.reduce((acc, term) => acc + (corpusIncludes(corpus, term) ? 1 : 0), 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const primary = matches[0]?.rule;
  const secondary = matches[1]?.rule;
  const taxonomy = getTaxonomyForProduct(product);
  const categoryFallbacks = {
    home: { suitableFor: "уютен дом", perfectFor: "вечери у дома" },
    kids: { suitableFor: "семейно ежедневие", perfectFor: "детска стая и грижа" },
    cosmetics: { suitableFor: "грижа за себе си", perfectFor: "бавни сутрини" },
    health: { suitableFor: "здравословен ритъм", perfectFor: "балансиран начин на живот" },
    accessories: { suitableFor: "личен стил", perfectFor: "ежедневни акценти" },
    clothing: { suitableFor: "подреден гардероб", perfectFor: "леко и красиво ежедневие" },
    gifts: { suitableFor: "личен подарък", perfectFor: "специален повод" },
    fun: { suitableFor: "свободно време", perfectFor: "творчески моменти" },
    pets: { suitableFor: "грижа за домашния любимец", perfectFor: "по-спокойно ежедневие у дома" },
    food_drink: { suitableFor: "вкусни ритуали у дома", perfectFor: "споделени моменти около масата" },
  };
  const fallback = categoryFallbacks[taxonomy.categoryKey] || {
    suitableFor: "по-смислено ежедневие",
    perfectFor: "лични ритуали и вдъхновение",
  };

  return {
    suitableFor: primary?.suitable || fallback.suitableFor,
    perfectFor: secondary?.perfect || primary?.perfect || fallback.perfectFor,
  };
};
