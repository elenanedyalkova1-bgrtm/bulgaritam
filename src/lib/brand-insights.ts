import type { Product } from "./products";
import { getTaxonomyForProduct, getCategoryLabelForLang } from "./taxonomy";

type BrandInsight = {
  title: string;
  text: string;
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[\/_,;:.!?()[\]{}"'`´’“”]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const corpusIncludes = (corpus: string, term: string) => {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return false;
  const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s|\\|)${escapedTerm}(?=$|\\s|\\|)`).test(corpus);
};

const TYPE_SIGNALS = [
  { label: "екстракти от функционални гъби и спрейове", terms: ["cordyceps", "reishi", "chaga", "lion", "mushroom", "гъби", "гъба", "спрей", "спрейове"] },
  { label: "чайове и функционални напитки", terms: ["чай", "tea", "напитка"] },
  { label: "свещи и домашни аромати", terms: ["свещ", "свещи", "difuzer", "дифузер", "аромат"] },
  { label: "екстракти и добавки", terms: ["екстракт", "тинктура", "добавка"] },
  { label: "серуми, кремове и козметика за грижа", terms: ["серум", "серуми", "крем", "кремове", "тоник", "шампоан", "маска", "балсам", "почистващ", "гомаж", "ексфолиант"] },
  { label: "бижута и малки акценти", terms: ["обеци", "колие", "гривна", "бижута", "пръстен"] },
  { label: "чанти и аксесоари", terms: ["чанта", "чанти", "портмоне", "несесер", "колан"] },
  { label: "дрехи и текстил", terms: ["рокля", "пижама", "тениска", "риза", "жилетка", "палто", "облекло", "текстил"] },
  { label: "детски находки", terms: ["деца", "детски", "бебе", "бебешки", "играчка", "палатка", "книга"] },
  { label: "предмети за дома", terms: ["дом", "декор", "кухня", "чаша", "ваза", "картина", "лампа", "спално бельо"] },
];

const countMatches = (products: Product[], terms: string[], source: "all" | "title" = "all") =>
  products.reduce((total, product) => {
    const corpus = normalize(
      source === "title"
        ? product.name_bg
        : [
            product.name_bg,
            product.short_desc_bg,
            product.long_desc_bg,
            product.tags.join(" "),
          ].join(" | ")
    );
    return total + (terms.some((term) => corpusIncludes(corpus, term)) ? 1 : 0);
  }, 0);

const getTopLabels = (
  products: Product[],
  signals: Array<{ label: string; terms: string[] }>,
  minimumMatches = 1,
  limit = 3,
  source: "all" | "title" = "all"
) =>
  signals
    .map((signal) => ({ label: signal.label, count: countMatches(products, signal.terms, source) }))
    .filter((entry) => entry.count >= minimumMatches)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((entry) => entry.label);

export function getBrandInsights(brandIntro: string, products: Product[]): BrandInsight[] {
  if (!products.length) return [];

  const categoryLabels = Array.from(
    products.reduce((acc, product) => {
      const category = getTaxonomyForProduct(product).categoryKey;
      const label = category ? getCategoryLabelForLang(category, "bg") : "";
      if (!label) return acc;
      acc.set(label, (acc.get(label) || 0) + 1);
      return acc;
    }, new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([label]) => label);

  const recurringTypes = getTopLabels(
    products,
    TYPE_SIGNALS,
    products.length >= 6 ? 2 : 1,
    1,
    "title"
  );

  const insights: BrandInsight[] = [];

  if (categoryLabels.length) {
    insights.push({
      title: "Силен фокус",
      text: `Най-често марката присъства в ${categoryLabels.join(" и ")}.`,
    });
  }

  if (recurringTypes.length) {
    insights.push({
      title: "Най-често ще откриеш",
      text: recurringTypes.join(", "),
    });
  }

  return insights.slice(0, 3);
}
