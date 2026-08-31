export type AudienceKey = "woman" | "man" | "child" | "baby";

export type StructuredSearchIntent = {
  categoryKey?: string;
  subcategoryKey?: string;
  productType?: string;
  giftable?: boolean;
  audienceKey?: AudienceKey;
  recipients: string[];
  occasions: string[];
  attributes: string[];
  materials: string[];
  maxPriceEur?: number;
  residualQuery: string;
  labels: string[];
};

export type SearchIntentOptions = { materials?: string[] };

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLocaleLowerCase("bg")
    .replace(/[„“”'\"`´’‘]/g, "")
    .replace(/[^a-zа-я0-9€.,]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

type Rule = {
  patterns: RegExp[];
  intent: Partial<Omit<StructuredSearchIntent, "residualQuery" | "labels">>;
  labels: string[];
};

const RULES: Rule[] = [
  { patterns: [/дамск(?:а|и)\s+рокл(?:я|и)/], intent: { categoryKey: "clothing", subcategoryKey: "clothing_women", productType: "Рокли", audienceKey: "woman" }, labels: ["Облекло", "Дамско облекло", "Рокли", "За жена"] },
  { patterns: [/мъжк(?:а|и)\s+пижам(?:а|и)/], intent: { categoryKey: "clothing", subcategoryKey: "clothing_men", productType: "Пижами и домашни комплекти", audienceKey: "man" }, labels: ["Облекло", "Мъжко облекло", "Пижами и домашни комплекти", "За мъж"] },
  { patterns: [/мъжк(?:и|а)\s+(?:анцуг(?:и)?|спортн(?:и|а)\s+екип(?:и)?)/], intent: { categoryKey: "clothing", subcategoryKey: "clothing_men", productType: "Спортни екипи", audienceKey: "man" }, labels: ["Облекло", "Мъжко облекло", "Спортни екипи", "За мъж"] },
  { patterns: [/сребърн(?:и|а|о)\s+обеци/], intent: { categoryKey: "accessories", subcategoryKey: "accessories_jewelry", productType: "Обеци" }, labels: ["Аксесоари", "Бижута", "Обеци"] },
  { patterns: [/крем(?:ове)?\s+за\s+лице/, /лицев(?:и|а)\s+крем(?:ове)?/], intent: { categoryKey: "cosmetics", subcategoryKey: "cosmetics_face", productType: "Кремове за лице" }, labels: ["Козметика", "Грижа за лицето", "Кремове за лице"] },
  { patterns: [/натурал(?:ен|на|но|ни)\s+шампоан(?:и)?/], intent: { categoryKey: "cosmetics", subcategoryKey: "cosmetics_hair", productType: "Шампоани", attributes: ["Натурален"] }, labels: ["Козметика", "Грижа за косата", "Шампоани", "Натурален"] },
];

const AUDIENCE_PATTERNS: Array<{ key: AudienceKey; pattern: RegExp; recipient: string; label: string }> = [
  { key: "woman", pattern: /(?:^|\s)(?:за\s+)?(?:жен(?:а|и)|женск(?:и|а|о)|дамск(?:и|а|о)|women|woman)(?=\s|$)/, recipient: "За жена", label: "За жена" },
  { key: "man", pattern: /(?:^|\s)(?:за\s+)?(?:мъж(?:а|е|и)?|мъжк(?:и|а|о)|men|man)(?=\s|$)/, recipient: "За мъж", label: "За мъж" },
  { key: "baby", pattern: /(?:^|\s)(?:за\s+)?(?:бебе|бебета|бебешк(?:и|а|о)|новородено)(?=\s|$)/, recipient: "За бебе", label: "За бебе" },
  { key: "child", pattern: /(?:^|\s)(?:за\s+)?(?:дете|деца|детск(?:и|а|о))(?=\s|$)/, recipient: "За дете", label: "За дете" },
];

const MATERIAL_ALIASES: Array<{ match: RegExp; catalogueTerms: RegExp[] }> = [
  { match: /(?:^|\s)(?:памук|памуч(?:ен|на|но|ни))(?=\s|$)/, catalogueTerms: [/памук/] },
  { match: /(?:^|\s)(?:лен|ленен|ленена|ленено|ленени)(?=\s|$)/, catalogueTerms: [/^лен$/, /лен/] },
  { match: /(?:^|\s)(?:кожа|кожен|кожена|кожено|кожени)(?=\s|$)/, catalogueTerms: [/кожа/] },
  { match: /(?:^|\s)(?:вълна|вълнен|вълнена|вълнено|вълнени)(?=\s|$)/, catalogueTerms: [/вълна/] },
];

const mergeUnique = (left: string[], right: string[]) => Array.from(new Set([...left, ...right]));
const cleanResidual = (value: string) => value.replace(/(^|\s)(?:за|от|с|на)(?=\s|$)/g, " ").replace(/\s+/g, " ").trim();

export function parseBulgarianShoppingIntent(value: unknown, options: SearchIntentOptions = {}): StructuredSearchIntent | null {
  const normalized = normalize(value);
  if (!normalized) return null;

  let residualQuery = normalized;
  let matched = false;
  const result: StructuredSearchIntent = { recipients: [], occasions: [], attributes: [], materials: [], residualQuery: "", labels: [] };

  const maxPricePattern = /(?:^|\s)(?:до|под)\s*(?:€\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:€|евро|eur)?(?=\s|$)/;
  const maxPriceMatch = residualQuery.match(maxPricePattern);
  if (maxPriceMatch) {
    const parsed = Number(maxPriceMatch[1].replace(",", "."));
    if (Number.isFinite(parsed)) {
      matched = true;
      result.maxPriceEur = parsed;
      result.labels.push(`До €${parsed}`);
      residualQuery = residualQuery.replace(maxPricePattern, " ");
    }
  }

  const giftPattern = /(?:^|\s)подар(?:ък|ъци)(?=\s|$)/;
  if (giftPattern.test(residualQuery)) {
    matched = true;
    result.giftable = true;
    result.labels.push("Подарък");
    residualQuery = residualQuery.replace(giftPattern, " ");
  }

  const weddingPattern = /(?:^|\s)(?:за\s+)?(?:сватба|сватбен|сватбена|сватбени)(?=\s|$)/;
  if (weddingPattern.test(residualQuery)) {
    matched = true;
    result.giftable = true;
    result.occasions.push("Сватба");
    result.labels = mergeUnique(result.labels, ["Подарък", "Сватба"]);
    residualQuery = residualQuery.replace(weddingPattern, " ");
  }

  for (const rule of RULES) {
    const pattern = rule.patterns.find((candidate) => candidate.test(residualQuery));
    if (!pattern) continue;
    matched = true;
    residualQuery = residualQuery.replace(pattern, " ");
    if (rule.intent.categoryKey) result.categoryKey = rule.intent.categoryKey;
    if (rule.intent.subcategoryKey) result.subcategoryKey = rule.intent.subcategoryKey;
    if (rule.intent.productType) result.productType = rule.intent.productType;
    if (rule.intent.audienceKey) result.audienceKey = rule.intent.audienceKey;
    if (rule.intent.giftable) result.giftable = true;
    result.recipients = mergeUnique(result.recipients, rule.intent.recipients || []);
    result.occasions = mergeUnique(result.occasions, rule.intent.occasions || []);
    result.attributes = mergeUnique(result.attributes, rule.intent.attributes || []);
    result.labels = mergeUnique(result.labels, rule.labels);
  }

  for (const audience of AUDIENCE_PATTERNS) {
    if (!audience.pattern.test(residualQuery)) continue;
    matched = true;
    result.audienceKey = audience.key;
    result.labels = mergeUnique(result.labels, [audience.label]);
    if (result.giftable) result.recipients = mergeUnique(result.recipients, [audience.recipient]);
    residualQuery = residualQuery.replace(audience.pattern, " ");
    break;
  }

  const availableMaterials = (options.materials || []).filter(Boolean);
  for (const alias of MATERIAL_ALIASES) {
    if (!alias.match.test(residualQuery)) continue;
    const catalogueMaterials = availableMaterials.filter((material) => {
      const normalizedMaterial = normalize(material);
      return alias.catalogueTerms.some((pattern) => pattern.test(normalizedMaterial));
    });
    if (!catalogueMaterials.length) continue;
    matched = true;
    result.materials = mergeUnique(result.materials, catalogueMaterials);
    result.labels = mergeUnique(result.labels, [catalogueMaterials[0]]);
    residualQuery = residualQuery.replace(alias.match, " ");
  }

  if (!matched) return null;
  result.residualQuery = cleanResidual(residualQuery);
  return result;
}
