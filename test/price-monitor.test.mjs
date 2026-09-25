import assert from "node:assert/strict";
import test from "node:test";
import { buildPersistencePlan, createBaserowCurrentStatePersistence, extractPrice, monitorProduct, normalizeCurrency, parsePrice, persistMonitorResults, persistenceStatus } from "../src/lib/price-monitor/index.mjs";

const url = "https://shop.example/products/main";
const jsonLd = (value) => `<html><head><title>Main Product | Shop</title><link rel="canonical" href="${url}"><script type="application/ld+json">${JSON.stringify(value)}</script></head><body></body></html>`;
const product = (offers, extra = {}) => ({ "@context": "https://schema.org", "@type": "Product", name: "Main Product", url, offers, ...extra });
const offer = (price = "49.90", currency = "EUR", extra = {}) => ({ "@type": "Offer", price, priceCurrency: currency, ...extra });

test("1 clean JSON-LD Product + Offer", () => {
  const result = extractPrice(jsonLd(product(offer())), { url });
  assert.deepEqual([result.price, result.currency, result.tier, result.confidence], [49.9, "EUR", 1, "high"]);
});

test("2 JSON-LD @graph", () => {
  const result = extractPrice(jsonLd({ "@context": "https://schema.org", "@graph": [{ "@type": "WebSite" }, product(offer("20", "BGN"))] }), { url });
  assert.equal(result.price, 20); assert.equal(result.currency, "BGN");
});

test("3 multiple JSON-LD blocks", () => {
  const html = `${jsonLd({ "@type": "Organization", name: "Shop" }).replace("</body></html>", "")}<script type="application/ld+json">${JSON.stringify(product(offer("21")))}</script></body></html>`;
  assert.equal(extractPrice(html, { url }).price, 21);
});

test("4 main product wins over recommended products", () => {
  const data = [product(offer("40")), { "@type": "Product", name: "Related", url: "https://shop.example/products/related", offers: offer("5") }];
  assert.equal(extractPrice(jsonLd(data), { url }).price, 40);
});

test("5 regular + sale price uses explicit Offer current price", () => {
  const result = extractPrice(jsonLd(product(offer("35", "EUR", { priceSpecification: { "@type": "UnitPriceSpecification", price: "50", priceType: "https://schema.org/ListPrice" } }))), { url });
  assert.equal(result.price, 35);
  assert.deepEqual([result.regular_price, result.regular_price_currency, result.regular_price_method], [50, "EUR", "json_ld_list_price"]);
});

test("6 crossed-out and semantic current DOM price", () => {
  const html = `<html><main class="product-detail"><del class="old-price">80 EUR</del><span class="sale-price current-price">60 EUR</span></main></html>`;
  const result = extractPrice(html, { url }); assert.equal(result.price, 60); assert.equal(result.confidence, "low");
});

test("7 multiple plausible prices are ambiguous", () => {
  const result = extractPrice(jsonLd(product([offer("20"), offer("25")])), { url }); assert.equal(result.status, "ambiguous"); assert.equal(result.price, undefined);
});

test("8 variant price range is not exact", () => {
  const result = extractPrice(jsonLd(product({ "@type": "AggregateOffer", lowPrice: "20", highPrice: "50", priceCurrency: "EUR" })), { url }); assert.equal(result.status, "ambiguous");
});

test("9 from price is ambiguous", () => {
  const result = extractPrice(`<main class="product-page"><span class="current-price">From 20 EUR</span></main>`, { url }); assert.equal(result.status, "ambiguous");
});

test("10 missing price is not detected", () => assert.equal(extractPrice(`<html><body><h1>Product</h1></body></html>`, { url }).status, "not_detected"));

test("11 malformed JSON-LD does not guess", () => {
  const result = extractPrice(`<script type="application/ld+json">{"@type":"Product",oops}</script><p>Only 55 EUR</p>`, { url });
  assert.equal(result.status, "not_detected"); assert.equal(result.reason, "malformed_json_ld_and_no_fallback");
});

test("12 microdata price", () => {
  const result = extractPrice(`<div itemscope itemtype="https://schema.org/Product"><meta itemprop="price" content="19.99"><meta itemprop="priceCurrency" content="EUR"></div>`, { url });
  assert.deepEqual([result.price, result.currency, result.tier], [19.99, "EUR", 2]);
});

test("13 product meta price", () => {
  const result = extractPrice(`<meta property="product:price:amount" content="44,90"><meta property="product:price:currency" content="BGN">`, { url });
  assert.deepEqual([result.price, result.currency, result.method], [44.9, "BGN", "open_graph_product_price"]);
});

test("14 embedded application/json product data", () => {
  const state = { page: { product: { type: "Product", name: "Main Product", url, currentPrice: { amount: "30", currency: "EUR" } } } };
  const result = extractPrice(`<title>Main Product</title><script type="application/json">${JSON.stringify(state)}</script>`, { url });
  assert.deepEqual([result.price, result.tier, result.confidence], [30, 3, "medium"]);
});

function page(status, body = "", finalUrl = url, redirected = false) { return { httpStatus: status, finalUrl, redirected, headers: {}, html: body }; }
test("15 404 is dead_url", async () => assert.equal((await monitorProduct({ product_url: url }, { page: page(404) })).status, "dead_url"));
test("16 410 is dead_url", async () => assert.equal((await monitorProduct({ product_url: url }, { page: page(410) })).status, "dead_url"));
test("17 403 is blocked", async () => assert.equal((await monitorProduct({ product_url: url }, { page: page(403) })).status, "blocked"));
test("18 redirect is reported without hiding extraction", async () => {
  const result = await monitorProduct({ product_url: url }, { page: page(200, jsonLd(product(offer())), `${url}/new`, true) });
  assert.equal(result.status, "redirected"); assert.equal(result.detected_price, 49.9);
});

test("19 currency and localized price parsing", () => {
  assert.equal(parsePrice("1 234,56 лв."), 1234.56); assert.equal(normalizeCurrency("лв."), "BGN"); assert.equal(normalizeCurrency("€"), "EUR");
});

test("20 JS shell requires browser", () => {
  const result = extractPrice(`<html><body><div id="root"></div>${"<script src='/app.js'></script>".repeat(8)}</body></html>`, { url });
  assert.equal(result.status, "browser_required");
});

test("comparison reports verified, changed, and currency mismatch without writes", async () => {
  const body = jsonLd(product(offer("49.90", "EUR")));
  assert.equal((await monitorProduct({ product_url: url, offer_price_amount: 49.9, offer_price_currency: "EUR" }, { page: page(200, body) })).status, "verified");
  assert.equal((await monitorProduct({ product_url: url, offer_price_amount: 45, offer_price_currency: "EUR" }, { page: page(200, body) })).status, "changed");
  const mismatch = await monitorProduct({ product_url: url, offer_price_amount: 49.9, offer_price_currency: "BGN" }, { page: page(200, body) });
  assert.equal(mismatch.status, "ambiguous"); assert.equal(mismatch.currency_mismatch, true); assert.equal(mismatch.price_changed, null);
});

test("monitor result preserves brand for historical observations", async () => {
  const monitored = await monitorProduct({ product_id: 42, product_name: "Main Product", brand_name: "Original Brand", product_url: url }, { page: page(200, jsonLd(product(offer()))) });
  assert.equal(monitored.brand_name, "Original Brand");
  assert.equal(monitored.currency, "EUR");
  assert.match(monitored.checked_at, /^\d{4}-\d{2}-\d{2}T/);
});

test("recognized Shopify adapter accepts one deterministic variant price", () => {
  const data = { product: { currency: "EUR", variants: [{ available: true, price: 2590 }, { available: true, price: 2590 }] } };
  const result = extractPrice(`<html><script id="ProductJson-main">${JSON.stringify(data)}</script></html>`, { url, platform: "shopify" });
  assert.deepEqual([result.price, result.currency, result.method, result.confidence], [25.9, "EUR", "shopify_product_json", "medium"]);
});

test("recognized Shopify adapter rejects divergent variant prices", () => {
  const data = { variants: [{ available: true, price: 2500 }, { available: true, price: 3000 }] };
  const result = extractPrice(`<html><script id="ProductJson-main">${JSON.stringify(data)}</script></html>`, { url, platform: "shopify" });
  assert.equal(result.status, "ambiguous"); assert.equal(result.price, undefined);
});

test("recognized WooCommerce adapter reads variation data and rejects ranges", () => {
  const one = encodeURIComponent(JSON.stringify([{ variation_is_active: true, display_price: 32 }]));
  const decoded = decodeURIComponent(one).replace(/"/g, "&quot;");
  const exact = extractPrice(`<html><form class="variations_form cart" data-product_variations="${decoded}"></form></html>`, { url, platform: "woocommerce" });
  assert.deepEqual([exact.price, exact.method, exact.confidence], [32, "woocommerce_product_data", "medium"]);
  const range = JSON.stringify([{ display_price: 32 }, { display_price: 36 }]).replace(/"/g, "&quot;");
  const rangeResult = extractPrice(`<form class="variations_form" data-product_variations="${range}"></form>`, { url, platform: "woocommerce" });
  assert.equal(rangeResult.status, "ambiguous"); assert.equal(rangeResult.outcome, "variation_range");
});

test("CherryMe multi-price album variations produce an explicit range outcome without selecting the main price", async () => {
  const variations = JSON.stringify([
    { variation_id: 101, variation_is_active: true, is_purchasable: true, display_price: 53.99, display_regular_price: 53.99, currency: "EUR" },
    { variation_id: 102, variation_is_active: true, is_purchasable: true, display_price: 57.99, display_regular_price: 57.99, currency: "EUR" },
    { variation_id: 103, variation_is_active: true, is_purchasable: true, display_price: 62.99, display_regular_price: 62.99, currency: "EUR" },
    { variation_id: 104, variation_is_active: true, is_purchasable: true, display_price: 67.99, display_regular_price: 67.99, currency: "EUR" },
    { variation_id: 105, variation_is_active: true, is_purchasable: true, display_price: 71.99, display_regular_price: 71.99, currency: "EUR" },
  ]).replace(/"/g, "&quot;");
  const html = `<div id="product-10" class="product"><p class="price"><span class="woocommerce-Price-amount">53.99 €</span></p><form class="variations_form cart" data-product_variations="${variations}"></form></div>`;
  const extracted = extractPrice(html, { url: "https://cherryme.bg/produkti/travel-album-greece/", platform: "woocommerce" });
  assert.deepEqual([extracted.status, extracted.outcome, extracted.method, extracted.price], ["ambiguous", "variation_range", "woocommerce_variation_range", undefined]);
  assert.deepEqual(extracted.evidence, { kind: "variation_range", min_price: 53.99, max_price: 71.99, currency: "EUR", variation_count: 5, distinct_prices: [53.99, 57.99, 62.99, 67.99, 71.99], variation_ids: [101, 102, 103, 104, 105] });
  const monitored = await monitorProduct({ product_url: "https://cherryme.bg/produkti/travel-album-greece/", offer_price_amount: 53.99, offer_price_currency: "EUR" }, { page: page(200, html) });
  assert.deepEqual([monitored.status, monitored.extraction_outcome, monitored.detected_price, monitored.extraction_method, monitored.error_reason], ["ambiguous", "variation_range", null, "woocommerce_variation_range", "woocommerce_multiple_current_variation_prices"]);
});

test("MOMVY single-pack and three-pack prices remain an explicit variation range", () => {
  const variations = JSON.stringify([
    { variation_id: 201, variation_is_active: true, is_purchasable: true, display_price: 24.99, display_regular_price: 24.99, currency: "EUR" },
    { variation_id: 202, variation_is_active: true, is_purchasable: true, display_price: 74.97, display_regular_price: 74.97, currency: "EUR" },
  ]).replace(/"/g, "&quot;");
  const html = `<div id="product-20" class="product"><p class="price"><span class="woocommerce-Price-amount">24.99 €</span></p><form class="variations_form cart" data-product_variations="${variations}"></form></div>`;
  const result = extractPrice(html, { url: "https://momvy.eu/product/energia/", platform: "woocommerce" });
  assert.deepEqual([result.status, result.outcome, result.price, result.evidence.min_price, result.evidence.max_price, result.evidence.currency], ["ambiguous", "variation_range", undefined, 24.99, 74.97, "EUR"]);
});

test("Aurora Sleepwear purchasable size prices use the existing variation-range outcome", async () => {
  const variations = JSON.stringify([
    { variation_id: "single-bed", variation_is_active: true, is_purchasable: true, display_price: 40, display_regular_price: 40, currency: "EUR" },
    { variation_id: "prista", variation_is_active: true, is_purchasable: true, display_price: 48, display_regular_price: 48, currency: "EUR" },
    { variation_id: "double-bed", variation_is_active: true, is_purchasable: true, display_price: 58, display_regular_price: 58, currency: "EUR" },
  ]).replace(/"/g, "&quot;");
  const productUrl = "https://www.aurorasleepwear.bg/bg/products/354d633e-e778-4319-b319-11d6ce92a4cf";
  const html = `<div id="product-aurora" class="product"><p class="price"><span class="woocommerce-Price-amount">58,00 EUR</span></p><form class="variations_form cart" data-product_variations="${variations}"></form></div>`;
  const result = await monitorProduct(
    { product_url: productUrl, offer_price_amount: 58, offer_price_currency: "EUR" },
    { page: page(200, html), platform: "woocommerce" },
  );

  assert.deepEqual(
    [result.status, result.extraction_outcome, result.detected_price, result.extraction_method, result.error_reason],
    ["ambiguous", "variation_range", null, "woocommerce_variation_range", "woocommerce_multiple_current_variation_prices"],
  );
  assert.deepEqual(
    [result.evidence.kind, result.evidence.min_price, result.evidence.max_price, result.evidence.currency, result.evidence.variation_count],
    ["variation_range", 40, 58, "EUR", 3],
  );
  assert.deepEqual(result.evidence.distinct_prices, [40, 48, 58]);
  assert.deepEqual(result.evidence.variation_ids, ["single-bed", "prista", "double-bed"]);
});

test("WooCommerce identical purchasable variation prices preserve exact single-price verification", async () => {
  const variations = JSON.stringify([
    { variation_id: 301, variation_is_active: true, is_purchasable: true, display_price: 49, display_regular_price: 49, currency: "EUR" },
    { variation_id: 302, variation_is_active: true, is_purchasable: true, display_price: 49, display_regular_price: 49, currency: "EUR" },
  ]).replace(/"/g, "&quot;");
  const html = `<div id="product-30" class="product"><p class="price"><span class="woocommerce-Price-amount">49 EUR</span></p><form class="variations_form cart" data-product_variations="${variations}"></form></div>`;
  const result = await monitorProduct({ product_url: url, offer_price_amount: 49, offer_price_currency: "EUR" }, { page: page(200, html) });
  assert.deepEqual([result.status, result.detected_price, result.currency, result.extraction_method, result.extraction_outcome], ["verified", 49, "EUR", "woocommerce_product_data", null]);
});

test("Tier 2 product meta can resolve ambiguous duplicate Product JSON-LD", () => {
  const duplicate = [product(offer("20"), { url: "" }), product(offer("20"), { url: "" })];
  const html = `${jsonLd(duplicate).replace("</head>", '<meta property="og:price:amount" content="20"><meta property="og:price:currency" content="EUR"></head>')}`;
  const result = extractPrice(html, { url });
  assert.deepEqual([result.price, result.currency, result.tier, result.method], [20, "EUR", 2, "open_graph_product_price"]);
});

test("schema microdata supports text content", () => {
  const result = extractPrice('<div itemscope itemtype="https://schema.org/Product"><span itemprop="price">7,50</span><meta itemprop="priceCurrency" content="EUR"></div>', { url });
  assert.deepEqual([result.price, result.currency, result.method], [7.5, "EUR", "schema_microdata_price"]);
});

test("WooCommerce main product price is scoped and sale-aware", () => {
  const html = '<div id="product-10" class="product type-product product-type-simple"><p class="price"><del><span class="woocommerce-Price-amount amount">40 EUR</span></del><ins><span class="woocommerce-Price-amount amount">30 EUR</span></ins></p></div>';
  const result = extractPrice(html, { url, platform: "woocommerce" });
  assert.deepEqual([result.price, result.currency, result.method, result.confidence], [30, "EUR", "woocommerce_product_data", "medium"]);
  assert.deepEqual([result.regular_price, result.regular_price_currency, result.regular_price_method], [40, "EUR", "woocommerce_del_ins"]);
});

test("WooCommerce price without sale preserves current price and leaves regular price empty", () => {
  const html = '<div id="product-10" class="product type-product product-type-simple"><p class="price"><span class="woocommerce-Price-amount amount">49 EUR</span></p></div>';
  const result = extractPrice(html, { url, platform: "woocommerce" });
  assert.equal(result.price, 49); assert.equal(result.regular_price, undefined);
});

test("WooCommerce identical candidates reconcile one missing currency without hiding real ranges", () => {
  const exactVariations = JSON.stringify([{ variation_id: 1, display_price: 65 }]).replace(/"/g, "&quot;");
  const exactHtml = `<form class="variations_form" data-product_variations="${exactVariations}"></form><div id="product-10" class="product type-product"><p class="price"><span class="woocommerce-Price-amount">65 EUR</span></p></div>`;
  const exact = extractPrice(exactHtml, { url, platform: "woocommerce" });
  assert.deepEqual([exact.price, exact.currency, exact.status], [65, "EUR", undefined]);
  const rangedVariations = JSON.stringify([{ display_price: 65 }, { display_price: 75 }]).replace(/"/g, "&quot;");
  const ranged = extractPrice(`<form class="variations_form" data-product_variations="${rangedVariations}"></form><div id="product-10" class="product"><p class="price">65 EUR</p></div>`, { url, platform: "woocommerce" });
  assert.equal(ranged.status, "ambiguous");
});

test("WooCommerce accepts plain product-root and explicit purchase-widget prices only", () => {
  const root = extractPrice('<div id="product-291" class="product type-product"><p class="price">91,52 €</p></div>', { url, platform: "woocommerce" });
  assert.deepEqual([root.price, root.currency, root.method], [91.52, "EUR", "woocommerce_product_data"]);
  const widget = extractPrice('<div class="av-woo-purchase-button"><p class="price"><span class="woocommerce-Price-amount">15,90 €</span></p></div>', { url, platform: "woocommerce" });
  assert.deepEqual([widget.price, widget.currency, widget.method], [15.9, "EUR", "woocommerce_product_data"]);
  const recommendation = extractPrice('<div class="recommendations"><p class="price">5 EUR</p></div>', { url, platform: "woocommerce" });
  assert.equal(recommendation.status, "not_detected");
});

test("proven domain adapters remain scoped to authoritative product containers", () => {
  const cases = [
    ["https://borianasport.com/product", '<div class="price-wrapper"><span class="price-new">45.90 €</span><span class="price-old">51.90 €</span></div>', 45.9, "domain_product_price_borianasport_com"],
    ["https://astogold.bg/bg/magazin/product", '<p class="product__price">930.00 EUR | 1 818.92 BGN</p>', 930, "domain_product_price_astogold_bg"],
    ["https://art-tochka.com/nodes/product", '<div class="regular-price" id="priceHolder" value="59.00">30.17 € <br>59.00 лв.</div>', 30.17, "domain_product_price_art_tochka_com"],
    ["https://gil.bg/product", '<ul class="list-unstyled price"><li><span class="live-price">110.00 €<span></li></ul>', 110, "domain_product_price_gil_bg"],
    ["https://gabi-jewellery.com/product", '<span id="product-price" class="product-price">40.00 €</span>', 40, "domain_product_price_gabi_jewellery_com"],
    ["https://sito-studio.com/product/test", '<div class="product_cta_wrap"><div data-wf-sku-bindings="%5B%7B%22from%22%3A%22f_price_%22%7D%5D" class="price--fs5-fw2">46.00 €</div><form data-node-type="commerce-add-to-cart-form"></form></div><div data-wf-sku-bindings="f_price_" class="price--related">5.00 €</div>', 46, "domain_product_price_sito_studio_com"],
  ];
  for (const [pageUrl, html, expected, method] of cases) {
    const result = extractPrice(html, { url: pageUrl, platform: "custom" });
    assert.deepEqual([result.price, result.currency, result.method, result.confidence], [expected, "EUR", method, "medium"]);
  }
  assert.equal(extractPrice('<div class="recommendation"><span class="product-price">4.00 €</span></div>', { url: "https://gabi-jewellery.com/product", platform: "custom" }).status, "not_detected");
});

test("WooCommerce same variation preserves explicit regular and sale prices", () => {
  const variations = JSON.stringify([{ variation_id: 7, variation_is_active: true, is_purchasable: true, display_price: 49, display_regular_price: 59, currency: "EUR" }]).replace(/"/g, "&quot;");
  const result = extractPrice(`<form class="variations_form" data-product_variations="${variations}"></form>`, { url, platform: "woocommerce" });
  assert.deepEqual([result.price, result.regular_price, result.regular_price_currency, result.regular_price_method], [49, 59, "EUR", "woocommerce_variation_regular_sale"]);
});

test("WooCommerce never constructs a regular/current pair from different variants", () => {
  const variations = JSON.stringify([
    { variation_id: 7, display_price: 49, display_regular_price: 49, currency: "EUR" },
    { variation_id: 8, display_price: 59, display_regular_price: 59, currency: "EUR" },
  ]).replace(/"/g, "&quot;");
  const result = extractPrice(`<form class="variations_form" data-product_variations="${variations}"></form>`, { url, platform: "woocommerce" });
  assert.equal(result.status, "ambiguous"); assert.equal(result.regular_price, undefined);
});

test("Shopify compare-at price is preserved for the same purchasable variant", () => {
  const data = { product: { currency: "EUR", variants: [{ id: 7, available: true, price: 4900, compare_at_price: 5900 }] } };
  const result = extractPrice(`<script id="ProductJson-main">${JSON.stringify(data)}</script>`, { url, platform: "shopify" });
  assert.deepEqual([result.price, result.regular_price, result.regular_price_currency, result.regular_price_method], [49, 59, "EUR", "shopify_compare_at_price"]);
});

test("Shopify without compare-at price leaves regular price empty", () => {
  const data = { product: { currency: "EUR", variants: [{ id: 7, available: true, price: 5900, compare_at_price: null }] } };
  const result = extractPrice(`<script id="ProductJson-main">${JSON.stringify(data)}</script>`, { url, platform: "shopify" });
  assert.equal(result.price, 59); assert.equal(result.regular_price, undefined);
});

test("Shopify does not borrow compare-at price from another same-priced variant", () => {
  const data = { product: { currency: "EUR", variants: [
    { id: 7, available: true, price: 4900, compare_at_price: 5900 },
    { id: 8, available: true, price: 4900, compare_at_price: null },
  ] } };
  const result = extractPrice(`<script id="ProductJson-main">${JSON.stringify(data)}</script>`, { url, platform: "shopify" });
  assert.equal(result.price, 49); assert.equal(result.regular_price, undefined);
});

test("unrelated JSON-LD prices never become a regular/current pair", () => {
  const result = extractPrice(jsonLd(product([offer("35"), offer("50")])), { url });
  assert.equal(result.status, "ambiguous"); assert.equal(result.regular_price, undefined);
});

test("invalid or currency-mismatched JSON-LD list prices are discarded", () => {
  const notHigher = extractPrice(jsonLd(product(offer("50", "EUR", { priceSpecification: { price: "50", priceCurrency: "EUR", priceType: "ListPrice" } }))), { url });
  const mismatch = extractPrice(jsonLd(product(offer("35", "EUR", { priceSpecification: { price: "50", priceCurrency: "BGN", priceType: "ListPrice" } }))), { url });
  assert.equal(notHigher.regular_price, undefined); assert.equal(mismatch.regular_price, undefined);
});

test("safe DOM preserves only an explicit old/current pair in one product-price container", () => {
  const html = '<main class="product-detail"><div class="product-price"><span class="price-old">59 EUR</span><span class="price-new">49 EUR</span></div></main>';
  const result = extractPrice(html, { url });
  assert.deepEqual([result.price, result.regular_price, result.regular_price_currency, result.regular_price_method], [49, 59, "EUR", "semantic_old_current_pair"]);
});

test("Ballhole dual-currency purchase price overrides stale BGN-only structured currency when every variant has the same price", () => {
  const variations = JSON.stringify([
    { variation_id: 1, variation_is_active: true, is_purchasable: true, display_price: 39.9 },
    { variation_id: 2, variation_is_active: true, is_purchasable: true, display_price: 39.9 },
  ]).replace(/"/g, "&quot;");
  const html = `${jsonLd(product(offer("39.9", "BGN")))}<p class="price"><span>39,9 лв.</span><span> / 20,4 €</span></p><form class="variations_form cart" data-product_variations="${variations}"></form>`;
  const result = extractPrice(html, { url: "https://ballhole.bg/p/example/", platform: "woocommerce" });
  assert.deepEqual([result.price, result.currency, result.method, result.confidence], [20.4, "EUR", "domain_purchase_price_ballhole_bg", "high"]);
});

test("Ballhole does not promote a dual-currency display when purchasable variants differ", () => {
  const variations = JSON.stringify([
    { variation_is_active: true, is_purchasable: true, display_price: 39.9 },
    { variation_is_active: true, is_purchasable: true, display_price: 49.9 },
  ]).replace(/"/g, "&quot;");
  const html = `${jsonLd(product(offer("39.9", "BGN")))}<p class="price"><span>39,9 лв.</span><span> / 20,4 €</span></p><form class="variations_form cart" data-product_variations="${variations}"></form>`;
  const result = extractPrice(html, { url: "https://ballhole.bg/p/example/", platform: "woocommerce" });
  assert.deepEqual([result.price, result.currency, result.method], [39.9, "BGN", "json_ld_product_offer"]);
});

test("Cavaler purchase price overrides a stale BGN structured currency only with co-located buy semantics and matching amount", () => {
  const html = `${jsonLd(product(offer("56", "BGN")))}<div class="product-price"><div class="old">Цена</div><div class="new"><span class="price">56.00€</span></div></div><button data-ng-click="addToCart(2471, '#product_id')" class="productbuybtn">Купи</button>`;
  const result = extractPrice(html, { url: "https://www.cavalerbg.com/c/example/product-2471" });
  assert.deepEqual([result.price, result.currency, result.method, result.confidence], [56, "EUR", "domain_purchase_price_cavalerbg_com", "high"]);
});

test("Cavaler does not override structured data without matching amount and purchase semantics", () => {
  const mismatch = `${jsonLd(product(offer("56", "BGN")))}<div class="product-price"><div class="new"><span class="price">57.00€</span></div></div><button class="productbuybtn">Купи</button>`;
  const noBuy = `${jsonLd(product(offer("56", "BGN")))}<div class="product-price"><div class="new"><span class="price">56.00€</span></div></div>`;
  for (const html of [mismatch, noBuy]) {
    const result = extractPrice(html, { url: "https://www.cavalerbg.com/c/example/product-2471" });
    assert.deepEqual([result.price, result.currency, result.method], [56, "BGN", "json_ld_product_offer"]);
  }
});

test("monitor carries regular price without changing authoritative price comparison", async () => {
  const body = jsonLd(product(offer("49", "EUR", { priceSpecification: { price: "59", priceCurrency: "EUR", priceType: "ListPrice" } })));
  const result = await monitorProduct({ product_url: url, offer_price_amount: 49, offer_price_currency: "EUR" }, { page: page(200, body) });
  assert.deepEqual([result.detected_price, result.regular_price, result.price_changed, result.status], [49, 59, false, "verified"]);
});

const shopifyMetaPage = (variants, pageUrl = `${url}?variant=7`) => `<html><head>
  <meta property="product:price:amount" content="49"><meta property="product:price:currency" content="EUR">
  </head><body><script id="ProductJson-product-template">${JSON.stringify({ currency: "EUR", variants })}</script></body></html>`;

test("OpenGraph current is enriched by the exact URL-selected Shopify variant without overriding current provenance", () => {
  const result = extractPrice(shopifyMetaPage([
    { id: 7, available: true, price: 4900, compare_at_price: 5900 },
    { id: 8, available: true, price: 3900, compare_at_price: 4900 },
  ]), { url: `${url}?variant=7`, platform: "shopify" });
  assert.deepEqual([result.price, result.currency, result.method, result.confidence], [49, "EUR", "open_graph_product_price", "high"]);
  assert.deepEqual([result.regular_price, result.regular_price_currency, result.regular_price_method], [59, "EUR", "shopify_compare_at_price_enrichment"]);
  assert.equal(result.regular_price_evidence.decision, "url_selected_variant");
});

test("Shopify selected-variant current mismatch does not enrich", () => {
  const result = extractPrice(shopifyMetaPage([{ id: 7, available: true, price: 4500, compare_at_price: 5900 }]), { url: `${url}?variant=7`, platform: "shopify" });
  assert.equal(result.price, 49); assert.equal(result.regular_price, undefined);
});

test("Shopify identical pair across every purchasable variant enriches without a selected variant", () => {
  const result = extractPrice(shopifyMetaPage([
    { id: 7, available: true, price: 4900, compare_at_price: 5900 },
    { id: 8, available: true, price: 4900, compare_at_price: 5900 },
  ], url), { url, platform: "shopify" });
  assert.deepEqual([result.price, result.regular_price, result.regular_price_method], [49, 59, "shopify_compare_at_price_enrichment"]);
  assert.equal(result.regular_price_evidence.decision, "all_purchasable_variants_same_pair");
});

test("Shopify differing variant pairs do not enrich", () => {
  const result = extractPrice(shopifyMetaPage([
    { id: 7, available: true, price: 4900, compare_at_price: 5900 },
    { id: 8, available: true, price: 3900, compare_at_price: 4900 },
  ], url), { url, platform: "shopify" });
  assert.equal(result.price, 49); assert.equal(result.regular_price, undefined);
});

test("Shopify missing compare-at on one relevant variant blocks enrichment unless that variant is URL-selected", () => {
  const variants = [
    { id: 7, available: true, price: 4900, compare_at_price: 5900 },
    { id: 8, available: true, price: 4900, compare_at_price: null },
  ];
  assert.equal(extractPrice(shopifyMetaPage(variants, url), { url, platform: "shopify" }).regular_price, undefined);
  assert.equal(extractPrice(shopifyMetaPage(variants), { url: `${url}?variant=7`, platform: "shopify" }).regular_price, 59);
});

test("strictly co-located product-price-new and product-price-old are preserved", () => {
  const html = '<main class="product-detail"><div class="price-group"><div class="product-price-new">49 EUR</div><div class="product-price-old">59 EUR</div></div></main>';
  const result = extractPrice(html, { url });
  assert.deepEqual([result.price, result.regular_price, result.regular_price_currency, result.regular_price_method], [49, 59, "EUR", "semantic_colocated_old_current_pair"]);
});

test("nested authoritative product-price-group wrapper preserves a direct old/new pair", () => {
  const html = '<div class="product-info"><div class="product-details"><div class="product-price-group"><div class="price-wrapper"><div class="price-group"><div class="product-price-new">49 EUR</div><div class="product-price-old">59 EUR</div></div></div></div></div></div>';
  const result = extractPrice(html, { url });
  assert.deepEqual([result.price, result.regular_price, result.regular_price_method], [49, 59, "semantic_colocated_old_current_pair"]);
});

test("old/new elements in unrelated containers are never paired", () => {
  const html = '<main class="product-detail"><div class="price-group"><div class="product-price-new">49 EUR</div></div><div class="price-group"><div class="product-price-old">59 EUR</div></div></main>';
  assert.equal(extractPrice(html, { url }).regular_price, undefined);
});

test("product-card old/new pair outside an authoritative product price container is ignored", () => {
  const html = '<aside class="recommendations"><article class="product-card"><div class="price-group"><div class="product-price-new">49 EUR</div><div class="product-price-old">59 EUR</div></div></article></aside>';
  const result = extractPrice(html, { url });
  assert.equal(result.price, undefined); assert.equal(result.regular_price, undefined);
});

test("semantic enrichment requires its current price to match the selected current price", () => {
  const html = '<meta property="product:price:amount" content="49"><meta property="product:price:currency" content="EUR"><main class="product-detail"><div class="price-group"><div class="product-price-new">45 EUR</div><div class="product-price-old">59 EUR</div></div></main>';
  const result = extractPrice(html, { url });
  assert.equal(result.price, 49); assert.equal(result.method, "open_graph_product_price"); assert.equal(result.regular_price, undefined);
});

test("zero current price cannot produce a reliable detected result", async () => {
  assert.equal(parsePrice(0), null); assert.equal(parsePrice("0.00 EUR"), null);
  const html = jsonLd(product(offer("0", "EUR")));
  const extracted = extractPrice(html, { url });
  assert.equal(extracted.price, undefined); assert.equal(extracted.status, "not_detected");
  const monitored = await monitorProduct({ product_url: url }, { page: page(200, html) });
  assert.equal(monitored.detected_price, null); assert.equal(monitored.status, "not_detected");
});

const persistedResult = (overrides = {}) => ({
  product_id: 42, product_url: url, checked_at: "2026-09-17T10:00:00.000Z", http_status: 200, final_url: url,
  detected_price: 50, currency: "EUR", extraction_method: "json_ld_product_offer", confidence: "high",
  status: "verified", previous_offer_price: 50, price_changed: false, currency_mismatch: false, error_reason: null,
  ...overrides,
});

test("persistence maps high-confidence same and changed prices without protected fields", () => {
  const same = buildPersistencePlan(persistedResult());
  assert.equal(same.current.price_check_status, "verified"); assert.equal(same.current.price_change_detected, false);
  const changed = buildPersistencePlan(persistedResult({ detected_price: 55, status: "changed", price_changed: true }));
  assert.equal(changed.current.price_check_status, "changed"); assert.equal(changed.current.price_change_detected, true);
  for (const protectedField of ["price_min_eur", "price_max_eur", "offer_price_amount", "offer_price_currency", "offer_price_verified_at", "offer_price_source", "offer_price_source_url"]) {
    assert.equal(protectedField in changed.current, false);
  }
});

test("monitoring lifecycle suppresses changed/dead approved Offers without overwriting the snapshot", () => {
  const changed = buildPersistencePlan(persistedResult({ detected_price: 55, status: "changed", price_changed: true, previous_offer_status: "verified_current" }));
  assert.equal(changed.current.offer_price_status, "change_pending");
  const dead = buildPersistencePlan(persistedResult({ status: "dead_url", http_status: 404, detected_price: null, previous_offer_status: "verified_current" }));
  assert.equal(dead.current.offer_price_status, "source_unavailable");
  for (const field of ["offer_price_amount", "offer_price_currency", "offer_price_verified_at", "offer_price_source", "offer_price_source_url"]) assert.equal(field in changed.current, false);
});

test("monitor confirmations preserve manual provenance and changes only become pending", () => {
  const same = buildPersistencePlan(persistedResult({ previous_offer_status: "verified_current", previous_offer_source: "manual_external_product_page" }));
  assert.equal(same.current.offer_price_status, "verified_current");
  const changed = buildPersistencePlan(persistedResult({ detected_price: 55, status: "changed", price_changed: true, previous_offer_status: "verified_current", previous_offer_source: "manual_external_product_page" }));
  assert.equal(changed.current.offer_price_status, "change_pending");
  for (const field of ["offer_price_amount", "offer_price_currency", "offer_price_verified_at", "offer_price_source", "offer_price_source_url", "manual_price_amount", "manual_price_verified_at"]) assert.equal(field in changed.current, false);
});

test("persistence preserves operational statuses and never treats blocked as dead", () => {
  assert.equal(persistenceStatus(persistedResult({ status: "ambiguous", detected_price: null })), "ambiguous");
  assert.equal(persistenceStatus(persistedResult({ status: "blocked", http_status: 403, detected_price: null })), "blocked");
  assert.equal(persistenceStatus(persistedResult({ status: "dead_url", http_status: 404, detected_price: null })), "dead_url");
  assert.equal(persistenceStatus(persistedResult({ status: "redirected", final_url: `${url}/new` })), "redirected");
  assert.equal(persistenceStatus(persistedResult({ status: "changed", confidence: "medium", price_changed: true })), "ambiguous");
});

test("failed scans preserve the last detected current-state fields", () => {
  for (const status of ["blocked", "error", "browser_required", "not_detected", "ambiguous"]) {
    const plan = buildPersistencePlan(persistedResult({ status, detected_price: null, currency: null, extraction_method: null, confidence: null }));
    assert.equal("price_detected_amount" in plan.current, false);
    assert.equal("price_detected_currency" in plan.current, false);
    assert.equal("price_extraction_method" in plan.current, false);
    assert.equal("price_confidence" in plan.current, false);
  }
});

test("persistence is dry-run by default", async () => {
  const output = await persistMonitorResults([persistedResult()]);
  assert.equal(output.mode, "dry-run"); assert.equal(output.writes_performed, false); assert.equal(output.planned, 1);
});

test("Google history appends before Baserow current-state patch", async () => {
  const calls = []; const order = [];
  const fetchImpl = async (requestUrl, init) => {
    order.push("current");
    calls.push({ url: requestUrl, method: init.method, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ id: 42 }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const historyWriter = { append: async () => { order.push("history"); return { appended: 1 }; } };
  const currentWriter = createBaserowCurrentStatePersistence({ token: "test", productsTableId: "products", fetchImpl });
  const output = await persistMonitorResults([persistedResult()], { write: true, historyWriter, currentWriter });
  assert.equal(output.writes_performed, true); assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PATCH"); assert.match(calls[0].url, /table\/products\/42/);
  assert.equal("offer_price_amount" in calls[0].body, false); assert.deepEqual(order,["history","current"]);
});

test("failed Google history append prevents Baserow current-state patch", async () => {
  let currentWrites = 0; const historyWriter = { append: async () => { throw new Error("Google unavailable"); } }; const currentWriter = { write: async () => { currentWrites += 1; } };
  await assert.rejects(() => persistMonitorResults([persistedResult()], { write: true, historyWriter, currentWriter }), /Google unavailable/);
  assert.equal(currentWrites, 0);
});

test("failed Baserow current-state patch does not remove appended history", async () => {
  let historyAppends = 0;
  const historyWriter = { append: async () => { historyAppends += 1; return { appended: 1 }; } };
  const currentWriter = { write: async () => { throw new Error("Baserow unavailable"); } };
  await assert.rejects(() => persistMonitorResults([persistedResult()], { write: true, historyWriter, currentWriter }), /Baserow unavailable/);
  assert.equal(historyAppends, 1);
});
