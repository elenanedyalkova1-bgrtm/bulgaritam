import assert from "node:assert/strict";
import test from "node:test";
import { buildCatalogPriceMutation, buildManualPriceMutation, candidateFromMonitorResult, formatVerifiedOfferAmount, offerJsonLd, resolvePublishableOffer } from "../src/lib/verified-offer";

const now = new Date("2026-09-17T12:00:00Z");
const base = {
  brand_name: "Brand", brand_url: "https://brand.test/", product_url: "https://brand.test/p",
  price_min_eur: 10, price_max_eur: 10, currency: "EUR",
  offer_price_amount: 20, offer_price_currency: "EUR", offer_price_verified_at: "2026-09-17T10:00:00Z",
  offer_price_source: "monitor_json_ld_product_offer", offer_price_source_url: "https://brand.test/p", offer_price_status: "verified_current",
};

test("range fields can never create a publishable Offer", () => {
  const { offer_price_amount, offer_price_currency, offer_price_verified_at, offer_price_source, offer_price_source_url, offer_price_status, ...rangeOnly } = base;
  assert.equal(resolvePublishableOffer(rangeOnly, now), null);
});

test("only verified_current and fresh complete snapshots publish", () => {
  assert.equal(resolvePublishableOffer(base, now)?.amount, 20);
  for (const status of ["change_pending", "stale", "source_unavailable", "revoked", "unverified"]) assert.equal(resolvePublishableOffer({ ...base, offer_price_status: status }, now), null);
  assert.equal(resolvePublishableOffer({ ...base, offer_price_verified_at: "2026-08-01T00:00:00Z" }, now), null);
});

test("source currency URL and brand gates are enforced", () => {
  assert.equal(resolvePublishableOffer({ ...base, offer_price_source: "semantic_current_price_dom" }, now), null);
  assert.equal(resolvePublishableOffer({ ...base, offer_price_currency: "EURO" }, now), null);
  assert.equal(resolvePublishableOffer({ ...base, offer_price_source_url: "https://bulgaritam.bg/p/x" }, now), null);
  assert.equal(resolvePublishableOffer({ ...base, offer_price_source_url: "https://other-brand.test/p" }, now), null);
  assert.equal(resolvePublishableOffer({ ...base, offer_price_source: "brand_feed" }, now), null);
  assert.equal(resolvePublishableOffer({ ...base, brand_name: "" }, now), null);
});

test("UI representation and JSON-LD use the same resolved object", () => {
  const offer = resolvePublishableOffer(base, now)!; const json = offerJsonLd(offer); const visible = formatVerifiedOfferAmount(offer);
  assert.match(visible, /^20\sEUR$/); assert.equal(json.price, offer.amount); assert.equal(json.priceCurrency, offer.currency);
  assert.equal(json.seller.name, "Brand"); assert.equal(json.url, "https://brand.test/p"); assert.equal("availability" in json, false);
});

test("candidate allowlist rejects medium, ranges and unsupported extraction", () => {
  const result = { detected_price: 25, currency: "EUR", checked_at: now.toISOString(), final_url: base.product_url, product_url: base.product_url, extraction_method: "json_ld_product_offer", confidence: "high", status: "verified", evidence: { path: "$.offers.price", candidate_count: 1, diagnostics: { selected_product: { score: 100 }, page_identity: { canonical: base.product_url, title: "Product" } } } };
  assert.equal(candidateFromMonitorResult(result, base)?.amount, 25);
  assert.equal(candidateFromMonitorResult({ ...result, confidence: "medium" }, base), null);
  assert.equal(candidateFromMonitorResult({ ...result, extraction_method: "woocommerce_product_data" }, base), null);
  assert.equal(candidateFromMonitorResult({ ...result, currency: null }, base), null);
  assert.equal(candidateFromMonitorResult({ ...result, currency_mismatch: true }, base), null);
  assert.equal(candidateFromMonitorResult({ ...result, status: "ambiguous" }, base), null);
  assert.equal(candidateFromMonitorResult({ ...result, extraction_method: "json_ld_aggregate_offer" }, base), null);
});

const manualInput = { manual_price_amount: "65", manual_price_currency: "eur", manual_price_verified_at: "", manual_price_source_url: "https://brand.test/p?ref=admin" };

test("complete manual confirmation atomically creates the authoritative snapshot", () => {
  const mutation = buildManualPriceMutation(base, manualInput, "confirm", now);
  assert.deepEqual({ amount: mutation.offer_price_amount, currency: mutation.offer_price_currency, source: mutation.offer_price_source, status: mutation.offer_price_status }, { amount: 65, currency: "EUR", source: "manual_external_product_page", status: "verified_current" });
  assert.equal(mutation.manual_price_verified_at, now.toISOString());
  assert.equal(mutation.offer_price_verified_at, now.toISOString());
});

test("manual amount without complete provenance is rejected", () => {
  assert.throws(() => buildManualPriceMutation(base, { manual_price_amount: 65 }, "confirm", now), /currency/i);
});

test("manual source URL must be the canonical external product page", () => {
  assert.throws(() => buildManualPriceMutation(base, { ...manualInput, manual_price_source_url: "https://other.test/p" }, "confirm", now), /match/i);
  assert.throws(() => buildManualPriceMutation(base, { ...manualInput, manual_price_source_url: "https://bulgaritam.bg/p/x" }, "confirm", now), /external/i);
});

test("invalid, zero and conflicting manual currencies never promote", () => {
  for (const patch of [{ manual_price_amount: 0 }, { manual_price_amount: -1 }, { manual_price_currency: "EURO" }, { manual_price_currency: "USD" }]) {
    assert.throws(() => buildManualPriceMutation(base, { ...manualInput, ...patch }, "confirm", now));
  }
});

test("ordinary Product save preserves timestamp and cannot publish a manual draft", () => {
  const mutation = buildManualPriceMutation(base, { ...manualInput, manual_price_verified_at: "2026-09-01T00:00:00Z" }, "save", now);
  assert.equal(mutation.manual_price_verified_at, "2026-09-01T00:00:00Z");
  assert.equal("offer_price_amount" in mutation, false);
  assert.equal("offer_price_status" in mutation, false);
});

test("ordinary Product save accepts a fully empty manual section", () => {
  const mutation = buildManualPriceMutation(base, {}, "save", now);
  assert.deepEqual(mutation, { manual_price_amount: null, manual_price_currency: "", manual_price_verified_at: null, manual_price_source_url: "" });
  assert.equal("offer_price_amount" in mutation, false);
});

test("manual source publishes in UI and Product JSON-LD through the central resolver", () => {
  const approved = { ...base, ...buildManualPriceMutation(base, manualInput, "confirm", now) };
  const offer = resolvePublishableOffer(approved, now)!;
  assert.equal(formatVerifiedOfferAmount(offer), "65 EUR");
  assert.deepEqual(offerJsonLd(offer), { "@type": "Offer", url: "https://brand.test/p?ref=admin", price: 65, priceCurrency: "EUR", seller: { "@type": "Organization", name: "Brand", url: "https://brand.test/" } });
});

test("manual Offer becomes stale under the same resolver TTL policy", () => {
  const approved = { ...base, ...buildManualPriceMutation(base, manualInput, "confirm", new Date("2026-08-01T00:00:00Z")) };
  assert.equal(resolvePublishableOffer(approved, now), null);
});

test("clearing a manual source revokes it and restores range fallback", () => {
  const approved = { ...base, ...buildManualPriceMutation(base, manualInput, "confirm", now) };
  const cleared = { ...approved, ...buildManualPriceMutation(approved, {}, "clear", now) };
  assert.equal(cleared.offer_price_status, "revoked");
  assert.equal(resolvePublishableOffer(cleared, now), null);
  assert.equal(cleared.price_min_eur, 10);
  assert.equal(cleared.price_max_eur, 10);
});

test("clearing a manual draft does not revoke an automatic authoritative Offer", () => {
  const mutation = buildManualPriceMutation(base, {}, "clear", now);
  assert.equal("offer_price_status" in mutation, false);
  assert.equal(resolvePublishableOffer({ ...base, ...mutation }, now)?.amount, 20);
});

test("manual correction explicitly replaces the prior approved snapshot without discount semantics", () => {
  const first = { ...base, ...buildManualPriceMutation(base, manualInput, "confirm", now) };
  const corrected = buildManualPriceMutation(first, { ...manualInput, manual_price_amount: 70 }, "confirm", new Date("2026-09-17T13:00:00Z"));
  assert.equal(corrected.offer_price_amount, 70);
  assert.equal(corrected.offer_price_status, "verified_current");
  for (const forbidden of ["reference_price", "discount", "regular_price", "price_min_eur", "price_max_eur"]) assert.equal(forbidden in corrected, false);
});

test("human catalog entry creates a complete authoritative Offer from known Product context", () => {
  const product = { ...base, offer_price_amount: null, offer_price_currency: "", offer_price_verified_at: "", offer_price_source: "", offer_price_source_url: "", offer_price_status: "unverified" };
  const mutation = buildCatalogPriceMutation(product, { exact_price: "52.90", currency: "EUR" }, "save", now);
  assert.deepEqual(mutation, { offer_price_amount: 52.9, offer_price_currency: "EUR", offer_price_verified_at: now.toISOString(), offer_price_source: "manual_external_product_page", offer_price_source_url: "https://brand.test/p", offer_price_status: "verified_current" });
  assert.equal(resolvePublishableOffer({ ...product, ...mutation }, now)?.amount, 52.9);
});

test("unrelated Product edit does not refresh an unchanged exact-price timestamp", () => {
  assert.deepEqual(buildCatalogPriceMutation(base, { exact_price: "20", currency: "EUR" }, "save", now), {});
});

test("explicit confirmation refreshes unchanged price and human correction replaces it", () => {
  const confirmed = buildCatalogPriceMutation(base, { exact_price: 20, currency: "EUR" }, "confirm", now);
  assert.equal(confirmed.offer_price_verified_at, now.toISOString());
  const corrected = buildCatalogPriceMutation(base, { exact_price: 39.9, currency: "EUR" }, "save", now);
  assert.equal(corrected.offer_price_amount, 39.9); assert.equal(corrected.offer_price_source, "manual_external_product_page");
});

test("catalog exact price rejects zero invalid currency and noncanonical source", () => {
  assert.throws(() => buildCatalogPriceMutation(base, { exact_price: 0, currency: "EUR" }, "save", now));
  assert.throws(() => buildCatalogPriceMutation(base, { exact_price: 10, currency: "USD" }, "save", now));
  assert.throws(() => buildCatalogPriceMutation(base, { exact_price: 10, currency: "EUR", source_url: "https://other.test/p" }, "save", now));
});

test("catalog entry neither derives from ranges nor creates history or discount state", () => {
  assert.deepEqual(buildCatalogPriceMutation({ ...base, offer_price_amount: null }, { exact_price: "", currency: "EUR" }, "save", now), {});
  const mutation = buildCatalogPriceMutation(base, { exact_price: 30, currency: "EUR" }, "save", now);
  for (const forbidden of ["price_min_eur", "price_max_eur", "history", "observation", "discount", "reference_price"]) assert.equal(forbidden in mutation, false);
});
