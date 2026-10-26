/** Build-time deterministic proofs; no product IDs, scores or query-time extraction. */
import type {
  EvidenceClaim,
  EvidenceContext,
  EvidenceSource,
} from "./search-evidence-build";
const has = (text: string, word: string) =>
  new RegExp(`(?<!\\p{L})${word}(?!\\p{L})`, "iu").test(text);
const primaryNouns = [
  ["риза", "риз(?:а|ата)"],
  ["тениска", "тениск(?:а|ата)"],
  ["рокля", "рокл(?:я|ята)"],
  ["пола", "пол(?:а|ата)"],
  ["панталон", "панталон(?:и|ите)?"],
  ["блуза", "блуз(?:а|ата)"],
  ["чанта", "чант(?:а|ата)"],
  ["одеяло", "одеял(?:о|ото)"],
  ["шапка", "шапк(?:а|ата)"],
  ["туника", "туник(?:а|ата)"],
  ["пончо", "пончо(?:то)?"],
  ["кърпа", "кърп(?:а|ата)"],
  ["халат", "халат(?:ът|а)?"],
  ["чорапи", "чорап(?:и|ите)"],
] as const;
const risky =
  /(?:комплект|\bсет\b|корсет|t[- ]shirt|вдъхнов|резерват|имитаци|сребрист|позлат|посребр|веган|изкуствен|еко кожа|програма за|пране|кутия|опаковк|без\s+(?:\p{L}+\s+){0,2}(?:памук|лен|вълна|кожа)|не\s+(?:е|са|съдържа|включва))/iu;
const materialForms: Record<string, string> = {
  Памук:
    "(?:(?:GOTS сертифициран |сертифициран )?(?:органичен |пениран )?(?:памук|памучен (?:муселин|кенар)))",
  Лен: "лен",
  Вълна: "(?:студена )?вълна",
  "Естествена кожа": "естествена кожа",
};
export function automaticMaterialRule(
  p: EvidenceSource,
  context: EvidenceContext,
  claim: EvidenceClaim,
): string | undefined {
  if (
    claim.kind !== "material" ||
    claim.polarity !== "positive" ||
    claim.scope !== "main" ||
    claim.field === "name_bg" ||
    context.productId !== String(p.id)
  )
    return;
  if (
    !["clothing", "accessories", "kids", "home"].includes(
      context.publicCategory,
    )
  )
    return;
  const form = materialForms[claim.concept];
  if (!form) return;
  const all = [p.name_bg, p.short_desc_bg || "", p.long_desc_bg || ""].join(
    " ",
  );
  if (risky.test(all)) return;
  const noun = primaryNouns.find(([, pattern]) => has(p.name_bg, pattern));
  if (!noun) return;
  // Main subject must be present in the composition sentence, or an immediately
  // previous sentence identifying that same product before an explicit passive.
  const source = p[claim.field] || "";
  const prefix = source.slice(0, claim.start);
  const previous =
    prefix
      .split(/[.!?]/)
      .filter((s) => s.trim())
      .at(-1) || "";
  const mainSubject =
    has(claim.text, noun[1]) ||
    (/^\s*Изработен[аои]? (?:е|са) от /iu.test(claim.text) &&
      has(previous, noun[1]));
  if (
    !mainSubject ||
    /(?:подплат|хастар|етикет|каишк|дръжк|гризалк|елемент|копче|пълнеж)/iu.test(
      claim.text,
    )
  )
    return;
  const composition = new RegExp(
    `изработен[аои]?\\s+(?:(?:е|са)\\s+)?от\\s+100\\s*%\\s+${form}(?!\\p{L})`,
    "iu",
  );
  let proofRule = "automatic-main-composition-100-v1";
  if (!composition.test(claim.text)) {
    // Direct main-noun attachment: e.g. "одеяло от 100% памук".
    // No intervening coordination or preposition may attach composition to a part.
    const attachment = new RegExp(
      `${noun[1]}(?!\\p{L})\\s+от\\s+100\\s*%\\s+${form}(?!\\p{L})`,
      "iu",
    );
    if (!attachment.test(claim.text)) return;
    proofRule = "automatic-main-noun-attachment-100-v1";
  }
  // A different percentage composition anywhere in the source is unresolved;
  // do not reinterpret blends, lining or contradictory composition as whole proof.
  for (const m of all.matchAll(/\d+(?:[.,]\d+)?\s*%\s+([^,.!;]+)/gu)) {
    if (
      !new RegExp(`^${form}(?!\\p{L})`, "iu").test(m[1]) ||
      !/^100\s*%/u.test(m[0])
    )
      return;
  }
  // An exclusive stored alternative is a conflict, not an incomplete list.
  const stored = p.materials;
  const compatible =
    claim.concept === "Памук"
      ? ["Памук", "Органичен памук", "Муселин"]
      : [claim.concept];
  if (stored.length && !stored.every((v) => compatible.includes(v))) return;
  return proofRule;
}
const qualifiers =
  "(?:(?:Детска|Дамска|Мъжка|Северняшка|Ленена|Памучна|Бяла|Черна|Скреч|Натурален|Хидратиращ|Слънцезащитен|Сребърни|Златни|Дамски)\\s+){0,2}";
const identities = [
  {
    concept: "shirt",
    categories: ["kids", "clothing"],
    subcategories: ["kids_clothing", "clothing_women", "clothing_men"],
    types: ["", "Ризи", "Блузи и ризи"],
    head: "риза",
  },
  {
    concept: "book",
    categories: ["books"],
    subcategories: ["books_journals"],
    types: ["", "Български автори", "Детски книги"],
    head: "книга",
  },
  {
    concept: "cream",
    categories: ["cosmetics"],
    subcategories: ["cosmetics_face"],
    types: ["Кремове за лице", "Слънцезащита за лице"],
    head: "крем за лице",
  },
  {
    concept: "dress",
    categories: ["kids", "clothing"],
    subcategories: ["kids_clothing", "clothing_women"],
    types: ["", "Рокли"],
    head: "рокля",
  },
  {
    concept: "earrings",
    categories: ["accessories"],
    subcategories: ["accessories_jewelry"],
    types: ["", "Обеци"],
    head: "(?:обеци|обици)",
  },
];
export function automaticIdentityClaims(
  p: EvidenceSource,
  context: EvidenceContext,
): EvidenceClaim[] {
  if (context.productId !== String(p.id) || risky.test(p.name_bg)) return [];
  const out: EvidenceClaim[] = [];
  for (const rule of identities) {
    if (
      !rule.categories.includes(context.publicCategory) ||
      !rule.subcategories.includes(context.publicSubcategory) ||
      !rule.types.includes(p.product_type)
    )
      continue;
    const head = new RegExp(`^${qualifiers}${rule.head}(?!\\p{L})`, "iu");
    if (!head.test(p.name_bg)) continue;
    for (const field of ["short_desc_bg", "long_desc_bg"] as const) {
      const text = p[field] || "";
      if (!head.test(text) || risky.test(text)) continue;
      out.push({
        productId: String(p.id),
        rowId: p.row_id,
        kind: "identity",
        concept: rule.concept,
        field,
        text,
        start: 0,
        scope: "main",
        polarity: "positive",
        status: "approved",
        rule: "automatic-taxonomy-main-head-dual-source-v1",
        version: "source-evidence-v1",
        activation: "automatic",
      });
      break;
    }
  }
  return out;
}
