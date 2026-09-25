import type { Product } from "./products";

const NATURAL_PRIMARY = new Set([
  "памук",
  "органичен памук",
  "лен",
  "вълна",
  "мериносова вълна",
  "алпака",
  "коприна",
  "коноп",
]);

const FUNCTIONAL_MINOR = new Set(["еластан"]);
const SUBSTANTIAL_MANUFACTURED = new Set([
  "полиамид",
  "полиестер",
  "акрил",
  "найлон",
  "модал",
  "вискоза",
  "лиоцел",
  "тенсел",
]);
const COMPATIBLE_CONSTRUCTION_TERMS = new Set(["деним", "метал"]);
const AMBIGUOUS_TEXTILES = new Set(["дантела", "тюл"]);

const normalize = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("bg");
const PERCENT_MATERIAL = /(\d+(?:[.,]\d+)?)\s*%\s*(органич(?:ен|ния|но)?\s+памук|памук|cotton|лен|linen|вълна|wool|мериносова?\s+вълна|merino(?:\s+wool)?|коприна|silk|коноп|hemp|алпака|alpaca|еластан|elastane|spandex|lycra|полиамид|polyamide|nylon|полиестер|polyester|акрил|acrylic|модал|modal|вискоза|viscose|лиоцел|lyocell|тенсел|tencel)/giu;
const RAW_SUBSTANTIAL = /полиамид|polyamide|nylon|полиестер|polyester|акрил|acrylic|модал|modal|вискоза|viscose|лиоцел|lyocell|тенсел|tencel/i;
const EXPLICIT_NATURAL_PRIMARY = /100\s*%|памуч(?:ен|на|но|ни)\s+(?:плат|материя|трико)|(?:изработен[ао]?\s+)?от\s+(?:органичен\s+)?памук(?:\s+(?:с|и)\s+еластан)?|от\s+(?:фино\s+|органично\s+)?мерино|от\s+(?:чиста\s+)?вълна|ленен[ао]?\s+(?:плат|материя)/i;

type PercentageClass = "natural" | "functional" | "substantial";
type ParsedPercentage = { percentage: number; material: string; class: PercentageClass };

export type NaturalMaterialDecision = {
  matches: boolean;
  reason: string;
  percentages: ParsedPercentage[];
};

const percentageClass = (material: string): PercentageClass => {
  const value = normalize(material);
  if (/памук|cotton|лен|linen|вълн|wool|merino|коприна|silk|коноп|hemp|алпака|alpaca/.test(value)) return "natural";
  if (/еластан|elastane|spandex|lycra/.test(value)) return "functional";
  return "substantial";
};

const compositionText = (product: Product) =>
  [product.name_bg, product.short_desc_bg, product.long_desc_bg].filter(Boolean).join(" ");

export function naturalMaterialClothingDecision(product: Product): NaturalMaterialDecision {
  const materials = (product.materials || []).map(normalize).filter(Boolean);
  const text = compositionText(product);
  const percentages = [...new Map([...text.matchAll(PERCENT_MATERIAL)].map((match) => {
    const percentage = Number(match[1].replace(",", "."));
    const material = normalize(match[2]);
    return [`${percentage}:${material}`, { percentage, material, class: percentageClass(material) }];
  })).values()];
  const hasReliablePercentages = percentages.length >= 2 || percentages.some((item) => item.percentage === 100);

  if (hasReliablePercentages) {
    const share = (kind: PercentageClass) => percentages
      .filter((item) => item.class === kind)
      .reduce((sum, item) => sum + item.percentage, 0);
    const naturalShare = share("natural");
    const functionalShare = share("functional");
    const substantialShare = share("substantial");
    const matches = naturalShare >= 80 && functionalShare <= 10 && substantialShare === 0;
    return {
      matches,
      reason: matches
        ? `reliable composition: natural ${naturalShare}%, functional elastane ${functionalShare}%, no substantial manufactured fiber`
        : `reliable composition below threshold: natural ${naturalShare}%, elastane ${functionalShare}%, substantial/manufactured ${substantialShare}%`,
      percentages,
    };
  }

  const substantial = materials.filter((item) => SUBSTANTIAL_MANUFACTURED.has(item));
  if (substantial.length || RAW_SUBSTANTIAL.test(text)) {
    return {
      matches: false,
      reason: `no reliable percentages and substantial/manufactured fiber present: ${substantial.join(", ") || "raw composition text"}`,
      percentages,
    };
  }

  const ambiguous = materials.filter((item) => AMBIGUOUS_TEXTILES.has(item));
  if (ambiguous.length) {
    return { matches: false, reason: `no reliable percentages and ambiguous textile present: ${ambiguous.join(", ")}`, percentages };
  }

  const unsupported = materials.filter((item) =>
    !NATURAL_PRIMARY.has(item) && !FUNCTIONAL_MINOR.has(item) && !COMPATIBLE_CONSTRUCTION_TERMS.has(item)
  );
  if (unsupported.length) {
    return { matches: false, reason: `no reliable percentages and unsupported co-material present: ${unsupported.join(", ")}`, percentages };
  }

  if (materials.some((item) => FUNCTIONAL_MINOR.has(item))) {
    const matches = EXPLICIT_NATURAL_PRIMARY.test(text);
    return {
      matches,
      reason: matches
        ? "natural + elastane only; source description explicitly identifies the natural textile as primary"
        : "natural + elastane listed, but no percentages or explicit natural-primary composition",
      percentages,
    };
  }

  return {
    matches: materials.some((item) => NATURAL_PRIMARY.has(item)),
    reason: "structured composition contains natural primary materials and no synthetic/manufactured fiber signal",
    percentages,
  };
}

export const isNaturalMaterialClothing = (product: Product) => naturalMaterialClothingDecision(product).matches;
