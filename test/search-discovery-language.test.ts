import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  searchHomepage,
  interpretHomepageQuery,
  type SearchCard,
} from "./fixtures/phase25-search";
import { searchHomepage as before } from "../reports/search-discovery-phase1-2026-10-22/before-homepage-search";
const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const cards: SearchCard[] = read(
  "reports/search-audit-2026-10-21/catalog.json",
);
const ids = (cs: SearchCard[]) => cs.map((c) => c.dataset.productSlug).sort();
const result = (q: string) => searchHomepage(cards, q).cards;
const observations = read(
  "reports/search-discovery-audit-2026-10-21/normalization-and-evidence-test-proposals.json",
);
for (const o of observations) {
  if (o.kind === "positive-equivalence" && o.query !== "sterling silver")
    test(`audited linguistic membership: ${o.query}`, () =>
      assert.deepEqual(ids(result(o.query)), ids(result(o.anchor))));
  else
    test(`deferred evidence/context behavior preserved: ${o.query}`, () =>
      assert.deepEqual(
        searchHomepage(cards, o.query).cards,
        before(cards, o.query).cards,
      ));
}
for (const [q, anchor] of [
  ["ленената риза", "ленена риза"],
  ["памучната тениска", "памучна тениска"],
  ["ceramic mug", "керамична чаша"],
  ["керамичният", "керамика"],
  ["лененото", "лен"],
  ["памучният", "памук"],
  ["дървеното", "дърво"],
  ["вълненото", "вълна"],
  ["обецата", "обеци"],
  ["обицата", "обеци"],
])
  test(`additional curated form: ${q}`, () =>
    assert.deepEqual(ids(result(q)), ids(result(anchor))));
test("all original 139 ordered results and score evidence are unchanged", () => {
  for (const { query } of read(
    "reports/search-audit-2026-10-21/results.json",
  )) {
    const b = before(cards, query),
      a = searchHomepage(cards, query);
    assert.deepEqual(a.cards, b.cards, query);
    for (const c of a.cards)
      assert.deepEqual(a.evidence.get(c), b.evidence.get(c), query);
  }
});
for (const q of [
  "кожа",
  "веган кожа",
  "естествена кожа",
  "вълна",
  "вълни",
  "сребърната",
  "sterling silver",
  "silver 925",
  "сребро 925",
  "Халат за баня CYXO Сребърна – розов",
  "handmade",
  "ръчна изработка",
  "skincare",
  "нещо за нов дом",
  "подарък за мама на 60 години",
])
  test(`protected existing interpretation: ${q}`, () =>
    assert.deepEqual(searchHomepage(cards, q).cards, before(cards, q).cards));
for (const q of [
  "обе",
  "обецй",
  "рокл",
  "риз",
  "еленената",
  "вълнист",
  "nesrebyrni obeci",
  "керамичност",
])
  test(`no unrestricted stem/prefix/substring: ${q}`, () =>
    assert.deepEqual(searchHomepage(cards, q).cards, before(cards, q).cards));
test("exact catalog brands retain precedence over new aliases", () => {
  for (const name of ["Obeci", "Ceramic", "Ленената", "Srebyrni"]) {
    const intent = interpretHomepageQuery(name, [name]);
    assert.equal(intent.brandQuery, name);
    assert.deepEqual(intent.materials, []);
    assert.deepEqual(intent.identities, []);
  }
});
test("new ceramic aliases require actual material; incidental and missing evidence cannot prove it", () => {
  const base = cards.find((c) =>
    c.dataset.materials?.split("|").includes("Керамика"),
  )!;
  assert.ok(base);
  for (const materials of ["", "Стъкло", "Хартия"]) {
    const c = {
      dataset: {
        ...base.dataset,
        materials,
        productName: "Чаша в керамична кутия",
        searchRaw: "Чаша не е керамична; керамична кутия",
      },
    };
    assert.equal(searchHomepage([c], "ceramic mug").cards.length, 0);
  }
});
test("new morphology does not turn unknown materials into verified materials", () => {
  const c = cards.find((c) => result("ленена риза").includes(c))!;
  assert.equal(
    searchHomepage(
      [{ dataset: { ...c.dataset, materials: "" } }],
      "ленената риза",
    ).cards.length,
    0,
  );
  const muslin = { dataset: { ...c.dataset, materials: "Муселин" } };
  assert.equal(searchHomepage([muslin], "памучната риза").cards.length, 0);
});
test("silver aliases do not include gold/steel, silver-colored or cotton model names", () => {
  const e = result("сребърни обеци")[0];
  for (const materials of ["Злато", "Неръждаема стомана", "Памук", ""])
    assert.equal(
      searchHomepage(
        [
          {
            dataset: {
              ...e.dataset,
              materials,
              productName: "Обеци със сребърен цвят",
            },
          },
        ],
        "srebyrni obeci",
      ).cards.length,
      0,
    );
  assert.ok(
    !result("srebyrni obeci").some(
      (c) => c.dataset.productSlug === "halat-za-banya-cyxo-srebarna-rozov",
    ),
  );
});
test("budget, audience, giftability and manual facets remain strict for recovered queries", () => {
  const c = result("ленената риза")[0];
  for (const [q, change] of [
    ["ленената риза до 1 евро", {}],
    ["мъжка ленената риза", { audience: "women" }],
    ["подарък ленената риза", { giftable: "0" }],
  ] as [string, Record<string, string>][])
    assert.equal(
      searchHomepage([{ dataset: { ...c.dataset, ...change } }], q).cards
        .length,
      0,
    );
  for (const filters of [
    { category: "cosmetics" },
    { materials: ["Злато"] },
    { productType: "Обеци" },
  ])
    assert.equal(
      searchHomepage(cards, "ленената риза", filters).cards.length,
      0,
    );
});
