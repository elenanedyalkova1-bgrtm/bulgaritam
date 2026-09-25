import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import type { Product } from "../src/lib/products";
import {
  formatDiscountMoney,
  getSofiaWeekWindow,
  joinWeeklyDiscountProducts,
  loadWeeklyDiscountProducts,
} from "../src/lib/weekly-discounts";
import { combineStructuredFacets, discountFacetCounts, filterDiscountItems, priceBucketFor, sortDiscountItems } from "../src/lib/weekly-discount-ui";

const product = (row_id: number, overrides: Partial<Product> = {}) => ({
  row_id, id: `catalog-${row_id}`, name_bg: `Продукт ${row_id}`, brand_name: "Бранд", slug: `product-${row_id}`,
  image_urls: [`/product-${row_id}.jpg`], is_active: true, price_min_eur: 1, price_max_eur: 999,
  ...overrides,
} as Product);
const discount = (product_id: string, overrides: Record<string, unknown> = {}) => ({
  product_id, product_name: `History ${product_id}`, brand: "History Brand", product_url: "https://brand.test/p",
  weekly_discount_eligible: true, current_price: 49, regular_price: 59, currency: "EUR",
  discount_amount: 10, discount_percent: 16.9492, latest_checked_at: "2026-09-25T10:00:00Z",
  confidence: "high", extraction_method: "json_ld_product_offer", regular_price_method: "json_ld_list_price",
  ...overrides,
});

test("Europe/Sofia normal week starts Monday local midnight and ends next Monday local midnight", () => {
  assert.deepEqual(getSofiaWeekWindow(new Date("2026-09-25T12:00:00Z")), {
    week_start: "2026-09-20T21:00:00.000Z",
    week_end: "2026-09-27T21:00:00.000Z",
  });
});

test("Europe/Sofia DST transition resolves both Monday boundaries independently", () => {
  const window = getSofiaWeekWindow(new Date("2026-03-29T12:00:00Z"));
  assert.deepEqual(window, {
    week_start: "2026-03-22T22:00:00.000Z",
    week_end: "2026-03-29T21:00:00.000Z",
  });
  assert.equal((Date.parse(window.week_end) - Date.parse(window.week_start)) / 3_600_000, 167);
});

test("join uses Product.row_id, excludes missing and ineligible products, and ignores catalog ranges", () => {
  const catalog = [product(7, { id: "not-seven", price_min_eur: 500, price_max_eur: 900 })];
  const joined = joinWeeklyDiscountProducts([
    discount("7"),
    discount("not-seven"),
    discount("8"),
    discount("7", { weekly_discount_eligible: false, discount_percent: 99 }),
  ] as any, catalog);
  assert.equal(joined.length, 1);
  assert.equal(joined[0].product.row_id, 7);
  assert.deepEqual([joined[0].current_price, joined[0].regular_price], [49, 59]);
});

test("discount sorting is percentage descending with deterministic brand name and row-id ties", () => {
  const catalog = [
    product(3, { brand_name: "Бета", name_bg: "Я" }),
    product(2, { brand_name: "Алфа", name_bg: "Б" }),
    product(1, { brand_name: "Алфа", name_bg: "А" }),
    product(4, { brand_name: "Алфа", name_bg: "А" }),
  ];
  const rows = [discount("3", { discount_percent: 30 }), discount("2", { discount_percent: 20 }), discount("4", { discount_percent: 20 }), discount("1", { discount_percent: 20 })];
  assert.deepEqual(joinWeeklyDiscountProducts(rows as any, catalog).map((entry) => entry.product.row_id), [3, 1, 4, 2]);
});

test("zero eligible products is valid page data", async () => {
  const result = await loadWeeklyDiscountProducts(new Date("2026-09-25T12:00:00Z"), {
    readHistory: async () => [], loadCatalog: async () => [product(1)], evaluate: () => [],
  });
  assert.deepEqual(result.products, []);
});

test("Sheets read/auth failure propagates and cannot become an empty state", async () => {
  await assert.rejects(() => loadWeeklyDiscountProducts(new Date("2026-09-25T12:00:00Z"), {
    readHistory: async () => { throw new Error("Google Sheets denied"); }, loadCatalog: async () => [],
  }), /Google Sheets denied/);
});

test("discount money follows Bulgarian EUR formatting", () => {
  assert.match(formatDiscountMoney(49, "EUR"), /49,00\s*€/);
});

test("HomepageProductCard keeps normal price fallback and uses evaluator prices only in optional discount mode", () => {
  const source = fs.readFileSync("src/components/HomepageProductCard.astro", "utf8");
  assert.match(source, /discount\?: WeeklyDiscountProduct/);
  assert.match(source, /discount \? null : resolvePublishableOffer/);
  assert.match(source, /discount \? formatDiscountMoney\(Number\(discount\.current_price\)/);
  assert.match(source, /discountRegularPrice/);
  assert.match(source, /p\.price_min_eur != null && p\.price_max_eur != null/);
});

test("discount page has an explicit valid empty state and no report snapshot dependency", () => {
  const source = fs.readFileSync("src/pages/namaleniya/index.astro", "utf8");
  assert.match(source, /discounts\.length \?/);
  assert.match(source, /няма потвърдени намаления/);
  assert.doesNotMatch(source, /reports\/discounts|price_min_eur|price_max_eur/);
  assert.match(source, /discountActiveSelections/);
  assert.match(source, /Премахни филтър/);
  assert.match(source, /selection\.kind === "facet"/);
});

const uiItems = [
  { row_id: "1", product_type: "Обувки", facets: ["Естествена кожа"], current_price: 24.99, discount_percent: 20, original_index: 0 },
  { row_id: "2", product_type: "Козметика", facets: ["Витамин C"], current_price: 25, discount_percent: 40, original_index: 1 },
  { row_id: "3", product_type: "Обувки", facets: ["Памук"], current_price: 50, discount_percent: 10, original_index: 2 },
  { row_id: "4", product_type: "Дрехи", facets: ["Памук", "Витамин C"], current_price: 100, discount_percent: 30, original_index: 3 },
  { row_id: "5", product_type: "Дрехи", facets: ["Хартия"], current_price: 100.01, discount_percent: 15, original_index: 4 },
];
const emptyUiState = { productTypes: [], priceBucket: "all" as const, facets: [] };

test("discount filters use product type and combined filters", () => {
  assert.deepEqual(filterDiscountItems(uiItems, { ...emptyUiState, productTypes: ["Обувки"] }).map((item) => item.row_id), ["1", "3"]);
  assert.deepEqual(filterDiscountItems(uiItems, { productTypes: ["Дрехи"], priceBucket: "50-100", facets: ["памук"] }).map((item) => item.row_id), ["4"]);
});

test("discount price buckets use exact exclusive boundaries", () => {
  assert.equal(priceBucketFor(24.99), "under-25"); assert.equal(priceBucketFor(25), "25-50");
  assert.equal(priceBucketFor(49.99), "25-50"); assert.equal(priceBucketFor(50), "50-100");
  assert.equal(priceBucketFor(100), "50-100"); assert.equal(priceBucketFor(100.01), "over-100");
});

test("materials and ingredients combine without inference or normalized duplicates", () => {
  assert.deepEqual(combineStructuredFacets(["Памук", "Естествена кожа"], [" памук ", "Витамин C"]), ["Витамин C", "Естествена кожа", "Памук"]);
  assert.deepEqual(filterDiscountItems(uiItems, { ...emptyUiState, facets: ["витамин c"] }).map((item) => item.row_id), ["2", "4"]);
});

test("dynamic facets hide zero results but preserve self-excluding alternatives", () => {
  const counts = discountFacetCounts(uiItems, { productTypes: ["Обувки"], priceBucket: "under-25", facets: [] });
  assert.equal(counts.facets["естествена кожа"], 1); assert.equal(counts.facets["памук"], undefined);
  const alternatives = discountFacetCounts(uiItems, { productTypes: ["Обувки"], priceBucket: "all", facets: [] });
  assert.equal(alternatives.productTypes["Козметика"], 1);
});

test("discount sorting uses percent or verified current price only", () => {
  assert.deepEqual(sortDiscountItems(uiItems, "discount-desc").map((item) => item.row_id), ["2", "4", "1", "5", "3"]);
  assert.deepEqual(sortDiscountItems(uiItems, "price-asc").map((item) => item.row_id), ["1", "2", "3", "4", "5"]);
  assert.deepEqual(sortDiscountItems(uiItems, "price-desc").map((item) => item.row_id), ["5", "4", "3", "2", "1"]);
  assert.equal(JSON.stringify(uiItems).includes("price_min_eur"), false); assert.equal(JSON.stringify(uiItems).includes("price_max_eur"), false);
});
