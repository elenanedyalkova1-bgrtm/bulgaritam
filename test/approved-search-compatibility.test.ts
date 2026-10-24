import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  searchHomepage,
  homepageEligibility,
  type SearchCard,
} from "../src/lib/homepage-search";
import {
  searchHomepage as beforeSearch,
  homepageEligibility as beforeEligibility,
} from "../reports/search-approved-changes-2026-10-21/before-homepage-search";
const cards: SearchCard[] = JSON.parse(
  fs.readFileSync("reports/search-audit-2026-10-21/catalog.json", "utf8"),
);
const ids = (xs: SearchCard[]) => xs.map((c) => c.dataset.productSlug);
const fixture = (slug: string, changes: Record<string, string> = {}) => {
  const c = cards.find((c) => c.dataset.productSlug === slug);
  assert.ok(c);
  return { dataset: { ...c.dataset, ...changes } };
};
const soap = "sapun-bebcho",
  bio = "bio-sapun-za-detsa-i-bebeta",
  dress = "damska-cherna-tenis-roklya";
for (const [q, expected] of [
  ["сапун", [soap, bio]],
  ["черна рокля", [dress]],
  ["рокля", [dress]],
  ["дамска рокля", [dress]],
] as const)
  test(`reviewed compatibility adds only verified products: ${q}`, () => {
    const b = beforeSearch(cards, q).cards,
      a = searchHomepage(cards, q).cards;
    assert.deepEqual(ids(a.slice(0, b.length)), ids(b));
    assert.deepEqual(ids(a.slice(b.length)), [...expected]);
    assert.equal(new Set(ids(a)).size, a.length);
  });
test("same title and taxonomy on an unreviewed product do not establish compatibility", () => {
  for (const [slug, q] of [
    [soap, "сапун"],
    [bio, "soap"],
    [dress, "рокля"],
  ])
    assert.equal(
      searchHomepage(
        [fixture(slug, { productSlug: "unreviewed-lookalike" })],
        q,
      ).cards.length,
      0,
    );
});
test("reviewed identity does not override changed taxonomy or unrelated product titles", () => {
  for (const [slug, q, changes] of [
    [soap, "сапун", { productType: "Кремове и балсами за бебе" }],
    [soap, "сапун", { publicCategory: "cosmetics" }],
    [soap, "сапун", { publicSubcategory: "kids_textiles" }],
    [soap, "сапун", { productName: "Кутия за сапун" }],
    [soap, "сапун", { productName: "Душ гел" }],
    [dress, "рокля", { publicCategory: "sport" }],
    [dress, "рокля", { publicSubcategory: "clothing_men" }],
    [dress, "рокля", { productName: "Спортен екип с щампа рокля" }],
  ] as [string, string, Record<string, string>][])
    assert.equal(
      searchHomepage([fixture(slug, changes)], q).cards.length,
      0,
      JSON.stringify(changes),
    );
});
for (const [q, filters] of [
  ["сапун", { category: "cosmetics" }],
  ["сапун", { productType: "Сапуни и душ гелове" }],
  ["сапун", { materials: ["Сребро"] }],
  ["сапун", { attributes: ["Ръчна изработка"] }],
  ["сапун", { colors: ["Черен"] }],
  ["черна рокля", { category: "kids" }],
  ["черна рокля", { productType: "Рокли" }],
  ["черна рокля", { subcategory: "clothing_men" }],
] as const)
  test(`manual constraints stay strict: ${q} ${JSON.stringify(filters)}`, () => {
    const input = [fixture(soap), fixture(bio), fixture(dress)];
    assert.equal(searchHomepage(input, q, filters as any).cards.length, 0);
  });
test("manual kids filter permits reviewed baby soaps without admitting adult soaps", () => {
  assert.deepEqual(
    ids(searchHomepage(cards, "сапун", { category: "kids" }).cards),
    [soap, bio],
  );
});
test("explicit material, audience, price and giftability stay mandatory", () => {
  for (const q of ["сребърна рокля", "мъжка рокля", "черна рокля до 50 евро"])
    assert.equal(searchHomepage([fixture(dress)], q).cards.length, 0, q);
  assert.equal(
    searchHomepage([fixture(dress, { audience: "" })], "дамска рокля").cards
      .length,
    0,
  );
  assert.equal(
    searchHomepage([fixture(soap), fixture(bio)], "подарък сапун").cards.length,
    0,
  );
  assert.equal(
    searchHomepage([fixture(dress, { giftable: "0" })], "подарък рокля").cards
      .length,
    0,
  );
  assert.equal(
    searchHomepage([fixture(dress, { priceMax: "" })], "рокля до 100 евро")
      .cards.length,
    0,
  );
});
test("mother age and OR policy are not bypassed by identity compatibility", () => {
  const c = fixture(dress, {
    recipients: "За жена",
    recipientAge: "20|25|30|35",
  });
  assert.equal(
    searchHomepage([c], "рокля подарък за мама на 60 години").cards.length,
    0,
  );
  assert.equal(
    searchHomepage(
      [fixture(dress, { recipientAge: "60" })],
      "рокля подарък за мама на 60 години",
    ).cards.length,
    1,
  );
  assert.equal(
    searchHomepage(
      [fixture(dress, { recipientAge: "60", giftable: "0" })],
      "рокля подарък за мама на 60 години",
    ).cards.length,
    0,
  );
});
test("housewarming changes only ordering: same 26 eligible, all eligibility evidence unchanged", () => {
  const q = "нещо за нов дом",
    b = beforeSearch(cards, q),
    a = searchHomepage(cards, q);
  assert.equal(a.cards.length, 26);
  assert.deepEqual([...ids(a.cards)].sort(), [...ids(b.cards)].sort());
  for (const c of cards)
    assert.deepEqual(
      homepageEligibility(c, a.intent),
      beforeEligibility(c, b.intent),
    );
  const proposed = JSON.parse(
    fs.readFileSync(
      "reports/search-founder-review-2026-10-21/ranking-scenarios.json",
      "utf8",
    ),
  ).find((x: any) => x.name === "housewarming ranking only");
  assert.deepEqual(ids(a.cards), proposed.after);
  assert.equal(ids(a.cards).indexOf("srebarna-lazhichka-vetrilo-1223l"), 24);
  assert.equal(ids(a.cards).indexOf("srebarna-vilichka"), 25);
});
test("housewarming explicit baby intent preserves former ordering", () => {
  const q = "подарък за нов дом за бебе",
    a = searchHomepage(cards, q),
    b = beforeSearch(cards, q);
  assert.ok(a.cards.length);
  assert.deepEqual(ids(a.cards), ids(b.cards));
});
test("housewarming constraints and manual filters change neither eligibility nor explicit limits", () => {
  for (const [q, f] of [
    ["подарък за нов дом до 50 евро", {}],
    ["нещо за нов дом", { materials: ["Сребро"] }],
    ["нещо за нов дом", { category: "books" }],
    ["нещо за нов дом", { gift: ["recipient:За бебе"] }],
  ] as const) {
    const a = searchHomepage(cards, q, f as any),
      b = beforeSearch(cards, q, f as any);
    assert.deepEqual([...ids(a.cards)].sort(), [...ids(b.cards)].sort());
  }
  assert.equal(
    searchHomepage(
      [fixture("srebarna-vilichka", { giftable: "0" })],
      "нещо за нов дом",
    ).cards.length,
    0,
  );
});
test("unrelated 139-query behavior unchanged except approved additions and housewarming order", () => {
  const qs = JSON.parse(
    fs.readFileSync("reports/search-audit-2026-10-21/results.json", "utf8"),
  );
  const proposed = JSON.parse(
    fs.readFileSync(
      "reports/search-founder-review-2026-10-21/cross-category-139-replay.json",
      "utf8",
    ),
  );
  let additions = 0,
    rankingOnly = 0;
  for (const { query } of qs) {
    const b = beforeSearch(cards, query),
      a = searchHomepage(cards, query);
    assert.ok(
      b.cards.every((c) => a.cards.includes(c)),
      query,
    );
    const expected = proposed.find((r: any) => r.query === query);
    if (expected.added.length) {
      assert.deepEqual(ids(a.cards), expected.after);
      additions++;
    } else if (a.intent.housewarming) {
      assert.deepEqual([...ids(a.cards)].sort(), [...ids(b.cards)].sort());
      if (JSON.stringify(ids(a.cards)) !== JSON.stringify(ids(b.cards)))
        rankingOnly++;
    } else {
      assert.deepEqual(ids(a.cards), ids(b.cards), query);
      for (const c of a.cards)
        assert.deepEqual(a.evidence.get(c), b.evidence.get(c), query);
    }
  }
  assert.equal(additions, 10);
  assert.equal(rankingOnly, 1);
});
