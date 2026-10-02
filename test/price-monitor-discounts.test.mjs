import assert from "node:assert/strict";
import test from "node:test";
import { evaluateDiscounts, evaluateProductDiscount } from "../src/lib/price-monitor/index.mjs";

const window = { week_start: "2026-09-21T00:00:00Z", week_end: "2026-09-28T00:00:00Z" };
const row = (overrides = {}) => ({
  checked_at: "2026-09-25T10:00:00Z", product_id: "p1", product_name: "Product", brand: "Brand",
  product_url: "https://brand.test/product", detected_price: 49, currency: "EUR", status: "verified",
  extraction_method: "json_ld_product_offer", confidence: "high", previous_verified_price: 49, difference: 0,
  observation_id: "observation", regular_price: null, regular_price_currency: "", regular_price_method: "", regular_price_evidence: "",
  ...overrides,
});

test("A latest explicit pair is an active sale and weekly eligible", () => {
  const result = evaluateProductDiscount([row({ regular_price: 59, regular_price_currency: "EUR", regular_price_method: "json_ld_list_price", regular_price_evidence: '{"path":"offer.list","price_type":"https://schema.org/ListPrice"}' })], window);
  assert.equal(result.active_sale, true); assert.equal(result.weekly_discount_eligible, true);
  assert.deepEqual([result.current_price, result.regular_price, result.discount_amount], [49, 59, 10]);
  assert.ok(Math.abs(result.discount_percent - 16.9492) < 0.0001);
  assert.equal(result.promotion_confidence, "EXPLICIT_SALE");
});

test("B later reliable return to regular price ends active sale", () => {
  const result = evaluateProductDiscount([
    row({ checked_at: "2026-09-22T10:00:00Z", regular_price: 59, regular_price_currency: "EUR" }),
    row({ checked_at: "2026-09-26T10:00:00Z", detected_price: 59, previous_verified_price: 59, difference: 0 }),
  ], window);
  assert.equal(result.active_sale, false); assert.equal(result.weekly_discount_eligible, false);
});

test("C same current price without a fresh explicit pair ends active sale", () => {
  const result = evaluateProductDiscount([
    row({ checked_at: "2026-09-22T10:00:00Z", regular_price: 59, regular_price_currency: "EUR" }),
    row({ checked_at: "2026-09-26T10:00:00Z" }),
  ], window);
  assert.equal(result.active_sale, false); assert.equal(result.weekly_discount_eligible, false);
});

test("D historical reliable 59 to latest 49 is an eligible verified price drop", () => {
  const result = evaluateProductDiscount([
    row({ checked_at: "2026-09-10T10:00:00Z", detected_price: 59, previous_verified_price: 59 }),
    row({ checked_at: "2026-09-25T10:00:00Z", detected_price: 49, previous_verified_price: 59, difference: -10, status: "changed" }),
  ], window);
  assert.equal(result.verified_price_drop, true); assert.equal(result.active_sale, false); assert.equal(result.weekly_discount_eligible, true);
  assert.equal(result.promotion_confidence, "VERIFIED_PRICE_DROP");
  assert.deepEqual([result.regular_price, result.previous_price, result.price_drop_amount], [59, 59, 10]);
});

test("reference-value evidence is classified and fails consumer eligibility closed", () => {
  const result = evaluateProductDiscount([row({ regular_price: 79, regular_price_currency: "EUR", regular_price_method: "json_ld_list_price", regular_price_evidence: '{"price_type":"BundleValue","relationship":"combined component value"}' })], window);
  assert.equal(result.active_sale, true);
  assert.equal(result.promotion_confidence, "REFERENCE_VALUE_SAVING");
  assert.equal(result.promotion_consumer_eligible, false);
  assert.equal(result.weekly_discount_eligible, false);
});

test("unproven regular pair is UNKNOWN and fails closed", () => {
  const result = evaluateProductDiscount([row({ regular_price: 59, regular_price_currency: "EUR", regular_price_method: "generic_pair", regular_price_evidence: "" })], window);
  assert.equal(result.promotion_confidence, "UNKNOWN");
  assert.equal(result.weekly_discount_eligible, false);
});

test("verified history outranks reference-value signals", () => {
  const result = evaluateProductDiscount([
    row({ checked_at: "2026-09-10T10:00:00Z", detected_price: 79 }),
    row({ detected_price: 49, regular_price: 79, regular_price_currency: "EUR", regular_price_method: "reference_value", regular_price_evidence: "combined value" }),
  ], window);
  assert.equal(result.promotion_confidence, "VERIFIED_PRICE_DROP");
  assert.equal(result.weekly_discount_eligible, true);
});

test("E regular price not higher than current is not an active sale", () => {
  const result = evaluateProductDiscount([row({ detected_price: 59, regular_price: 49, regular_price_currency: "EUR" })], window);
  assert.equal(result.active_sale, false);
});

test("F currency mismatch is not an active sale", () => {
  const result = evaluateProductDiscount([row({ regular_price: 59, regular_price_currency: "BGN" })], window);
  assert.equal(result.active_sale, false);
});

test("G unusable latest row cannot create or end the latest reliable sale state", () => {
  const result = evaluateProductDiscount([
    row({ checked_at: "2026-09-24T10:00:00Z", regular_price: 59, regular_price_currency: "EUR" }),
    row({ checked_at: "2026-09-26T10:00:00Z", detected_price: null, status: "ambiguous", confidence: null, regular_price: 99, regular_price_currency: "EUR" }),
  ], window);
  assert.equal(result.active_sale, true); assert.equal(result.latest_checked_at, "2026-09-24T10:00:00Z");
});

test("H active sale outside supplied window is not weekly eligible", () => {
  const result = evaluateProductDiscount([row({ checked_at: "2026-09-19T10:00:00Z", regular_price: 59, regular_price_currency: "EUR" })], window);
  assert.equal(result.active_sale, true); assert.equal(result.weekly_discount_eligible, false);
});

test("I repeated current prices preserve the first observation of one price-drop regime", () => {
  const result = evaluateProductDiscount([
    row({ checked_at: "2026-09-10T10:00:00Z", detected_price: 59, previous_verified_price: 59 }),
    row({ checked_at: "2026-09-20T10:00:00Z", detected_price: 49, previous_verified_price: 59, difference: -10, status: "changed" }),
    row({ checked_at: "2026-09-25T10:00:00Z", detected_price: 49, previous_verified_price: 59, difference: -10, status: "changed" }),
  ], window);
  assert.equal(result.verified_price_drop, true); assert.equal(result.previous_price, 59);
  assert.equal(result.drop_first_seen_at, "2026-09-20T10:00:00Z");
});

test("authoritative baseline alone never proves a historical price drop", () => {
  const result = evaluateProductDiscount([row({ previous_verified_price: 59, difference: -10, status: "changed" })], window);
  assert.equal(result.verified_price_drop, false); assert.equal(result.previous_price, null);
  assert.equal(result.weekly_discount_eligible, false);
});

test("bundle compare-at price fails closed without temporary-sale semantics", () => {
  const result = evaluateProductDiscount([row({ product_name: "Подаръчен комплект", regular_price: 59, regular_price_currency: "EUR", regular_price_method: "shopify_compare_at_price_enrichment", regular_price_evidence: '{"path":"compare_at_price","promotion_semantics":{"product_is_bundle":true,"temporary_sale_signals":[],"reference_value_signals":[]}}' })], window);
  assert.equal(result.active_sale, true); assert.equal(result.promotion_confidence, "UNKNOWN"); assert.equal(result.weekly_discount_eligible, false);
});

test("bundle remains an explicit sale with deterministic temporary-sale evidence", () => {
  const result = evaluateProductDiscount([row({ product_name: "Подаръчен комплект", regular_price: 59, regular_price_currency: "EUR", regular_price_method: "shopify_compare_at_price_enrichment", regular_price_evidence: '{"promotion_semantics":{"product_is_bundle":true,"temporary_sale_signals":["promotional_price_label"],"reference_value_signals":[]}}' })], window);
  assert.equal(result.promotion_confidence, "EXPLICIT_SALE"); assert.equal(result.weekly_discount_eligible, true);
});

test("quantified bundle saving is reference value even when sale labels also exist", () => {
  const result = evaluateProductDiscount([row({ product_name: "Пълен комплект", regular_price: 59, regular_price_currency: "EUR", regular_price_method: "shopify_compare_at_price_enrichment", regular_price_evidence: '{"promotion_semantics":{"product_is_bundle":true,"temporary_sale_signals":["sale_or_discount_label"],"reference_value_signals":["quantified_bundle_saving_claim"]}}' })], window);
  assert.equal(result.promotion_confidence, "REFERENCE_VALUE_SAVING"); assert.equal(result.weekly_discount_eligible, false);
});

test("sub-percent and sub-unit differences are rounding noise, not discounts", () => {
  const explicit = evaluateProductDiscount([row({ detected_price: 69, regular_price: 69.02, regular_price_currency: "EUR", regular_price_method: "woocommerce_del_ins" })], window);
  const historical = evaluateProductDiscount([row({ checked_at: "2026-09-10T10:00:00Z", detected_price: 69.02 }), row({ detected_price: 69 })], window);
  for (const result of [explicit, historical]) {
    assert.equal(result.active_sale, false); assert.equal(result.verified_price_drop, false); assert.equal(result.weekly_discount_eligible, false);
  }
});

test("nearest different reliable price prevents reaching past a later increase", () => {
  const result = evaluateProductDiscount([
    row({ checked_at: "2026-09-01T10:00:00Z", detected_price: 70 }),
    row({ checked_at: "2026-09-10T10:00:00Z", detected_price: 40 }),
    row({ checked_at: "2026-09-25T10:00:00Z", detected_price: 49, previous_verified_price: 49, difference: 0 }),
  ], window);
  assert.equal(result.verified_price_drop, false); assert.equal(result.previous_price, null);
});

test("array rows and multiple products produce numeric sortable output", () => {
  const headers = ["checked_at","product_id","product_name","brand","product_url","detected_price","currency","status","extraction_method","confidence","previous_verified_price","difference","observation_id","regular_price","regular_price_currency","regular_price_method","regular_price_evidence"];
  const one = row({ product_id: "p2", product_name: "B", regular_price: 59, regular_price_currency: "EUR" });
  const two = row({ product_id: "p1", product_name: "A", detected_price: 39, regular_price: 59, regular_price_currency: "EUR" });
  const output = evaluateDiscounts([headers.map((key) => one[key] ?? ""), two], window);
  assert.deepEqual(output.map((item) => item.product_id), ["p1", "p2"]); assert.equal(typeof output[0].discount_percent, "number");
});

test("invalid evaluation window is rejected", () => {
  assert.throws(() => evaluateDiscounts([row()], { week_start: "2026-09-28", week_end: "2026-09-21" }), /valid half-open week window/);
});
