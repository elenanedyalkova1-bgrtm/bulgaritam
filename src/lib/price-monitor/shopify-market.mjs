import { normalizeCurrency } from "./normalize.mjs";

const text = (value) => String(value ?? "").trim();

export function shopifyMarketUrl(url, country = "BG") {
  const target = new URL(url);
  target.searchParams.set("country", text(country).toUpperCase());
  return target.toString();
}

export function extractShopifyMarketEvidence(html = "") {
  const currencyMatch = String(html).match(/Shopify\.currency\s*=\s*(\{[^;]+\})/i);
  let activeCurrency = null;
  let rate = null;
  if (currencyMatch) {
    try {
      const value = JSON.parse(currencyMatch[1]);
      activeCurrency = normalizeCurrency(value?.active) || null;
      rate = Number.isFinite(Number(value?.rate)) ? Number(value.rate) : null;
    } catch {}
  }
  const countryMatch = String(html).match(/Shopify\.country\s*=\s*["']([A-Z]{2})["']/i);
  return {
    requested_country: null,
    shopify_country: countryMatch?.[1]?.toUpperCase() || null,
    shopify_active_currency: activeCurrency,
    shopify_currency_rate: rate,
  };
}

export function validateShopifyMarket({ evidence, intendedCountry = "BG", detectedCurrency, regularCurrency, expectedCurrency } = {}) {
  const intended = text(intendedCountry).toUpperCase();
  const detected = normalizeCurrency(detectedCurrency) || null;
  const regular = normalizeCurrency(regularCurrency) || null;
  const expected = normalizeCurrency(expectedCurrency) || null;
  const active = normalizeCurrency(evidence?.shopify_active_currency) || null;
  const country = text(evidence?.shopify_country).toUpperCase() || null;
  let reason = null;
  if (country && country !== intended) reason = "shopify_market_conflict";
  else if (active && detected && active !== detected) reason = "shopify_currency_conflict";
  else if (detected && regular && detected !== regular) reason = "shopify_current_regular_currency_conflict";
  else if (active && regular && active !== regular) reason = "shopify_regular_currency_conflict";
  else if (expected && detected && expected !== detected) reason = "shopify_expected_currency_conflict";
  return {
    valid: !reason,
    reason,
    intended_country: intended,
    expected_currency: expected,
    detected_currency: detected,
    regular_currency: regular,
    ...evidence,
  };
}
