import {clauses, negativeClause, mentionPolarity, excludedMention} from "./search-evidence-scope";
import { occasionAliases } from "./search-relation-concepts";
/** Original-source relation extraction, build-time only. */
import type { EvidenceContext, EvidenceSource } from "./search-evidence-build";
import taxonomy from "./search-relation-taxonomy.json";
import reviews from "./search-relation-reviews.json";
export const RELATION_VERSION = "discovery-relations-v2";
export type AgeInterval = {
  min: number;
  max: number;
  minInclusive: boolean;
  maxInclusive: boolean;
  unit: "years" | "months";
};
export type RelationClaim = {
  productId: string;
  rowId?: number;
  kind: "contains_item" | "occasion" | "offered_variant" | "role" | "age";
  concept: string;
  field: string;
  text: string;
  start: number;
  scope: "main" | "component" | "variant";
  polarity: "positive" | "negative";
  status: "approved" | "needs_review";
  rule: string;
  version: string;
  sourceUrl?: string;
  materials?: string[];
  age?: AgeInterval;
  support?: { field: string; text: string };
  conflict?: boolean;
  birthdayRank?: "direct" | "general" | "conditional";
};
export type RelationSource = EvidenceSource & {
  gift_occasion?: string[] | string;
  role_interest?: string[] | string;
};
const list = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map(String)
    : String(v || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
const terms = {
  earrings: /(?<!\p{L})(?:обеци|обиците|обеца|обици|обеците)(?!\p{L})/iu,
  shirt: /(?<!\p{L})(?:риза|ризата|ризи|ризите)(?!\p{L})/iu,
};
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const whole = (s: string) =>
  new RegExp(`(?<!\\p{L})${escape(s)}(?!\\p{L})`, "iu");
const sentenceSpans = (s: string) =>
  [...s.matchAll(/[^.!?]+(?:[.!?]|$)/gu)].map((m) => ({
    text: m[0],
    start: m.index!,
  }));
const unit = (s: string): "years" | "months" =>
  /^мес/iu.test(s) ? "months" : "years";
export function compileDiscoveryRelations(
  p: RelationSource,
  context: EvidenceContext,
): RelationClaim[] {
  const out: RelationClaim[] = [];
  const add = (
    kind: RelationClaim["kind"],
    concept: string,
    field: string,
    text: string,
    start: number,
    extra: Partial<RelationClaim> = {},
  ) =>
    out.push({
      productId: String(p.id),
      rowId: p.row_id,
      kind,
      concept,
      field,
      text,
      start,
      scope: "main",
      polarity: "positive",
      status: "approved",
      rule: "explicit-original-source",
      version: RELATION_VERSION,
      sourceUrl: p.product_url,
      ...extra,
    });
  const aggregate =
    /^Комплект/iu.test(p.product_type) ||
    /(?<!\p{L})(?:комплект|комплектът|сет)(?!\p{L})/iu.test(p.name_bg);
  for (const field of ["name_bg", "short_desc_bg", "long_desc_bg"] as const) {
    const source = p[field] || "";
    if (field !== "name_bg" && aggregate) {
      for (const m of source.matchAll(
        /(?:включва(?:щ|ща|що|щи)?|съдържа|комплект\s+от)\s+([^.!?;]+)/giu,
      )) {
        if (/(?:не|може да|могат да)\s*$/iu.test(source.slice(Math.max(0, m.index! - 20), m.index)))
          continue;
        const start = m.index! + m[0].indexOf(m[1]);
        for (const [key, re] of Object.entries(terms)) {
          const match = m[1].match(re);
          if (!match) continue;
          const itemAt = match.index!,
            left = m[1].slice(Math.max(0, itemAt - 35), itemAt),
            right = m[1].slice(itemAt, itemAt + 80).split(/\s+и\s+|,\s*(?:а|но)\s+/u)[0];
          const ambiguous =
            /(?:вдъхнов|като|боди|десен|мотив|тип|избор|възможност)/iu.test(left) ||
            /(?:по избор|опционал|(?:закупува|купува|продава|предлага)\p{L}*\s+(?:се\s+)?отделно|не е включ|не са включ)/iu.test(
              right,
            );
          const reviewed = reviews.find(
            (r) =>
              r.slug === p.slug &&
              r.concept === key &&
              r.field === field &&
              r.text === source,
          );
          const materials =
            reviewed?.materials ||
            (/(?<!\p{L})сребърни\s*$/iu.test(left) && !/(?:не|без)\s+сребърни\s*$/iu.test(left) ? ["Сребро"] : []);
          add("contains_item", key, field, m[1], start, {
            scope: "component",
            status: ambiguous ? "needs_review" : "approved",
            materials,
            rule: reviewed
              ? "reviewed-included-item-composition"
              : "explicit-aggregate-includes-list",
          });
        }
      }
    }
    for (const span of sentenceSpans(source)) {
      const text = span.text;
      for (const [key, re] of [
        ...Object.entries(terms),
        ["chain", /(?<!\p{L})(?:верижк\p{L}*|синджир\p{L}*)(?!\p{L})/iu],
      ] as [string, RegExp][])
        if (
          excludedMention(text,re)
        )
          add("contains_item", key, field, text, span.start, {
            scope: "component",
            polarity: "negative",
            rule: "explicit-excluded-item",
          });
      for (const [concept, aliases] of occasionAliases) {
        if (concept !== "housewarming" && !taxonomy.occasions.includes(concept))
          continue;
        for (const clause of clauses(text)) {
          const mention = aliases.map(v=>whole(v).exec(clause.text)).find(Boolean);
          if (!mention) continue;
          const before = clause.text.slice(0, mention.index);
          // An occasion printed on packaging or an incidental included gift is not
          // a purpose claim about the main product. Retain its provenance for review.
          const incidental = /(?:включва|съдържа|бонус|добавен[ао]?)\s+[^;.!?]{0,100}(?:подарък|картичк\p{L}*|опаковк\p{L}*|кутия)[^;.!?]{0,30}$/iu.test(before);
          const packaging = /(?:опаковк\p{L}*|панделк\p{L}*|подаръчна кутия)\s+(?:за\s+|по случай\s+)?$/iu.test(before);
          const review = negativeClause(clause.text) || incidental || packaging;
          add("occasion", concept, field, clause.text, span.start + clause.start, {
            status: review ? "needs_review" : "approved",
            rule: review ? "scoped-occasion-not-main-purpose" : "explicit-occasion-text",
          });
        }
      }
      const rolePattern = /(?:за|подарък за)\s+учител(?:ка|ката|я|и|ите)?(?!\p{L})/iu;
      const rolePolarity = mentionPolarity(text, rolePattern);
      if (rolePolarity !== "absent" && !/създаден[ао]? от/iu.test(text))
        add("role", "Учителка", field, text, span.start, {
          polarity: rolePolarity,
          rule: "scoped-intended-teacher-role-no-gender-inference",
        });
      // Offered colors must be an explicit option list, never a decorative detail.
      if (
        /предлага(?:т)? се в/iu.test(text) &&
        /(?:вариант|цвят|цветове)/iu.test(text) &&
        !/(?:подплат|хастар|декорац|принт|щамп|кутия|опаковк|печат|масло|чай)/iu.test(
          text,
        )
      ) {
        const colors: [string, RegExp][] = [
          ["Бял", /(?<!\p{L})бял(?:а|о|и)?(?!\p{L})/iu],
          ["Син", /(?<!\p{L})син(?:я|ьо|и)?(?!\p{L})/iu],
          ["Светлосин", /(?<!\p{L})светлосин(?:я|ьо|и)?(?!\p{L})/iu],
          ["Черен", /(?<!\p{L})чер(?:ен|на|но|ни)(?!\p{L})/iu],
          ["Розов", /(?<!\p{L})розов(?:а|о|и)?(?!\p{L})/iu],
          ["Бежов", /(?<!\p{L})бежов(?:а|о|и)?(?!\p{L})/iu],
          ["Зелен", /(?<!\p{L})зелен(?:а|о|и)?(?!\p{L})/iu],
        ];
        for (const [color, re] of colors)
          if (re.test(text))
            add("offered_variant", color, field, text, span.start, {
              scope: "variant",
              polarity: mentionPolarity(text, re) === "negative" ? "negative" : "positive",
              rule: "explicit-offered-color-options-not-stock",
            });
      }
      // Explicit recipient suitability only. Size/delivery/warranty/bed-part claims abstain.
      const intro = text.match(
        /(?:подходящ[аои]?(?: е)?\s+за\s+(?:деца|бебета)(?: на възраст)?|за (?:деца|(?:новородени и )?бебета)(?: на възраст)?|за възраст)\s+(.+)/iu,
      );
      if (intro) {
        const body = intro[1],
          ambiguous =
            /(?:размер|гаранци|достав|горно|долно|легло|обиколк)/iu.test(text);
        const range = body.match(
          /от\s+(\d+)\s*(месеца|месеци|месец|години|година)?\s*(?:до|[–-])\s*(\d+)\s*(месеца|месеци|месец|години|година)/iu,
        );
        const single = body.match(
          /^(над|до|от|на)\s+(\d+)\s*(месеца|месеци|месец|години|година)/iu,
        );
        let age: AgeInterval | undefined;
        if (range) {
          const u = unit(range[4]),
            u0 = range[2] ? unit(range[2]) : u;
          const factor = (n: string, uu: string) =>
            Number(n) * (uu === "years" ? 12 : 1);
          age = {
            min: factor(range[1], u0),
            max: factor(range[3], u),
            minInclusive: true,
            maxInclusive: true,
            unit: "months",
          };
        } else if (single) {
          const n = Number(single[2]),
            u = unit(single[3]);
          age = {
            min: single[1] === "до" ? 0 : n,
            max: single[1] === "над" || single[1] === "от" ? 9999 : n,
            minInclusive: single[1] !== "над",
            maxInclusive: true,
            unit: u,
          };
        }
        if (age && age.min <= age.max)
          add("age", "recipient_age", field, text, span.start, {
            age,
            polarity: negativeClause(text) ? "negative" : "positive",
            status: ambiguous ? "needs_review" : "approved",
            rule: "explicit-recipient-age-with-units-and-bounds",
          });
      }
    }
  }
  // Structured occasion evidence is activated only with independent explicit gift purpose.
  const giftSource = (["short_desc_bg", "long_desc_bg"] as const).flatMap(
    (field) =>
      sentenceSpans(p[field] || "")
        .flatMap(s=>clauses(s.text).map(c=>({text:c.text,start:s.start+c.start})))
        .filter(
          (s) =>
            ((/^Подаръчна кутия/iu.test(p.name_bg) && /^\s*Подаръчна кутия/iu.test(s.text)) || /(?:подаръчен\s+(?:сет|комплект|ваучер)|(?:като|за|идеален|стилен|персонализиран|ценен|специален)\s+(?:\p{L}+\s+){0,2}подарък|подарък\s+за)(?!\p{L})/iu.test(s.text)) &&
            !negativeClause(s.text) &&
            !/(?:включва|бонус|добавен[ао]?)\s+(?:\p{L}+\s+){0,4}подарък/iu.test(s.text),
        )
        .map((s) => ({ field, ...s })),
  )[0];
  for (const concept of list(p.gift_occasion))
    if (
      taxonomy.occasions.includes(concept) &&
      concept !== "Без конкретен повод"
    ) {
      add(
        "occasion",
        concept,
        "gift_occasion",
        typeof p.gift_occasion === "string" ? p.gift_occasion : list(p.gift_occasion).join(","),
        0,
        {
          status: giftSource ? "approved" : "needs_review",
          rule: "canonical-occasion-plus-independent-gift-purpose",
          support: giftSource
            ? { field: giftSource.field, text: giftSource.text }
            : undefined,
        },
      );
    }
  for (const role of list(p.role_interest))
    if (taxonomy.roles.includes(role))
      add("role", role, "role_interest", typeof p.role_interest === "string" ? p.role_interest : list(p.role_interest).join(","), 0, {
        rule: "canonical-stored-role",
      });
  // An explicit exclusion cannot be neutralized by a positive include mention.
  for (const c of out)
    if (
      c.kind === "contains_item" &&
      c.polarity === "positive" &&
      out.some(
        (n) =>
          n.kind === c.kind &&
          n.concept === c.concept &&
          n.polarity === "negative",
      )
    )
      c.status = "needs_review";
  const ages = out.filter(c => c.kind === "age" && c.age && c.status === "approved");
  if (new Set(ages.map(c => JSON.stringify(c.age))).size > 1)
    for (const c of ages) c.conflict = true;
  const text = [p.name_bg,p.short_desc_bg,p.long_desc_bg].filter(Boolean).join(" ");
  const conditional = /коледн|за учител|за кръщене|за новородено|умалели дрешки/iu.test(text);
  const direct = /картичк\p{L}*\s+за\s+рожден ден/iu.test(text);
  for (const c of out.filter(c => c.kind === "occasion" && c.concept === "Рожден ден"))
    c.birthdayRank = direct ? "direct" : conditional ? "conditional" : "general";
  return out;
}
