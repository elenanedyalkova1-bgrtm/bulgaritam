import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { compileSearchEvidence } from "../src/lib/search-evidence-build";
import {
  sourceEvidence,
  supportedSourceConcept,
} from "../src/lib/search-evidence";
import { searchHomepage } from "./fixtures/phase25-search";
import { searchHomepage as before } from "../reports/search-discovery-phase2-2026-10-22/before-homepage-search";
const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const frozen = read("reports/search-audit-2026-10-21/catalog.json");
const rows = read(
  "reports/search-founder-review-2026-10-21/read-only-catalog-projection.json",
).rows;
const reviews = read("src/lib/search-evidence-reviews.json");
const context = (d: any) =>
  Object.fromEntries(
    [
      "productId",
      "productSlug",
      "productName",
      "productType",
      "publicCategory",
      "publicSubcategory",
      "materials",
    ].map((k) => [k, d[k] || ""]),
  ) as any;
function compile(slug: string, changes: any = {}) {
  const d = frozen.find((c: any) => c.dataset.productSlug === slug).dataset;
  const r = rows.find((r: any) => r.slug === slug);
  const p = {
    ...r,
    id: d.productId,
    row_id: r.id,
    materials: (r.materials || "").split(",").filter(Boolean),
    ...changes,
  };
  const e = compileSearchEvidence(p, context(d));
  return { dataset: { ...d, sourceEvidence: JSON.stringify(e) } };
}
const cards = frozen.map((c: any) => compile(c.dataset.productSlug));
const ids = (cs: any[]) => cs.map((c) => c.dataset.productSlug);
for (const r of reviews.filter((r: any) => r.status === "approved"))
  test(`reviewed ${r.kind} recovery ${r.productId} / ${r.rowId}`, () => {
    const c = compile(r.slug);
    assert.ok(supportedSourceConcept(c, r.kind, r.concept));
    const q =
      r.kind === "material"
        ? r.concept
        : { shirt: "детска риза", book: "книга", cream: "крем за лице" }[
            r.concept
          ];
    assert.ok(searchHomepage([c], q).cards.includes(c));
    for (const claim of sourceEvidence(c).filter(
      (e) => e.status === "approved",
    )) {
      const row = rows.find((r: any) => r.slug === c.dataset.productSlug);
      assert.equal(
        row[claim.field].slice(claim.start, claim.start + claim.text.length),
        claim.text,
      );
      assert.equal(claim.version, "source-evidence-v1");
    }
  });
for (const r of reviews.filter(
  (r: any) => r.kind === "material" && r.status !== "approved",
))
  test(`no unsupported material proof: ${r.productId} ${r.classification}`, () =>
    assert.equal(
      supportedSourceConcept(compile(r.slug), "material", r.concept),
      false,
    ));
for (const r of reviews.filter(
  (r: any) => r.kind === "identity" && r.status !== "approved",
))
  test(`not a main identity: ${r.productId} ${r.classification}`, () =>
    assert.equal(
      supportedSourceConcept(compile(r.slug), "identity", r.concept),
      false,
    ));
for (const text of [
  "Изработен е от муселин.",
  "Пере се на програма за вълна.",
  "Чаша с кутия от дърво.",
  "Картина семейно дърво.",
  "Халат Сребърна от памук.",
  "Колие с кожена каишка.",
  "Памучна кутия; продуктът е от 100% полиестер.",
  "Продуктът не е от памук.",
  "Кройка вдъхновена от риза.",
])
  test(`unreviewed descriptions cannot silently add verified claims: ${text}`, () => {
    const c = compile("rezeda-mazhka-bluza-morado-basic", {
      short_desc_bg: text,
      long_desc_bg: text,
    });
    assert.equal(
      sourceEvidence(c).filter((e) => e.status === "approved").length,
      0,
    );
    assert.equal(searchHomepage([c], "памук").cards.length, 0);
  });
test("changing one original field invalidates source review; raw text is not an original field", () => {
  const c = compile("rezeda-mazhka-bluza-morado-basic", {
    short_desc_bg: "Нов непроверен състав",
  });
  assert.equal(supportedSourceConcept(c, "material", "Памук"), false);
  assert.equal(
    supportedSourceConcept(
      { dataset: { ...c.dataset, searchRaw: "100% памук" } },
      "material",
      "Памук",
    ),
    false,
  );
});
test("unreviewed lookalike gets a candidate, never an approved product-specific override", () => {
  const c = compile("detska-severnyashka-riza", {
    id: "new-product",
    slug: "new-shirt",
  });
  assert.ok(
    JSON.parse(c.dataset.sourceEvidence).claims.some(
      (e: any) => e.kind === "identity" && e.status === "needs_review",
    ),
  );
  assert.equal(supportedSourceConcept(c, "identity", "shirt"), false);
});
test("serialization binding prevents stale or cross-product evidence", () => {
  const c = compile("detska-severnyashka-riza");
  for (const [key, value] of [
    ["productId", "other"],
    ["publicCategory", "cosmetics"],
    ["productType", "Корсети"],
    ["materials", "Полиестер"],
  ])
    assert.equal(
      sourceEvidence({ dataset: { ...c.dataset, [key]: value } }).length,
      0,
    );
  assert.equal(
    sourceEvidence({ dataset: { sourceEvidence: "{broken" } }).length,
    0,
  );
});
test("component cotton remains scoped and does not create a whole-set purity claim or new item identity", () => {
  const c = compile("komplekt-sunny-days-ot-100-organichen-muselin");
  assert.ok(
    sourceEvidence(c).some(
      (e) =>
        e.concept === "Памук" &&
        e.status === "approved" &&
        e.scope === "component",
    ),
  );
  assert.ok(searchHomepage([c], "памук").cards.length);
  assert.equal(searchHomepage([c], "100% памук").cards.length, 0);
  assert.equal(searchHomepage([c], "тениска").cards.length, 0);
});
test("generic silver never establishes 925 or standalone included earrings", () => {
  for (const slug of [
    "damski-srebaren-komplekt-arc",
    "srebaren-komplekt-rayska-perla",
  ]) {
    const c = compile(slug);
    assert.ok(searchHomepage([c], "сребро").cards.length);
    assert.equal(searchHomepage([c], "сребро 925").cards.length, 0);
    assert.equal(searchHomepage([c], "сребърни обеци").cards.length, 0);
  }
});
test("legacy conflicts remain surfaced and stored matches remain eligible", () => {
  for (const [slug, material] of [
    ["rozova-svobodna-riza-s-printove", "Лен"],
    ["halat-namaste", "Сребро"],
  ]) {
    const c = compile(slug);
    assert.ok(sourceEvidence(c).some((e) => e.status === "conflict"));
    assert.equal(searchHomepage([c], material).cards.length, 1);
  }
});
test("source evidence cannot bypass manual filters, price, audience, giftability or mother age policy", () => {
  const c = compile("detska-severnyashka-riza");
  for (const filters of [
    { category: "clothing" },
    { productType: "Ризи" },
    { materials: ["Лен"] },
  ])
    assert.equal(searchHomepage([c], "риза", filters).cards.length, 0);
  assert.equal(searchHomepage([c], "риза до 1 евро").cards.length, 0);
  assert.equal(searchHomepage([c], "мъжка риза").cards.length, 0);
  assert.equal(
    searchHomepage([c], "риза подарък за мама на 60 години").cards.length,
    0,
  );
  const noGift = { dataset: { ...c.dataset, giftable: "0" } };
  assert.equal(searchHomepage([noGift], "подарък риза").cards.length, 0);
  const cotton = compile("rezeda-mazhka-bluza-morado-basic");
  assert.equal(
    searchHomepage([cotton], "памук", { materials: ["Памук"] }).cards.length,
    0,
  );
});
test("broad protected intents have identical membership, ordering and evidence", () => {
  for (const q of [
    "skincare",
    "handmade",
    "ръчна изработка",
    "нещо за нов дом",
    "подарък за майка ми",
    "подарък за мама на 60 години",
  ]) {
    const a = searchHomepage(cards, q),
      b = before(frozen, q);
    assert.deepEqual(ids(a.cards), ids(b.cards), q);
    for (const c of a.cards) {
      const old = frozen.find(
        (x: any) => x.dataset.productSlug === c.dataset.productSlug,
      );
      assert.deepEqual(a.evidence.get(c), b.evidence.get(old));
    }
  }
});
test("entire extended Phase 1 corpus loses no result and preserves relative old ranking", () => {
  for (const { query } of read(
    "reports/search-discovery-phase1-2026-10-22/query-comparison.json",
  )) {
    const b = ids(before(frozen, query).cards),
      a = ids(searchHomepage(cards, query).cards);
    assert.deepEqual(
      a.filter((s) => b.includes(s)),
      b,
      query,
    );
  }
});
test("negative material statements have explicit polarity and exact source span", () => {
  const c = compile("rezeda-mazhka-bluza-morado-basic", {
    short_desc_bg: "Продуктът не съдържа памук.",
    long_desc_bg: "",
  });
  const claim = JSON.parse(c.dataset.sourceEvidence).claims.find(
    (e: any) => e.concept === "Памук",
  );
  assert.equal(claim.polarity, "negative");
  assert.equal(claim.status, "needs_review");
  assert.equal(supportedSourceConcept(c, "material", "Памук"), false);
});
test("changed conflict source invalidates legacy review rather than inventing a new conflict", () => {
  const c = compile("rozova-svobodna-riza-s-printove", {
    long_desc_bg: "Ново описание, очакващо review.",
  });
  assert.ok(!sourceEvidence(c).some((e) => e.status === "conflict"));
});
