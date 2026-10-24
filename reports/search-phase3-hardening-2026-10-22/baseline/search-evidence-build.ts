import {
  compileDiscoveryRelations,
  RELATION_VERSION,
} from "./search-relations-build";
/** Build-time only. Original fields remain distinct from expanded searchRaw. */
import {
  automaticMaterialRule,
  automaticIdentityClaims,
} from "./search-evidence-auto";
import activationPolicy from "./search-evidence-auto-policy.json";
import reviews from "./search-evidence-reviews.json";
import vocabulary from "./search-evidence-materials.json";
export const EVIDENCE_RULE_VERSION = "source-evidence-v1";
export type EvidenceClaim = {
  productId: string;
  rowId?: number;
  kind: "material" | "identity";
  concept: string;
  field: "name_bg" | "short_desc_bg" | "long_desc_bg";
  text: string;
  start: number;
  scope: "main" | "component" | "incidental";
  polarity: "positive" | "negative" | "unknown";
  status: "approved" | "needs_review" | "rejected" | "conflict";
  rule: string;
  version: string;
  sourceUrl?: string;
  activation?: "reviewed" | "automatic";
  reviewReason?: string;
  proposedRule?: string;
};
export type EvidenceSource = {
  id: string;
  row_id?: number;
  slug: string;
  name_bg: string;
  short_desc_bg?: string;
  long_desc_bg?: string;
  materials: string[];
  product_type: string;
  product_url?: string;
  gift_occasion?: string[] | string;
  role_interest?: string[] | string;
};
export type EvidenceContext = {
  productId: string;
  productSlug: string;
  productName: string;
  productType: string;
  publicCategory: string;
  publicSubcategory: string;
  materials: string;
};
const fields = ["name_bg", "short_desc_bg", "long_desc_bg"] as const;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const materialPatterns: [string, RegExp][] = [
  ["Памук", /(?<!\p{L})(?:памук|памуч(?:ен|на|но|ни))(?!\p{L})/giu],
  ["Сребро", /(?<!\p{L})(?:сребро|сребър(?:ен|на|но|ни))(?!\p{L})/giu],
  ["Лен", /(?<!\p{L})(?:лен|ленен(?:а|о|и)?)(?!\p{L})/giu],
  ["Дърво", /(?<!\p{L})(?:дърво|дървен(?:а|о|и)?)(?!\p{L})/giu],
  ["Керамика", /(?<!\p{L})(?:керамика|керамич(?:ен|на|но|ни))(?!\p{L})/giu],
  ["Вълна", /(?<!\p{L})(?:вълна|вълнен(?:а|о|и)?)(?!\p{L})/giu],
  // Generic leather is deliberately not natural-leather proof.
  ["Естествена кожа", /(?<!\p{L})естествен(?:а|ата) кожа(?!\p{L})/giu],
];
const identityRules = [
  {
    concept: "shirt",
    category: "kids",
    subcategory: "kids_clothing",
    types: [""],
    title: /^Детска(?: северняшка)? риза(?:\s|$)/iu,
    source: /^Детска(?: северняшка)? риза от /iu,
  },
  {
    concept: "book",
    category: "books",
    subcategory: "books_journals",
    types: [""],
    title: /^Скреч книга(?:\s|$)/iu,
    source: /^Скреч книга[-–]албум(?:\s|$)/iu,
  },
  {
    concept: "cream",
    category: "cosmetics",
    subcategory: "cosmetics_face",
    types: ["Слънцезащита за лице"],
    title: /^Слънцезащитен крем за лице(?:\s|$)/iu,
    source: /^(?:Натурален слънцезащитен|Слънцезащитният) крем за лице /iu,
  },
];
export function compileSearchEvidence(
  p: EvidenceSource,
  context: EvidenceContext,
) {
  const claims: EvidenceClaim[] = [];
  const reviewFor = (kind: string, concept: string) =>
    reviews.find(
      (r) =>
        r.productId === String(p.id) &&
        r.slug === p.slug &&
        r.kind === kind &&
        r.concept === concept,
    );
  const reviewedStatus = (
    kind: string,
    concept: string,
  ): EvidenceClaim["status"] => {
    const r = reviewFor(kind, concept);
    // Full original field and taxonomy equality invalidate stale reviews.
    if (
      !r ||
      fields.some((f) => (p[f] || "") !== r.original[f]) ||
      Object.entries(r.binding).some(
        ([k, v]) => context[k as keyof EvidenceContext] !== v,
      )
    )
      return "needs_review";
    return r.status as EvidenceClaim["status"];
  };
  for (const field of fields) {
    const source = p[field] || "";
    for (const [concept, re] of materialPatterns) {
      if (!vocabulary.values.includes(concept))
        throw new Error("Noncanonical search material");
      for (const m of source.matchAll(re)) {
        const start = source.lastIndexOf(".", m.index) + 1,
          end = source.indexOf(".", m.index);
        const sentence = source
          .slice(start, end < 0 ? source.length : end)
          .trim();
        const incidental =
          /(?:опаковк|кутия|резерват|програма за|пране|вдъхнов|семейно дърво)/iu.test(
            sentence,
          );
        const negative = new RegExp(
          `(?:не (?:е|са|съдържа)|без)\\s+(?:\\p{L}+\\s+){0,2}${escape(m[0])}`,
          "iu",
        ).test(sentence);
        const r = reviewFor("material", concept);
        const status = reviewedStatus("material", concept);
        const approved = status === "approved" && !incidental && !negative;
        claims.push({
          productId: String(p.id),
          rowId: p.row_id,
          kind: "material",
          concept,
          field,
          text: source.slice(start, end < 0 ? source.length : end),
          start,
          scope: incidental
            ? "incidental"
            : /текстилните елементи|гризалката|каишка|шапка|цокъл/iu.test(
                  sentence,
                )
              ? "component"
              : (r?.scope as "main" | "component") || "main",
          polarity: negative ? "negative" : "positive",
          status: approved
            ? "approved"
            : status === "approved"
              ? "needs_review"
              : status,
          rule: incidental
            ? "incidental-mention"
            : negative
              ? "explicit-negation"
              : "explicit-material-mention-reviewed",
          version: EVIDENCE_RULE_VERSION,
        });
      }
    }
  }
  for (const rule of identityRules) {
    if (
      context.publicCategory !== rule.category ||
      context.publicSubcategory !== rule.subcategory ||
      !rule.types.includes(p.product_type) ||
      !rule.title.test(p.name_bg)
    )
      continue;
    for (const field of ["short_desc_bg", "long_desc_bg"] as const) {
      const text = p[field] || "";
      if (!rule.source.test(text)) continue;
      claims.push({
        productId: String(p.id),
        rowId: p.row_id,
        kind: "identity",
        concept: rule.concept,
        field,
        text,
        start: 0,
        scope: "main",
        polarity: "positive",
        status: reviewedStatus("identity", rule.concept),
        rule: "taxonomy-main-head-and-independent-description",
        version: EVIDENCE_RULE_VERSION,
      });
      break;
    }
  }
  // Legacy disagreement is diagnostic, never a deletion rule.
  for (const r of reviews.filter(
    (r) =>
      r.productId === String(p.id) &&
      r.status === "conflict" &&
      reviewedStatus(r.kind, r.concept) === "conflict",
  ))
    claims.push({
      productId: String(p.id),
      rowId: p.row_id,
      kind: "material",
      concept: r.concept,
      field: "long_desc_bg",
      text: p.long_desc_bg || "",
      start: 0,
      scope: "main",
      polarity: "unknown",
      status: "conflict",
      rule: "reviewed-structured-source-conflict",
      version: EVIDENCE_RULE_VERSION,
    });
  // Existing adjudications (including stale, negative and component reviews)
  // retain their earlier policy. Generic activation applies to unreviewed claims.
  for (const claim of claims) {
    if (claim.status === "approved") claim.activation = "reviewed";
    if (claim.status !== "needs_review" || reviewFor(claim.kind, claim.concept))
      continue;
    const aggregate =
      /^Комплект/iu.test(p.product_type) ||
      /комплект|(?<!\p{L})сет(?!\p{L})/iu.test(p.name_bg);
    const proof = aggregate
      ? undefined
      : automaticMaterialRule(p, context, claim);
    if (proof) {
      claim.proposedRule = proof;
      if (
        (activationPolicy.enabledMaterials as string[]).includes(claim.concept)
      ) {
        claim.status = "approved";
        claim.rule = proof;
        claim.activation = "automatic";
      } else
        claim.reviewReason =
          "Insufficient independent holdout coverage for material class";
    } else
      claim.reviewReason =
        "Mention alone is not main-product composition proof";
  }
  for (const claim of automaticIdentityClaims(p, context))
    if (!reviewFor("identity", claim.concept)) {
      const allSource = [
        p.name_bg,
        p.short_desc_bg || "",
        p.long_desc_bg || "",
      ].join(" ");
      const conflictingIdentity =
        /(?:не (?:е|са)|без включени|само (?:мотив|щампа)|за кукл)/iu.test(
          allSource,
        );
      if (
        !activationPolicy.enabledIdentities.includes(claim.concept) ||
        conflictingIdentity
      ) {
        claim.status = "needs_review";
        claim.proposedRule = claim.rule;
        delete claim.activation;
        claim.reviewReason = conflictingIdentity
          ? "Negation, motif or toy context requires review"
          : "Insufficient independent holdout coverage for identity class";
      }
      const existing = claims.find(
        (c) => c.kind === "identity" && c.concept === claim.concept,
      );
      if (existing) Object.assign(existing, claim);
      else claims.push(claim);
    }
  // Contradictory explicit claims block only new evidence, not stored matches.
  for (const claim of claims)
    if (
      claim.status === "approved" &&
      claims.some(
        (c) =>
          c.concept === claim.concept &&
          c.kind === claim.kind &&
          c.polarity === "negative" &&
          c.scope !== "incidental",
      )
    )
      claim.status = "conflict";
  for (const claim of claims) {
    claim.sourceUrl =
      reviews.find(
        (r) =>
          r.productId === String(p.id) &&
          r.kind === claim.kind &&
          r.concept === claim.concept,
      )?.sourceUrl || p.product_url;
  }
  return {
    version: EVIDENCE_RULE_VERSION,
    binding: context,
    claims,
    relationVersion: RELATION_VERSION,
    relations: compileDiscoveryRelations(p, context),
  };
}
