import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalogPriceCsv, planCatalogPriceImport } from "../src/lib/catalog-price-import";

const now = new Date("2026-09-24T10:00:00Z");
const products = [
  { id: 436, name_bg: "Canary", product_url: "https://brand.test/p", currency: "EUR", offer_price_amount: null },
  { id: 500, name_bg: "Untouched", product_url: "https://brand.test/other", currency: "EUR", offer_price_amount: 20, offer_price_currency: "EUR", offer_price_source_url: "https://brand.test/other" },
];

test("catalog price CSV supports the stable ID contract and quoted cells", () => {
  assert.deepEqual(parseCatalogPriceCsv('product_id,exact_price,currency,source_url\n436,"52.90",EUR,https://brand.test/p\n'), [{ product_id: "436", exact_price: "52.90", currency: "EUR", source_url: "https://brand.test/p" }]);
});

test("dry-run plan promotes only explicitly listed product IDs", () => {
  const plan = planCatalogPriceImport("product_id,exact_price,currency\n436,52.90,EUR\n", products, now);
  assert.equal(plan.valid, true); assert.equal(plan.planned.length, 1); assert.equal(plan.planned[0].product_id, 436);
  assert.equal(plan.planned[0].mutation.offer_price_amount, 52.9); assert.equal(plan.planned[0].mutation.offer_price_verified_at, now.toISOString());
  assert.equal(plan.planned.some((item) => item.product_id === 500), false);
});

test("dry-run rejects invalid rows before writes", () => {
  for (const csv of [
    "product_id,exact_price,currency\n436,0,EUR\n",
    "product_id,exact_price,currency\n999,52.90,EUR\n",
    "product_id,exact_price,currency\n436,52.90,USD\n",
    "product_id,exact_price,currency\n436,52.90,EUR\n436,53,EUR\n",
  ]) assert.equal(planCatalogPriceImport(csv, products, now).valid, false);
});

test("range columns cannot be imported as exact catalog prices", () => {
  const plan = planCatalogPriceImport("product_id,price_min_eur,price_max_eur,currency\n436,45,56,EUR\n", products, now);
  assert.equal(plan.valid, false); assert.match(plan.errors[0].error, /exact_price/);
});
