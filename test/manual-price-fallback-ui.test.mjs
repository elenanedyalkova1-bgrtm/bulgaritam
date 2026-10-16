import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const productPage = await readFile(new URL("../src/pages/p/[slug].astro", import.meta.url), "utf8");
const card = await readFile(new URL("../src/components/HomepageProductCard.astro", import.meta.url), "utf8");
const discounts = await readFile(new URL("../src/lib/price-monitor/discount-evaluator.mjs", import.meta.url), "utf8");

test("product page keeps manual reference separate from Product JSON-LD Offer input", () => {
  assert.match(productPage, /const manualPriceReference = verifiedOffer \? null : resolveManualPriceReference/);
  assert.match(productPage, /verifiedOffer,\s*\n\s*breadcrumbs:/);
  assert.doesNotMatch(productPage, /verifiedOffer:\s*manualPriceReference/);
  assert.match(productPage, /Цената не е потвърдена автоматично/);
});

test("product cards and discount evaluator do not consume manual references", () => {
  assert.doesNotMatch(card, /resolveManualPriceReference|manual_price_/);
  assert.doesNotMatch(discounts, /resolveManualPriceReference|manual_price_/);
});
