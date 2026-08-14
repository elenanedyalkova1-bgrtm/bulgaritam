import type { Product } from "./products";

const BIO_TERMS = [
  "био",
  "bio",
  "organic",
  "органик",
  "органич",
  "натурален",
  "натурална",
  "натурално",
  "натурални",
  "natural",
];

const ECO_TERMS = [
  "eco",
  "еко",
  "sustainable",
  "sustainably made",
  "устойчив",
  "устойчиво",
  "биоразградим",
  "biodegradable",
  "reusable",
  "многократ",
  "recyclable",
  "рециклируем",
  "zero waste",
  "plastic free",
];

const HANDMADE_TERMS = [
  "ръчна изработка",
  "ръчно изработени",
  "ръчно изработен",
  "ръчно изработена",
  "handmade",
  "hand crafted",
  "artisan",
];

const GIFT_TERMS = [
  "подарък",
  "подаръци",
  "gift",
  "gifts",
  "комплект",
  "сет",
  "set",
  "bundle",
];

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[\/_,;:.!?()[\]{}"'`´’“”]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const unique = <T,>(values: T[]) => Array.from(new Set(values));

const corpusIncludes = (corpus: string, term: string) => {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return false;
  const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s|\\|)${escapedTerm}(?=$|\\s|\\|)`).test(corpus);
};

const buildProductBadgeCorpus = (product: Product) =>
  unique([
    product.name_bg,
    product.short_desc_bg,
    product.long_desc_bg,
    ...(Array.isArray(product.tags) ? product.tags : []),
  ].map(normalize).filter(Boolean)).join(" | ");

export const getProductBadges = (product: Product) => {
  const corpus = buildProductBadgeCorpus(product);
  const isBio = BIO_TERMS.some((term) => corpusIncludes(corpus, term));
  const isEco = ECO_TERMS.some((term) => corpusIncludes(corpus, term));
  const isHandmade = HANDMADE_TERMS.some((term) => corpusIncludes(corpus, term));
  const isGift = GIFT_TERMS.some((term) => corpusIncludes(corpus, term));

  return {
    isBio,
    isEco,
    isHandmade,
    isGift,
  };
};

export const isProductBio = (product: Product) => {
  return getProductBadges(product).isBio;
};

export const isProductEco = (product: Product) => {
  return getProductBadges(product).isEco;
};

export const isProductHandmade = (product: Product) => {
  return getProductBadges(product).isHandmade;
};

export const isProductGift = (product: Product) => {
  return getProductBadges(product).isGift;
};
