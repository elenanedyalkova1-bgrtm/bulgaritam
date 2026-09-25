import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildDiscountReport } from "../src/lib/price-monitor/index.mjs";

const window = { week_start: "2026-09-21T00:00:00+03:00", week_end: "2026-09-28T00:00:00+03:00" };
const row = (overrides = {}) => ({
  checked_at: "2026-09-25T10:00:00+03:00", product_id: "p1", product_name: "Product", brand: "Brand",
  product_url: "https://brand.test/product", detected_price: 49, currency: "EUR", status: "verified",
  extraction_method: "woocommerce_product_data", confidence: "high", previous_verified_price: 59, difference: -10,
  observation_id: "observation", regular_price: 59, regular_price_currency: "EUR",
  regular_price_method: "woocommerce_del_ins", regular_price_evidence: "{}", ...overrides,
});

test("discount report reuses evaluator output, groups methods, counts eligibility, and sorts deterministically", () => {
  const report = buildDiscountReport([
    row({ product_id: "p2", product_name: "Zulu", brand: "Beta", detected_price: 80, regular_price: 100, previous_verified_price: 80, difference: 0 }),
    row({ product_id: "p1", product_name: "Alpha", brand: "Alpha", detected_price: 50, regular_price: 100, previous_verified_price: 60, difference: -10 }),
    row({ product_id: "p3", product_name: "Old", checked_at: "2026-09-15T10:00:00+03:00", detected_price: 40, regular_price: 50 }),
  ], window);
  assert.deepEqual(report.summary, {
    total_products_evaluated: 3,
    latest_reliable_observation_in_window: 2,
    active_sale_count: 3,
    weekly_discount_eligible_count: 2,
    verified_price_drop_count: 1,
  });
  assert.deepEqual(report.active_sale_methods, [{ extraction_method: "woocommerce_product_data", regular_price_method: "woocommerce_del_ins", count: 3 }]);
  assert.deepEqual(report.eligible_products.map((item) => item.product_id), ["p1", "p2"], "larger discount sorts first");
  assert.equal(typeof report.eligible_products[0].discount_percent, "number");
});

test("report CLI is Google read-only and delegates domain logic", () => {
  const cli = fs.readFileSync("scripts/report-discounts.mjs", "utf8");
  const domain = fs.readFileSync("src/lib/price-monitor/discount-report.mjs", "utf8");
  assert.match(cli, /getValues\("Price History!A2:Q"\)/); assert.match(cli, /buildDiscountReport/);
  assert.match(domain, /evaluateDiscounts/);
  assert.doesNotMatch(cli, /\.append\(|updateValues|batchUpdate|createBaserow|api\.baserow/i);
});
