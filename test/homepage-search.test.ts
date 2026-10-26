import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  searchHomepage,
  interpretHomepageQuery,
  homepageEligibility,
  homepageRank,
  matchesHomepageFilters,
  type SearchCard,
} from "../src/lib/homepage-search";
import { legacySearch } from "./fixtures/homepage-search-legacy.mjs";
const dir = "reports/search-audit-2026-10-21/";
const catalog: SearchCard[] = JSON.parse(
  fs.readFileSync(dir + "catalog.json", "utf8"),
);
const baseline = JSON.parse(fs.readFileSync(dir + "results.json", "utf8"));
const fixture = (slug: string, changes: Record<string, string> = {}) => {
  const c = catalog.find((c) => c.dataset.productSlug === slug)!;
  assert.ok(c);
  return { dataset: { ...c.dataset, ...changes } };
};
const silver = "obeci-rouz",
  steel = "obeci-peperudi-on-a-date",
  gold = "zlatni-obetsi-halki-florin-ot-zhalto-zlato-14k-s-tsirkoni",
  shampoo = "tvard-shampoan-s-byal-lupin-kofein-i-konopeno-maslo",
  swimsuit = "banski-cabo-peach-skin-visoka-taliya";
const ids = (r: ReturnType<typeof searchHomepage>) =>
  r.cards.map((c) => c.dataset.productSlug);
test("Stage A: frozen pure legacy extraction matches all 139 ordered lists, scores and fallback flags", () => {
  for (const b of baseline) {
    const r = legacySearch(catalog, b.query);
    assert.deepEqual(
      r.cards.map((c) => c.dataset.productSlug),
      b.allRankedSlugs,
      b.query,
    );
    assert.deepEqual(
      r.cards.slice(0, 10).map((c) => r.score(c)),
      b.top10.map((c) => c.score),
      b.query,
    );
    assert.equal(r.fallback, b.fallback);
  }
});
for (const [label, slug, changes] of [
  ["missing", silver, { materials: "" }],
  ["color-only", silver, { materials: "", colors: "Сребрист" }],
  ["steel", steel, {}],
  ["gold", gold, {}],
] as const)
  test(`M1 / existing probe: ${label} is not silver evidence`, () => {
    const c = fixture(slug, changes);
    const r = searchHomepage([c], "сребърни обеци");
    assert.equal(r.cards.length, 0);
    assert.notEqual(homepageEligibility(c, r.intent).state, "supported");
  });
test("M1: explicit silver supported, blend is allowed but purity is not inferred", () => {
  const c = fixture(silver, { materials: "Сребро|Метал" });
  assert.equal(searchHomepage([c], "сребърни обеци").cards.length, 1);
  const shirt = fixture("lenena-riza-v-zhalt-tsvyat");
  assert.equal(searchHomepage([shirt], "ленена риза").cards.length, 1);
  assert.equal(searchHomepage([shirt], "100% ленена риза").cards.length, 0);
});
test("M2: shampoo description cannot establish table identity", () => {
  const c = fixture(shampoo, {
    searchRaw: "Шампоан за коса. Поставете върху маса.",
  });
  assert.equal(searchHomepage([c], "маса").cards.length, 0);
  assert.equal(searchHomepage([c], "дървена маса").cards.length, 0);
});
test("M2: incompatible structured category defeats incidental product noun", () => {
  assert.equal(
    searchHomepage(
      [
        fixture(swimsuit, {
          searchRaw: "skincare cream face",
          productName: "Бански с skincare принт",
        }),
      ],
      "skincare",
    ).cards.length,
    0,
  );
});
test("M3 / existing probe: empty residual retains actual pajama ranking under reversed discovery order", () => {
  const a = fixture("mazhka-pizhama-off-road", { featuredIndex: "1" }),
    b = fixture("mazhki-domashen-halat", { featuredIndex: "0" });
  const r = searchHomepage([b, a], "мъжка пижама");
  assert.equal(r.intent.residualQuery, "");
  assert.equal(r.cards[0], a);
  assert.ok(homepageRank(a, r.intent).score > homepageRank(b, r.intent).score);
});
test("M3: actual cream title outranks description-only title with same valid taxonomy", () => {
  const a = fixture("krem-s-aloe-vera-za-litse-30-ml", { featuredIndex: "1" }),
    b = fixture("glow-dalboko-hidratirasht-dneven-krem-za-litse", {
      productName: "GLOW",
      featuredIndex: "0",
    });
  assert.equal(searchHomepage([b, a], "крем за лице").cards[0], a);
});
for (const value of ["", "Еко|Веган"])
  test(`M4/M5 / existing probe: natural shampoo ${value || "unknown"} cannot pass either stage`, () => {
    const c = fixture(shampoo, { attributes: value });
    const r = searchHomepage([c], "натурален шампоан");
    assert.equal(r.cards.length, 0);
    assert.equal(r.fallback, false);
    assert.equal(
      homepageEligibility(c, r.intent).state,
      value ? "contradicted" : "unknown",
    );
  });
test("M4: unknown/conflicting occasion never satisfies wedding", () => {
  const slug = "svatben-album-shabby-roses";
  for (const giftOccasions of ["", "Коледа"]) {
    const c = fixture(slug, { giftOccasions });
    assert.equal(searchHomepage([c], "подарък за сватба").cards.length, 0);
  }
  assert.equal(
    searchHomepage([fixture(slug)], "подарък за сватба").cards.length,
    1,
  );
});
test("M5: presence or absence of a primary positive cannot admit unknown/conflicting candidates", () => {
  const yes = fixture(shampoo),
    unknown = fixture(shampoo, {
      productSlug: "fixture-unknown",
      attributes: "",
    }),
    no = fixture(shampoo, {
      productSlug: "fixture-conflict",
      attributes: "Веган",
    });
  assert.deepEqual(
    searchHomepage([yes, unknown, no], "натурален шампоан").cards,
    [yes],
  );
  assert.equal(
    searchHomepage([unknown, no], "натурален шампоан").cards.length,
    0,
  );
  const prefix = searchHomepage(catalog, "Forg");
  assert.ok(prefix.fallback);
  assert.ok(prefix.cards.every((c) => c.dataset.brandName === "Forget Me Not"));
  assert.equal(searchHomepage(catalog, "натурален Forg").cards.length, 0);
});
test("M6: conflicting manual material preserves both constraints", () => {
  assert.equal(
    searchHomepage(catalog, "сребърни обеци", { materials: ["Злато"] }).cards
      .length,
    0,
  );
});
test("M6: gift/recipient/category/price conflicts are intersections", () => {
  assert.equal(
    searchHomepage(catalog, "подарък за жена до 50 евро", {
      gift: ["recipient:За бебе"],
      category: "food_drink",
    }).cards.length,
    0,
  );
  assert.equal(
    searchHomepage(catalog, "сребърни обеци", { category: "cosmetics" }).cards
      .length,
    0,
  );
});
for (const [queries, anchor] of [
  [["обеци", "earrings", "obetsi"], silver],
  [["свещ", "свещите", "svesht"], "neperfektna-svesht"],
  [["сребърни обеци", "srebarni obetsi"], silver],
] as const)
  test(`M7: anchors across ${queries.join("/")}`, () => {
    for (const q of queries) {
      const r = searchHomepage(catalog, q);
      assert.ok(ids(r).includes(anchor), q);
      assert.ok(!ids(r).includes(shampoo));
      if (q.includes("среб") || q.includes("srebar"))
        assert.ok(
          r.cards.every((c) =>
            c.dataset.materials?.split("|").includes("Сребро"),
          ),
        );
    }
  });
test("D2: skincare requires face/body cosmetics; handmade requires canonical evidence", () => {
  const skin = searchHomepage(catalog, "skincare");
  assert.ok(skin.cards.length);
  assert.ok(
    skin.cards.every(
      (c) =>
        c.dataset.publicCategory === "cosmetics" &&
        ["cosmetics_face", "cosmetics_body"].includes(
          c.dataset.publicSubcategory || "",
        ),
    ),
  );
  assert.ok(!ids(skin).includes(swimsuit));
  const hand = searchHomepage(catalog, "handmade");
  assert.ok(hand.cards.length);
  assert.ok(
    hand.cards.every((c) =>
      c.dataset.attributes?.split("|").includes("Ръчна изработка"),
    ),
  );
  assert.equal(
    searchHomepage([fixture(steel, { attributes: "" })], "handmade").cards
      .length,
    0,
  );
  assert.deepEqual(interpretHomepageQuery("clean").attributes, []);
});
test("D3: exact brand names stay top3; DP Silver is a brand, not a silver-material requirement", () => {
  for (const brand of ["Forget Me Not", "DP Silver", "MeriBoo"])
    assert.equal(
      searchHomepage(catalog, brand).cards[0].dataset.brandName,
      brand,
    );
  const d = fixture("tvarda-tanka-grivna-15", { materials: "" });
  assert.equal(searchHomepage([d], "DP Silver").cards.length, 1);
  assert.ok(
    searchHomepage(catalog, "мерибу").cards.every(
      (c) => c.dataset.brandName === "MeriBoo",
    ),
  );
});
test("D3: partial brand competes with legitimate exact product-title match", () => {
  const brand = fixture(steel),
    title = fixture("cherna-roklya", {
      productName: "Forg",
      searchRaw: "Forg Tony Lans",
    });
  const r = searchHomepage([brand, title], "Forg");
  assert.equal(r.cards[0], title);
  assert.ok(r.cards.includes(brand));
});
for (const q of ["подарък за майка ми", "подарък за мама"])
  test(`D4: ${q} requires approved mother evidence AND giftability`, () => {
    const r = searchHomepage(catalog, q);
    assert.ok(r.intent.mother);
    assert.ok(r.cards.length);
    assert.ok(r.cards.every((c) => c.dataset.giftable === "1"));
    assert.equal(searchHomepage([fixture(steel)], q).cards.length, 0);
    const c = r.cards[0];
    assert.equal(
      searchHomepage([{ dataset: { ...c.dataset, recipients: "" } }], q).cards
        .length,
      1,
    );
  });
for (const q of ["нещо за нов дом", "подарък за нов дом"])
  test(`D4: ${q} isolates legacy evidence`, () => {
    const r = searchHomepage(catalog, q);
    assert.ok(r.intent.housewarming);
    assert.deepEqual(r.intent.occasions, []);
    assert.ok(r.cards.length);
    assert.ok(
      r.cards.every(
        (c) =>
          c.dataset.giftable === "1" &&
          c.dataset.giftOccasions?.split("|").includes("Нов дом"),
      ),
    );
    assert.equal(
      searchHomepage([fixture("neperfektna-svesht")], q).cards.length,
      0,
    );
  });
test("D4: truthful evidence gaps for mother and deferred age/skin", () => {
  assert.match(
    searchHomepage([fixture(steel)], "подарък за мама").message,
    /недостатъчно|няма достатъчно/,
  );
  for (const q of ["козметика за суха кожа", "подарък за дете на 3 години"]) {
    const r = searchHomepage(catalog, q);
    assert.equal(r.cards.length, 0);
    assert.ok(r.message);
  }
});
test("D5: unknown maximum is not min-price eligibility, full interval and decimals apply", () => {
  const base = fixture(steel);
  assert.equal(
    searchHomepage(
      [{ dataset: { ...base.dataset, priceMin: "10", priceMax: "" } }],
      "подарък за жена до 50 евро",
    ).cards.length,
    0,
  );
  assert.equal(
    searchHomepage(
      [{ dataset: { ...base.dataset, priceMin: "10", priceMax: "51" } }],
      "подарък за жена до 50 евро",
    ).cards.length,
    0,
  );
  for (const amount of ["49,99", "49.99"])
    assert.equal(
      interpretHomepageQuery(`до ${amount} евро`).maxPriceEur,
      49.99,
    );
});
test("D7: submitted punctuation differs from empty discovery; no arbitrary punctuation results", () => {
  assert.equal(searchHomepage(catalog, "").cards.length, catalog.length);
  for (const q of ["!!!", "[ ]", "?"]) {
    const r = searchHomepage(catalog, q);
    assert.equal(r.cards.length, 0);
    assert.equal(r.intent.mode, "invalid");
    assert.match(r.message, /въведете/);
  }
});
test("Unresolved requirements survive parsing and never receive broad rescue", () => {
  const q = interpretHomepageQuery("сребърни обеци от марсиански метал");
  assert.ok(q.originalQuery);
  assert.ok(q.consumedSpans.length);
  assert.ok(q.unresolvedTerms.includes("marsianski"));
  assert.equal(searchHomepage(catalog, q.originalQuery).cards.length, 0);
  assert.equal(searchHomepage(catalog, "несъществуващпродукт").cards.length, 0);
});
test("Manual filter within/across group semantics remain OR materials/colors, AND attributes/gifts", () => {
  const c = fixture(silver, {
    materials: "Сребро|Метал",
    colors: "Черен|Бял",
    attributes: "Натурален",
    giftable: "1",
    recipients: "За жена",
  });
  assert.ok(
    matchesHomepageFilters(c, {
      materials: ["Злато", "Сребро"],
      colors: ["Червен", "Черен"],
    }),
  );
  assert.ok(!matchesHomepageFilters(c, { attributes: ["Натурален", "Веган"] }));
  assert.ok(
    !matchesHomepageFilters(c, {
      gift: ["recipient:За жена", "occasion:Сватба"],
    }),
  );
});
test("Tied rank uses session index without reordering a revealed prefix", () => {
  const a = fixture(silver, { featuredIndex: "1" }),
    b = fixture(silver, { productSlug: "fixture-second", featuredIndex: "0" });
  const r = searchHomepage([a, b], "обеци");
  assert.deepEqual(r.cards, [b, a]);
  assert.deepEqual(r.cards.slice(0, 1), [b]);
});
test("Multiple explicit contexts, audiences and budgets are never last-write-wins", () => {
  assert.equal(searchHomepage(catalog, "крем за лице за коса").cards.length, 0);
  assert.deepEqual(interpretHomepageQuery("за жена за мъж").audienceKeys, [
    "woman",
    "man",
  ]);
  assert.equal(
    interpretHomepageQuery("подарък до 50 евро до 20 евро").maxPriceEur,
    20,
  );
  assert.ok(
    searchHomepage(catalog, "подарък до 50 евро до 20 евро").cards.every(
      (c) => Number(c.dataset.priceMax) <= 20,
    ),
  );
});
test("Combined taxonomy leaves do not certify a narrower identity without title evidence", () => {
  const gel = catalog.find(
    (c) =>
      c.dataset.productType === "Сапуни и душ гелове" &&
      c.dataset.productName?.includes("Душ гел"),
  )!;
  assert.ok(gel);
  assert.equal(searchHomepage([gel], "сапун").cards.length, 0);
  assert.equal(
    searchHomepage([fixture("mazhki-domashen-halat")], "мъжка пижама").cards
      .length,
    0,
  );
});
test("All 123 exact catalog brands retain every actual brand product", () => {
  for (const brand of new Set(catalog.map((c) => c.dataset.brandName))) {
    const r = searchHomepage(catalog, brand);
    const returned = new Set(ids(r));
    for (const c of catalog.filter((c) => c.dataset.brandName === brand))
      assert.ok(
        returned.has(c.dataset.productSlug),
        `${brand}: ${c.dataset.productSlug}`,
      );
  }
});
