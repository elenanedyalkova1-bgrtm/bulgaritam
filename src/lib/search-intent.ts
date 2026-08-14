export type StructuredSearchIntent = {
  categoryKey?: string;
  subcategoryKey?: string;
  productType?: string;
  giftable?: boolean;
  recipients: string[];
  occasions: string[];
  attributes: string[];
  residualQuery: string;
  labels: string[];
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLocaleLowerCase("bg")
    .replace(/[„“”'\"`´’‘]/g, "")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

type Rule = {
  patterns: RegExp[];
  intent: Partial<Omit<StructuredSearchIntent, "residualQuery" | "labels">>;
  labels: string[];
};

const RULES: Rule[] = [
  { patterns: [/подар(?:ък|ъци)\s+за\s+мъж(?:а)?/], intent: { giftable: true, recipients: ["За мъж"] }, labels: ["Подарък", "За мъж"] },
  { patterns: [/подар(?:ък|ъци)\s+за\s+жен(?:а|и)/], intent: { giftable: true, recipients: ["За жена"] }, labels: ["Подарък", "За жена"] },
  { patterns: [/подар(?:ък|ъци)\s+за\s+(?:бебе|новородено)/], intent: { giftable: true, recipients: ["За бебе"] }, labels: ["Подарък", "За бебе"] },
  { patterns: [/подар(?:ък|ъци)\s+за\s+сватба/, /сватбен\s+подарък/], intent: { giftable: true, occasions: ["Сватба"] }, labels: ["Подарък", "Сватба"] },
  { patterns: [/дамск(?:а|и)\s+рокл(?:я|и)/], intent: { categoryKey: "clothing", subcategoryKey: "clothing_women", productType: "Рокли" }, labels: ["Облекло", "Дамско облекло", "Рокли"] },
  { patterns: [/мъжк(?:а|и)\s+пижам(?:а|и)/], intent: { categoryKey: "clothing", subcategoryKey: "clothing_men", productType: "Пижами" }, labels: ["Облекло", "Мъжко облекло", "Пижами"] },
  { patterns: [/мъжк(?:и|а)\s+анцуг(?:и)?/], intent: { categoryKey: "clothing", subcategoryKey: "clothing_men", productType: "Анцузи" }, labels: ["Облекло", "Мъжко облекло", "Анцузи"] },
  { patterns: [/сребърн(?:и|а|о)\s+обеци/], intent: { categoryKey: "accessories", subcategoryKey: "accessories_jewelry", productType: "Обеци" }, labels: ["Аксесоари", "Бижута", "Обеци"] },
  { patterns: [/крем(?:ове)?\s+за\s+лице/, /лицев(?:и|а)\s+крем(?:ове)?/], intent: { categoryKey: "cosmetics", subcategoryKey: "cosmetics_face", productType: "Кремове за лице" }, labels: ["Козметика", "Грижа за лицето", "Кремове за лице"] },
  { patterns: [/натурал(?:ен|на|но|ни)\s+шампоан(?:и)?/], intent: { categoryKey: "cosmetics", subcategoryKey: "cosmetics_hair", productType: "Шампоани", attributes: ["Натурален"] }, labels: ["Козметика", "Грижа за косата", "Шампоани", "Натурален"] },
];

const mergeUnique = (left: string[], right: string[]) => Array.from(new Set([...left, ...right]));

export function parseBulgarianShoppingIntent(value: unknown): StructuredSearchIntent | null {
  const normalized = normalize(value);
  if (!normalized) return null;

  let residualQuery = normalized;
  let matched = false;
  const result: StructuredSearchIntent = { recipients: [], occasions: [], attributes: [], residualQuery: "", labels: [] };

  for (const rule of RULES) {
    const pattern = rule.patterns.find((candidate) => candidate.test(normalized));
    if (!pattern) continue;
    matched = true;
    residualQuery = residualQuery.replace(pattern, " ").replace(/\s+/g, " ").trim();
    if (rule.intent.categoryKey) result.categoryKey = rule.intent.categoryKey;
    if (rule.intent.subcategoryKey) result.subcategoryKey = rule.intent.subcategoryKey;
    if (rule.intent.productType) result.productType = rule.intent.productType;
    if (rule.intent.giftable) result.giftable = true;
    result.recipients = mergeUnique(result.recipients, rule.intent.recipients || []);
    result.occasions = mergeUnique(result.occasions, rule.intent.occasions || []);
    result.attributes = mergeUnique(result.attributes, rule.intent.attributes || []);
    result.labels = mergeUnique(result.labels, rule.labels);
  }

  if (!matched) return null;
  result.residualQuery = residualQuery;
  return result;
}
