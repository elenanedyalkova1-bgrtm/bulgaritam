import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { compileSearchEvidence } from "../src/lib/search-evidence-build";
import { searchHomepage } from "./fixtures/phase25-search";
import { supportedSourceConcept } from "../src/lib/search-evidence";
const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const old = read(
  "reports/search-discovery-phase2-2026-10-22/evidence-cards.json",
);
const rows = read(
  "reports/search-founder-review-2026-10-21/read-only-catalog-projection.json",
).rows;
function compile(p: any, d: any) {
  return {
    dataset: {
      ...d,
      sourceEvidence: JSON.stringify(compileSearchEvidence(p, d)),
    },
  };
}
const cards = old.map((c: any) => {
  const d = c.dataset,
    r = rows.find((r: any) => r.slug === d.productSlug);
  return compile(
    {
      ...r,
      id: d.productId,
      row_id: r.id,
      materials: (d.materials || "").split("|").filter(Boolean),
    },
    Object.fromEntries(
      Object.entries(d).filter(([k]) => k !== "sourceEvidence"),
    ),
  );
});
const original = (kind: string, changes: any = {}) => {
  const head =
    kind === "dress" ? "Бяла дамска рокля Нова" : "Дамски сребърни обеци Нови";
  const p = {
    id: "never-seen-product",
    row_id: 99999,
    slug: "never-seen-slug",
    name_bg: head,
    short_desc_bg: head + " от нов независим производител.",
    long_desc_bg: head + " с изчистена визия.",
    materials: [],
    product_type: "",
    ...changes,
  };
  const d = {
    productId: p.id,
    productSlug: p.slug,
    productName: p.name_bg,
    productType: p.product_type,
    publicCategory: kind === "dress" ? "clothing" : "accessories",
    publicSubcategory:
      kind === "dress" ? "clothing_women" : "accessories_jewelry",
    materials: p.materials.join("|"),
    brandName: "Never seen brand",
    searchRaw: [p.name_bg, p.short_desc_bg, p.long_desc_bg].join(" "),
    giftable: "0",
    priceMax: "100",
    audience: kind === "dress" ? "Жени" : "Унисекс",
  };
  return { p, d };
};
for (const kind of ["dress", "earrings"])
  test(`new imports activate without ID or slug review: ${kind}`, () => {
    const { p, d } = original(kind),
      c = compile(p, d);
    assert.ok(supportedSourceConcept(c, "identity", kind));
    assert.equal(
      searchHomepage([c], kind === "dress" ? "рокля" : "обеци").cards.length,
      1,
    );
    assert.equal(
      searchHomepage([{ dataset: d }], kind === "dress" ? "рокля" : "обеци")
        .cards.length,
      0,
    );
    assert.ok(
      JSON.parse(c.dataset.sourceEvidence).claims.some(
        (r: any) => r.activation === "automatic",
      ),
    );
  });
for (const label of read(
  "reports/search-discovery-phase2-5-2026-10-22/holdout-labels.json",
))
  test(`independent held-out activation ${label.productId} ${label.concept}`, () => {
    const c = cards.find((c: any) => c.dataset.productId === label.productId);
    const active = JSON.parse(c.dataset.sourceEvidence).claims.some(
      (r: any) =>
        r.kind === label.kind &&
        r.concept === label.concept &&
        r.activation === "automatic",
    );
    assert.equal(active, label.expectedAutomatic);
  });
for (const text of [
  "Не е рокля, а декоративна щампа.",
  "Продуктът е само мотив рокля върху картичка.",
  "Рокля за кукла, а не дреха за жена.",
  "Без включени обеци.",
])
  test(`contradiction in another source field prevents automatic identity: ${text}`, () => {
    const kind = text.includes("обеци") ? "earrings" : "dress";
    const { p, d } = original(kind, { long_desc_bg: text });
    assert.equal(
      supportedSourceConcept(compile(p, d), "identity", kind),
      false,
    );
  });
for (const title of [
  "Корсет FROZEN SHIRT CORSET",
  "Тениска THE WET T-SHIRT",
  "Комплект с рокля",
  "Картичка с обеци",
  "Рокля в комплект с риза",
])
  test(`fashion compound/motif/included identity remains review-required: ${title}`, () => {
    const { p, d } = original("dress", {
      name_bg: title,
      short_desc_bg: title,
    });
    assert.equal(
      supportedSourceConcept(compile(p, d), "identity", "dress"),
      false,
    );
  });
test("identity cannot override wrong taxonomy or contradictory stored type", () => {
  const { p, d } = original("dress");
  for (const change of [
    { publicCategory: "cosmetics" },
    { publicSubcategory: "clothing_men" },
    { productType: "Корсети" },
  ]) {
    const changed = { ...d, ...change };
    const pp = { ...p, product_type: changed.productType };
    assert.equal(
      supportedSourceConcept(compile(pp, changed), "identity", "dress"),
      false,
    );
  }
});
test("automatic identity does not prove silver, giftability, budget or manual type", () => {
  const { p, d } = original("earrings"),
    c = compile(p, d);
  for (const q of ["сребърни обеци", "обеци до 1 евро", "подарък обеци"])
    assert.equal(searchHomepage([c], q).cards.length, 0);
  assert.equal(
    searchHomepage([c], "обеци", { productType: "Обеци" }).cards.length,
    0,
  );
  assert.equal(
    searchHomepage([c], "обеци", { materials: ["Сребро"] }).cards.length,
    0,
  );
});
test("unvalidated composition and identity classes are abstentions, not arbitrary confidence approvals", () => {
  const { p, d } = original("dress", {
    name_bg: "Ленена риза Нова",
    short_desc_bg: "Ленена риза, изработена от 100% лен.",
    long_desc_bg: "Ленена риза, изработена от 100% лен.",
    materials: ["Лен"],
  });
  const c = compile(p, d);
  const claims = JSON.parse(c.dataset.sourceEvidence).claims;
  assert.ok(
    claims.some(
      (c: any) =>
        c.kind === "material" && c.proposedRule && c.status === "needs_review",
    ),
  );
  assert.ok(!claims.some((c: any) => c.activation === "automatic"));
});
test("all 261 results and old score evidence stay exactly unchanged", () => {
  for (const { query } of read(
    "reports/search-discovery-phase2-2026-10-22/query-comparison.json",
  )) {
    const a = searchHomepage(cards, query),
      b = searchHomepage(old, query);
    assert.deepEqual(
      a.cards.map((c: any) => c.dataset.productSlug),
      b.cards.map((c: any) => c.dataset.productSlug),
      query,
    );
    for (const c of a.cards) {
      const prior = old.find(
        (x: any) => x.dataset.productSlug === c.dataset.productSlug,
      );
      assert.deepEqual(a.evidence.get(c), b.evidence.get(prior), query);
    }
  }
});
for (const composition of [
  "Риза, изработена от 100% памук.",
  "Риза от 100% памук.",
  "Риза от 100% органичен памук.",
  "Риза от 100% памучен муселин.",
])
  test(`new import explicit cotton composition: ${composition}`, () => {
    const { p, d } = original("dress", {
      name_bg: "Памучна риза Нова",
      short_desc_bg: composition,
      long_desc_bg: composition,
    });
    const c = compile(p, d);
    assert.ok(supportedSourceConcept(c, "material", "Памук"));
    assert.equal(searchHomepage([c], "памучна риза").cards.length, 1);
    assert.equal(
      searchHomepage([{ dataset: d }], "памучна риза").cards.length,
      0,
    );
    assert.equal(
      searchHomepage([c], "памук", { materials: ["Памук"] }).cards.length,
      0,
    );
  });
for (const text of [
  "Риза от 100% муселин.",
  "Риза от 100% микропамук.",
  "Риза с хастар от 100% памук.",
  "Риза с етикет от 100% памук.",
  "Кутия за риза от 100% памук.",
  "Риза на пране с памук.",
  "Риза, която не е от 100% памук.",
  "Риза от 80% памук и 20% полиестер.",
])
  test(`no automatic composition proof: ${text}`, () => {
    const { p, d } = original("dress", {
      name_bg: "Риза Нова",
      short_desc_bg: text,
      long_desc_bg: text,
    });
    assert.equal(
      supportedSourceConcept(compile(p, d), "material", "Памук"),
      false,
    );
  });
test("contradictory compositions across original fields remain review-required", () => {
  const { p, d } = original("dress", {
    name_bg: "Риза Нова",
    short_desc_bg: "Риза от 100% памук.",
    long_desc_bg: "Риза от 100% полиестер.",
  });
  assert.equal(
    supportedSourceConcept(compile(p, d), "material", "Памук"),
    false,
  );
});
test("aggregate product types never automatically become a whole cotton claim", () => {
  const { p, d } = original("dress", {
    name_bg: "Риза Нова",
    short_desc_bg: "Риза от 100% памук.",
    long_desc_bg: "Риза от 100% памук.",
    product_type: "Комплекти и костюми",
  });
  assert.equal(
    supportedSourceConcept(compile(p, d), "material", "Памук"),
    false,
  );
});
