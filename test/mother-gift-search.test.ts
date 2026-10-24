import test from "node:test";
import assert from "node:assert/strict";
import { searchHomepage, type SearchCard } from "../src/lib/homepage-search";
const card = (changes: Record<string, string> = {}): SearchCard => ({
  dataset: {
    productSlug: "synthetic",
    productName: "Ваза",
    giftable: "1",
    recipients: "За жена",
    recipientAge: "60",
    priceMin: "10",
    priceMax: "15",
    ...changes,
  },
});
const query = "подарък за майка ми";
const count = (c: SearchCard, q = query, filters = {}) =>
  searchHomepage([c], q, filters).cards.length;
for (const age of ["50", "60", "70", "80"])
  test(`Path A canonical age ${age}`, () =>
    assert.equal(count(card({ recipientAge: age })), 1));
test("A requires both recipient and age; unrelated and missing values fail", () => {
  for (const changes of [
    { recipientAge: "30" },
    { recipientAge: "" },
    { recipients: "" },
    { recipients: "За мъж" },
  ])
    assert.equal(count(card(changes)), 0);
});
test("B permits explicit mother title without age or recipient", () => {
  for (const productName of [
    "Картина МАМО - с послание",
    "Картичка Майко, обичам те",
    "Тениска за мама",
    "Картина МАМА - с 4 снимки",
    "Денят в който стана наша МАЙКА",
  ])
    assert.equal(
      count(card({ productName, recipientAge: "", recipients: "" })),
      1,
      productName,
    );
});
test("B excludes incidental text, substrings and description evidence", () => {
  for (const productName of [
    "Мамалига",
    "Книга за майка Тереза",
    "Майката на всички битки",
    "Роман Мамо, къде си",
  ])
    assert.equal(
      count(
        card({
          productName,
          recipientAge: "",
          recipients: "",
          searchRaw: "подарък за мама",
        }),
      ),
      0,
      productName,
    );
});
test("giftable mandatory for either and both paths", () => {
  for (const giftable of ["0", ""])
    assert.equal(count(card({ productName: "Картина МАМО", giftable })), 0);
});
test("explicit 60: A exact value; B rejects contradictory age but allows absent age without claiming suitability", () => {
  const q = "подарък за мама на 60 години";
  assert.equal(count(card(), q), 1);
  assert.equal(count(card({ recipientAge: "50|70" }), q), 0);
  assert.equal(
    count(card({ productName: "Картина МАМО", recipientAge: "50" }), q),
    0,
  );
  assert.equal(
    count(card({ productName: "Картина МАМО", recipientAge: "" }), q),
    1,
  );
  assert.equal(
    count(card({ productName: "Картина МАМО", recipientAge: "50|60" }), q),
    1,
  );
  assert.equal(
    count(
      card({ productName: "Картина МАМО" }),
      "подарък за мама на 65 години",
    ),
    0,
  );
});
test("non age query B does not require default adult ages", () =>
  assert.equal(
    count(card({ productName: "Картина МАМО", recipientAge: "30" })),
    1,
  ));
test("budget and manual filters remain mandatory", () => {
  const c = card({ productName: "Картина МАМО", materials: "Дърво" });
  assert.equal(count(c, "подарък за мама до 10 евро"), 0);
  assert.equal(count(c, "подарък за мама до 20 евро"), 1);
  assert.equal(count(c, query, { materials: ["Сребро"] }), 0);
});
test("OR eligibility produces one product when both paths match", () =>
  assert.equal(count(card({ productName: "Картина МАМО" })), 1));
