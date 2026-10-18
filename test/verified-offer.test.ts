import assert from "node:assert/strict";
import test from "node:test";
import { buildCatalogPriceMutation, buildManualPriceMutation, candidateFromMonitorResult, evaluateManualPriceReference, formatManualPriceReferenceAmount, formatVerifiedOfferAmount, offerJsonLd, resolveManualPriceReference, resolvePublicManualPriceReference, resolvePublishableOffer } from "../src/lib/verified-offer";
import { buildAuthoritativeRenewal } from "../src/lib/price-monitor/persistence.mjs";
import { buildManualPriceReviewMutation, manualPriceReviewQueueState } from "../admin-app/src/lib/manual-price-review";
import { validateManualPriceReviewSchema } from "../admin-app/src/lib/repositories";

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

test("safe monitor renewal restores publishability without weakening resolver gates", () => {
  const stale = { ...base, offer_price_verified_at: "2026-08-01T00:00:00Z" };
  assert.equal(resolvePublishableOffer(stale, now), null);
  const result = {
    product_id: 42, product_name: "Product", product_url: base.product_url, final_url: base.product_url,
    checked_at: "2026-09-17T11:00:00.000Z", http_status: 200, detected_price: 20, currency: "EUR",
    extraction_method: "json_ld_product_offer", confidence: "high", status: "verified", extraction_status: "verified",
    extraction_outcome: null, detected_platform: "unknown", redirected: false, price_changed: false, currency_mismatch: false,
    previous_offer_price: 20, previous_offer_currency: "EUR", previous_offer_status: "verified_current",
    previous_offer_source: "monitor_json_ld_product_offer", previous_offer_source_url: base.product_url,
    observation_origin: "fresh_monitor_check",
    evidence: { path: "$.offers.price", candidate_count: 1, diagnostics: { selected_product: { score: 100 }, page_identity: { canonical: base.product_url, title: "Product" } } },
  };
  const renewal = buildAuthoritativeRenewal(result);
  assert.equal(resolvePublishableOffer({ ...stale, ...renewal }, now)?.amount, 20);
  assert.equal(resolvePublishableOffer({ ...stale, ...renewal, offer_price_status: "change_pending" }, now), null);
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

const manualFailure = {
  ...base,
  manual_price_amount: 59,
  manual_price_currency: "EUR",
  manual_price_verified_at: "2026-07-01T12:00:00.000Z",
  manual_price_source_url: "https://brand.test/p?manual=1",
  price_check_status: "not_detected",
  price_change_detected: false,
  offer_price_status: "stale",
  offer_price_amount: 59,
  offer_price_currency: "EUR",
  offer_price_source: "manual_external_product_page",
  offer_price_source_url: "https://brand.test/p?manual=1",
};

test("manual reference resolves only as transparent reference inside the 90-day boundary", () => {
  const at60 = new Date("2026-08-30T12:00:00.000Z");
  const exact90 = new Date("2026-09-29T12:00:00.000Z");
  assert.equal(resolveManualPriceReference(manualFailure, at60)?.reviewState, "due");
  assert.equal(resolveManualPriceReference(manualFailure, exact90)?.reviewState, "overdue");
  assert.equal(formatManualPriceReferenceAmount(resolveManualPriceReference(manualFailure, exact90)!), "59 €");
  assert.equal(resolveManualPriceReference(manualFailure, new Date("2026-09-29T12:00:00.001Z")), null);
});

test("static public rendering reserves the weekly interval while the canonical 90-day boundary stays inclusive", () => {
  const day83 = new Date("2026-09-22T12:00:00.000Z");
  const day89 = new Date("2026-09-28T12:00:00.000Z");
  const day90 = new Date("2026-09-29T12:00:00.000Z");
  const day91 = new Date("2026-09-30T12:00:00.000Z");
  assert.ok(resolvePublicManualPriceReference(manualFailure, day83));
  assert.equal(resolvePublicManualPriceReference(manualFailure, day89), null);
  assert.equal(resolvePublicManualPriceReference(manualFailure, day90), null);
  assert.equal(resolvePublicManualPriceReference(manualFailure, day91), null);
  assert.ok(resolveManualPriceReference(manualFailure, day89));
  assert.ok(resolveManualPriceReference(manualFailure, day90));
  assert.equal(resolveManualPriceReference(manualFailure, day91), null);
});

test("manual reference fails closed for incomplete provenance and unsafe monitor evidence", () => {
  assert.equal(evaluateManualPriceReference({ ...manualFailure, manual_price_source_url: "" }, now).rejectionReason, "incomplete_manual_provenance");
  assert.equal(evaluateManualPriceReference({ ...manualFailure, price_check_status: "changed" }, now).rejectionReason, "positive_price_change_evidence");
  assert.equal(evaluateManualPriceReference({ ...manualFailure, offer_price_status: "change_pending" }, now).rejectionReason, "positive_price_change_evidence");
  assert.equal(evaluateManualPriceReference({ ...manualFailure, price_check_status: "ambiguous", price_extraction_outcome: "variation_range" }, now).rejectionReason, "ambiguous_price_evidence");
  assert.equal(evaluateManualPriceReference({ ...manualFailure, price_detected_currency: "USD" }, now).rejectionReason, "detected_currency_mismatch");
  assert.equal(evaluateManualPriceReference({ ...manualFailure, price_check_status: "dead_url" }, now).rejectionReason, "source_unavailable");
  assert.equal(evaluateManualPriceReference({ ...manualFailure, price_check_status: "redirected" }, now).rejectionReason, "canonical_identity_unconfirmed");
  assert.equal(evaluateManualPriceReference({ ...manualFailure, price_check_status: "error" }, now).rejectionReason, "unproven_fetch_error");
  assert.ok(resolveManualPriceReference({ ...manualFailure, price_check_status: "error", price_error_reason: "network timeout exhausted" }, now));
});

test("manual reference and catalog ranges never become a publishable Offer or discount evidence", () => {
  const referenceOnly = { ...manualFailure, offer_price_amount: null, offer_price_verified_at: "", offer_price_source: "" };
  assert.ok(resolveManualPriceReference(referenceOnly, now));
  assert.equal(resolvePublishableOffer(referenceOnly, now), null);
  assert.equal("regular_price" in resolveManualPriceReference(referenceOnly, now)!, false);
  assert.equal(referenceOnly.price_min_eur, 10);
  assert.equal(referenceOnly.price_max_eur, 10);
});

test("fresh publishable Offer remains authoritative over any manual reference", () => {
  const withManual = { ...base, ...manualFailure, offer_price_status: "verified_current", offer_price_verified_at: now.toISOString() };
  assert.equal(resolvePublishableOffer(withManual, now)?.amount, 59);
});

test("manual review queue becomes due at day 60 and overdue at day 90", () => {
  assert.deepEqual(manualPriceReviewQueueState(manualFailure, new Date("2026-08-30T12:00:00Z"))?.state, "due");
  assert.deepEqual(manualPriceReviewQueueState(manualFailure, new Date("2026-09-29T12:00:00Z"))?.state, "overdue");
});

test("failed manual reviews record audit metadata but never renew verification", () => {
  for (const outcome of ["unable_to_verify", "change_found", "source_unavailable"] as const) {
    const mutation = buildManualPriceReviewMutation(manualFailure, outcome, now);
    assert.equal(mutation.manual_price_last_reviewed_at, now.toISOString());
    assert.equal(mutation.manual_price_review_outcome, outcome);
    assert.equal("manual_price_verified_at" in mutation, false);
    assert.equal("offer_price_verified_at" in mutation, false);
    const permitted = outcome === "unable_to_verify"
      ? ["manual_price_last_reviewed_at", "manual_price_review_outcome"]
      : ["manual_price_last_reviewed_at", "manual_price_review_outcome", "offer_price_status"];
    assert.deepEqual(Object.keys(mutation).sort(), permitted.sort());
  }
});

test("intentional unchanged manual review renews provenance through the existing atomic helper", () => {
  const mutation = buildManualPriceReviewMutation(manualFailure, "confirmed_unchanged", now);
  assert.equal(mutation.manual_price_verified_at, now.toISOString());
  assert.equal(mutation.offer_price_verified_at, now.toISOString());
  assert.equal(mutation.offer_price_amount, 59);
  assert.equal(mutation.offer_price_status, "verified_current");
});

test("manual unchanged confirmation is blocked by changed ambiguous unavailable and currency evidence", () => {
  for (const unsafe of [
    { price_check_status: "changed" },
    { price_check_status: "ambiguous", price_extraction_outcome: "variation_range" },
    { price_check_status: "dead_url" },
    { price_check_status: "redirected" },
    { price_detected_currency: "USD" },
  ]) assert.throws(() => buildManualPriceReviewMutation({ ...manualFailure, ...unsafe }, "confirmed_unchanged", now));
});

test("matching fresh high-confidence verified evidence permits review without replacing an automatic Offer", () => {
  const automatic = {
    ...manualFailure,
    price_check_status: "verified", price_confidence: "high", price_extraction_method: "json_ld_product_offer",
    price_detected_amount: 59, price_detected_currency: "EUR", price_last_checked_at: now.toISOString(),
    offer_price_status: "verified_current", offer_price_source: "monitor_json_ld_product_offer",
  };
  const mutation = buildManualPriceReviewMutation(automatic, "confirmed_unchanged", now);
  assert.equal(mutation.manual_price_verified_at, now.toISOString());
  for (const field of ["offer_price_amount", "offer_price_currency", "offer_price_verified_at", "offer_price_source", "offer_price_source_url", "offer_price_status"]) {
    assert.equal(field in mutation, false);
  }
});

test("verified evidence cannot confirm mismatching manual amount or incomplete stale evidence", () => {
  const verified = {
    ...manualFailure,
    price_check_status: "verified", price_confidence: "high", price_extraction_method: "json_ld_product_offer",
    price_detected_amount: 59, price_detected_currency: "EUR", price_last_checked_at: now.toISOString(),
  };
  assert.throws(() => buildManualPriceReviewMutation({ ...verified, price_detected_amount: 58 }, "confirmed_unchanged", now), /contradicts/i);
  assert.throws(() => buildManualPriceReviewMutation({ ...verified, price_confidence: "medium" }, "confirmed_unchanged", now), /incomplete or stale/i);
  assert.throws(() => buildManualPriceReviewMutation({ ...verified, price_last_checked_at: "2026-08-01T00:00:00Z" }, "confirmed_unchanged", now), /incomplete or stale/i);
  assert.throws(() => buildManualPriceReviewMutation({ ...verified, price_extraction_method: "" }, "confirmed_unchanged", now), /incomplete or stale/i);
});

test("manual confirmation never overwrites a different approved authoritative Offer", () => {
  assert.throws(() => buildManualPriceReviewMutation({ ...manualFailure, offer_price_amount: 60 }, "confirmed_unchanged", now), /different approved/i);
  assert.throws(() => buildManualPriceReviewMutation({ ...manualFailure, offer_price_currency: "BGN" }, "confirmed_unchanged", now), /different approved/i);
  assert.throws(() => buildManualPriceReviewMutation({ ...manualFailure, offer_price_source_url: "https://brand.test/other" }, "confirmed_unchanged", now), /different approved/i);
});

test("manual review schema validation requires exact types time support and option set", () => {
  const valid = [
    { name: "manual_price_last_reviewed_at", type: "date", date_include_time: true },
    { name: "manual_price_review_outcome", type: "single_select", select_options: [
      { value: "confirmed_unchanged" }, { value: "change_found" }, { value: "unable_to_verify" }, { value: "source_unavailable" },
    ] },
  ];
  assert.doesNotThrow(() => validateManualPriceReviewSchema(valid));
  assert.throws(() => validateManualPriceReviewSchema(valid.filter((field) => field.name !== "manual_price_last_reviewed_at")));
  assert.throws(() => validateManualPriceReviewSchema(valid.map((field) => field.name === "manual_price_last_reviewed_at" ? { ...field, type: "text" } : field)));
  assert.throws(() => validateManualPriceReviewSchema(valid.map((field) => field.name === "manual_price_last_reviewed_at" ? { ...field, date_include_time: false } : field)));
  assert.throws(() => validateManualPriceReviewSchema(valid.map((field) => field.name === "manual_price_review_outcome" ? { ...field, type: "text" } : field)));
  assert.throws(() => validateManualPriceReviewSchema(valid.map((field) => field.name === "manual_price_review_outcome" ? { ...field, select_options: [{ value: "confirmed_unchanged" }] } : field)));
  assert.throws(() => validateManualPriceReviewSchema(valid.map((field) => field.name === "manual_price_review_outcome" ? { ...field, select_options: [...field.select_options!, { value: "unexpected" }] } : field)));
});
