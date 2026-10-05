import test from "node:test";
import assert from "node:assert/strict";
import { buildRecommendationPlan, getRecommendationPlan } from "../src/lib/product-recommendations";
import type { Product } from "../src/lib/products";

const p = (slug: string, brand = "a", extra = {}) => ({ slug, id: slug, row_id: slug, brand_slug: brand, product_type: "", tags: [], ...extra } as unknown as Product);
const taxonomy = (p: Product) => ({ categoryKeys: (p as any).cats || [], subcategoryKeys: (p as any).subs || [] });
const plan = (ps: Product[]) => buildRecommendationPlan(ps, taxonomy);
const serialize = (result: ReturnType<typeof plan>) => [...result].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, value.sameBrand.map(p => p.slug), value.related.map(p => p.slug)]);

test("identical inputs, reversed catalogue and repeated allocation give identical plans", () => {
  const ps = Array.from({ length: 24 }, (_, i) => p(`p${i}`, `brand${i % 3}`, { cats: ["clothing", "gifts"], tags: ["linen"] }));
  const first = serialize(plan(ps));
  assert.deepEqual(serialize(plan([...ps].reverse())), first);
  plan([p("other")]);
  assert.deepEqual(serialize(plan(ps)), first);
});
test("same-brand ordering prefers type, then non-gift subcategory, category, brand", () => {
  const source = p("source", "a", { product_type: "shirt", cats: ["clothing", "gifts"], subs: ["clothing_women", "gifts_for_her"] });
  const candidates = [p("fallback"), p("category", "a", { cats: ["clothing"] }), p("subcategory", "a", { subs: ["clothing_women"] }), p("type", "a", { product_type: "shirt" })];
  assert.deepEqual(plan([source, ...candidates]).get("source")!.sameBrand.map(p => p.slug), ["type", "subcategory", "category", "fallback"]);
});
test("cross-brand gifts-only and gift-subcategory-only matches are rejected", () => {
  const ps = [p("one", "a", { cats: ["gifts"], subs: ["gifts_for_her"] }), p("two", "b", { cats: ["gifts"], subs: ["gifts_for_her"] })];
  assert.equal(plan(ps).get("one")!.related.length, 0);
});
test("meaningful type, category, subcategory and tag relationships pass the positive-score gate", () => {
  for (const relationship of [{ product_type: "shirt" }, { cats: ["gifts", "clothing"] }, { subs: ["clothing_women"] }, { tags: ["linen"] }]) {
    const result = plan([p("one", "a", { cats: ["gifts"], ...relationship }), p("two", "b", { cats: ["gifts"], ...relationship })]);
    assert.equal(result.get("one")!.related[0]?.slug, "two");
  }
  assert.equal(plan([p("one", "a", { product_type: "shirt" }), p("two", "b", { product_type: "shirt" })]).get("one")!.related.length, 0);
});
test("cross-brand score wins over exposure and lower-scoring candidates", () => {
  const source = p("source", "a", { cats: ["clothing"], tags: ["linen", "blue"] });
  const ps = [source, ...Array.from({ length: 8 }, (_, i) => p(`low${i}`, "b", { cats: ["clothing"] })), p("best", "b", { cats: ["clothing"], tags: ["linen", "blue"] })];
  assert.equal(plan(ps).get("source")!.related[0].slug, "best");
});
test("equal relevance spreads exposure without self-links or duplicate block entries", () => {
  const ps = Array.from({ length: 30 }, (_, i) => p(`p${i}`, "a"));
  const result = plan(ps), counts = new Map(ps.map(p => [p.slug, 0]));
  for (const [slug, blocks] of result) for (const block of Object.values(blocks)) {
    assert.ok(block.length <= 4);
    assert.equal(new Set(block.map(p => p.slug)).size, block.length);
    assert.ok(block.every(p => p.slug !== slug));
    for (const product of block) counts.set(product.slug, counts.get(product.slug)! + 1);
  }
  assert.ok(Math.min(...counts.values()) >= 3);
  assert.ok(Math.max(...counts.values()) <= 5);
});
test("insufficient relevance leaves fewer than four cards and singleton brand empty", () => {
  const result = plan([p("source", "a", { tags: ["linen"] }), p("match", "b", { tags: ["linen"] }), p("unrelated", "c")]).get("source")!;
  assert.equal(result.sameBrand.length, 0);
  assert.deepEqual(result.related.map(p => p.slug), ["match"]);
});
test("cached catalogue plan is reused without allocation during page access", () => {
  const ps: Product[] = [];
  assert.equal(getRecommendationPlan(ps), getRecommendationPlan(ps));
  assert.notEqual(getRecommendationPlan([]), getRecommendationPlan(ps));
});

test("duplicate catalogue URLs allocate once and choose the same stable record regardless of order", () => {
  const ps = [p("one", "a", { row_id: 1 }), p("two", "a", { row_id: 2 }), p("two", "a", { row_id: 3 })];
  const result = plan(ps);
  assert.equal(result.size, 2);
  assert.equal(result.get("one")!.sameBrand.length, 1);
  assert.equal(result.get("one")!.sameBrand[0].row_id, 2);
  assert.deepEqual(serialize(plan([...ps].reverse())), serialize(result));
});
