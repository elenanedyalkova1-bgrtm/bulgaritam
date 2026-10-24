/** Query-time typed relation reader/resolver. No source-text extraction here. */
import type { RelationClaim } from "./search-relations-build";
import taxonomy from "./search-relation-taxonomy.json";
type Card = { dataset: Record<string, string | undefined> };
export type RequestedAge = {
  min: number;
  max: number;
  unit: "years" | "months";
  minInclusive?: boolean;
};
const cache = new WeakMap<object, RelationClaim[]>();
export function discoveryRelations(card: Card): RelationClaim[] {
  let value = cache.get(card);
  if (value) return value;
  value = [];
  try {
    const data = JSON.parse(card.dataset.sourceEvidence || "null");
    if (
      data?.relationVersion === "discovery-relations-v1" &&
      data.binding && Object.keys(data.binding).length === 7 &&
      Object.entries(data.binding || {}).every(
        ([k, v]) => card.dataset[k] === v,
      ) &&
      Array.isArray(data.relations)
    )
      value = data.relations.filter(
        (r: RelationClaim) =>
          r.productId === card.dataset.productId &&
          r.version === "discovery-relations-v1",
      );
  } catch {}
  cache.set(card, value);
  return value;
}
export function relationProof(
  card: Card,
  kind: RelationClaim["kind"],
  concept: string,
) {
  const records = discoveryRelations(card).filter(
    (r) => r.kind === kind && r.concept === concept && r.status === "approved",
  );
  return records.some((r) => r.polarity === "negative")
    ? []
    : records.filter((r) => r.polarity === "positive");
}
export function relatedItem(
  card: Card,
  key: string,
  materials: string[] = [],
  colors: string[] = [],
) {
  // Component color propagation is not implemented: explicit item color stays strict.
  if (colors.length) return false;
  return relationProof(card, "contains_item", key).some((r) =>
    materials.every((m) => r.materials?.includes(m)),
  );
}
export function excludedItemTerms(card: Card, terms: string[]) {
  const chain = ["verizhka", "verizhki", "sindzhir", "sindzhiri", "chain"];
  return (
    terms.some((t) => chain.includes(t)) &&
    discoveryRelations(card).some(
      (r) =>
        r.kind === "contains_item" &&
        r.concept === "chain" &&
        r.polarity === "negative" &&
        r.status === "approved",
    )
  );
}
export function requestedAgeFromFolded(
  text: string,
): { age: RequestedAge; text: string } | undefined {
  const m = text.match(
    /(?:^|\s)(?:na\s+(\d{1,3})\s+(godini|godina|mesetsa|mesetsi|mesets)|ot\s+(\d{1,3})\s+do\s+(\d{1,3})\s+(godini|mesetsa)|nad\s+(\d{1,3})\s+(godini|mesetsa))(?=\s|$)/,
  );
  if (!m) return;
  const min = Number(m[1] || m[3] || m[6]),
    max = Number(m[1] || m[4] || "120"),
    u = m[2] || m[5] || m[7];
  if (min > max || max > (u.startsWith("mes") ? 1440 : 120)) return;
  return {
    age: { min, max, unit: u.startsWith("mes") ? "months" : "years", ...(m[6] ? {minInclusive:false} : {}) },
    text: m[0].trim(),
  };
}
export function ageEvidence(
  card: Card,
  age: RequestedAge,
  recipients: string[],
): "supported" | "contradicted" | "unknown" {
  const factor = age.unit === "years" ? 12 : 1,
    lo = age.min * factor,
    hi = age.max * factor;
  const source = discoveryRelations(card).filter(
    (r) =>
      r.kind === "age" &&
      r.status === "approved" &&
      r.age &&
      r.polarity === "positive",
  );
  // Current extractor handles explicit child/baby suitability, never adult age inference.
  const applicable = lo < 18 * 12 ? source : [];
  if (applicable.length) {
    const covers = applicable.every((r) => {
      const a = r.age!,
        f = a.unit === "years" ? 12 : 1;
      return (
        (a.minInclusive ? lo >= a.min * f : (lo > a.min * f || (lo === a.min * f && age.minInclusive === false))) &&
        (a.maxInclusive ? hi <= a.max * f : hi < a.max * f)
      );
    });
    if (covers) return "supported";
    const oneCovers = applicable.some((r) => {
      const a = r.age!,
        f = a.unit === "years" ? 12 : 1;
      return (
        (a.minInclusive ? lo >= a.min * f : (lo > a.min * f || (lo === a.min * f && age.minInclusive === false))) &&
        (a.maxInclusive ? hi <= a.max * f : hi < a.max * f)
      );
    });
    // A legacy lexical match with an explicit positive source is retained when
    // short/long disagree. This is a review conflict, never a new age inference.
    const raw = String(card.dataset.searchRaw || "");
    const legacyPoint =
      age.min === age.max &&
      new RegExp(`(?<![\\p{L}\\p{N}])${age.min}(?![\\p{L}\\p{N}])`, "u").test(
        raw,
      ) &&
      new RegExp(age.unit === "years" ? "годин[иа]" : "месец[аи]", "iu").test(
        raw,
      );
    return oneCovers && legacyPoint ? "supported" : "contradicted";
  }
  if (age.unit === "months" || age.min !== age.max) return "unknown";
  const values = String(card.dataset.recipientAge || "")
    .split("|")
    .filter(Boolean);
  const storedRecipients = String(card.dataset.recipients || "").split("|");
  const requested = recipients.length ? recipients : storedRecipients;
  const canonical = requested.flatMap(
    (r) => (taxonomy.ages as Record<string, string[]>)[r] || [],
  );
  // Noncanonical values are ignored, never split decimals or rounded.
  const approved = values.filter((v) => canonical.includes(v));
  return approved.includes(String(age.min))
    ? "supported"
    : approved.length
      ? "contradicted"
      : "unknown";
}
export function occasionEvidence(
  card: Card,
  concept: string,
  legacyTerms: string[],
) {
  if (relationProof(card, "occasion", concept).length) return true;
  const raw = String(card.dataset.searchRaw || "").toLocaleLowerCase("bg");
  // Legacy text retrieval is retained by the caller's original lexical token rules.
  return (
    legacyTerms.length > 0 &&
    legacyTerms.every((t) =>
      new RegExp(`(?<![\\p{L}\\p{N}])${t}(?![\\p{L}\\p{N}])`, "iu").test(raw),
    )
  );
}
