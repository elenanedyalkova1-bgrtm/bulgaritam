/** Query-time reader only. Extraction and adjudication run at build time. */
import type { EvidenceClaim } from "./search-evidence-build";
import vocabulary from "./search-evidence-materials.json";
type Card = { dataset: Record<string, string | undefined> };
const cache = new WeakMap<object, EvidenceClaim[]>();
export function sourceEvidence(card: Card): EvidenceClaim[] {
  const cached = cache.get(card);
  if (cached) return cached;
  let claims: EvidenceClaim[] = [];
  try {
    const data = JSON.parse(card.dataset.sourceEvidence || "null");
    if (
      data?.version === "source-evidence-v1" &&
      data.binding &&
      Object.entries(data.binding).every(([k, v]) => card.dataset[k] === v) &&
      Array.isArray(data.claims)
    )
      claims = data.claims.filter(
        (c: EvidenceClaim) =>
          c.productId === card.dataset.productId &&
          c.version === data.version &&
          typeof c.text === "string" &&
          c.text.length > 0 &&
          ["main", "component", "incidental"].includes(c.scope) &&
          (c.kind === "identity" || vocabulary.values.includes(c.concept)),
      );
  } catch {
    /* Missing/malformed evidence cannot establish attributes. */
  }
  cache.set(card, claims);
  return claims;
}
export function supportedSourceConcept(
  card: Card,
  kind: "material" | "identity",
  concept: string,
) {
  const claims = sourceEvidence(card).filter(
    (c) => c.kind === kind && c.concept === concept,
  );
  return (
    claims.some(
      (c) =>
        c.status === "approved" &&
        c.polarity === "positive" &&
        c.scope !== "incidental" &&
        (kind !== "identity" || c.scope === "main"),
    ) &&
    !claims.some(
      (c) =>
        c.status === "conflict" ||
        (c.polarity === "negative" && c.scope !== "incidental"),
    )
  );
}
