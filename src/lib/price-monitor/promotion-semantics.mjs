export const PROMOTION_CONFIDENCE = Object.freeze({
  VERIFIED_PRICE_DROP: "VERIFIED_PRICE_DROP",
  EXPLICIT_SALE: "EXPLICIT_SALE",
  REFERENCE_VALUE_SAVING: "REFERENCE_VALUE_SAVING",
  UNKNOWN: "UNKNOWN",
});

export const MINIMUM_DISCOUNT = Object.freeze({ amount: 0.5, percent: 1 });

const text = (value) => String(value ?? "").trim();

function evidenceText(value) {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value ?? ""); }
  catch { return ""; }
}

const REFERENCE_VALUE_PATTERN = /(?:combined|component|package|bundle)[-_ ]?(?:value|worth)|(?:recommended|reference|retail)[-_ ]?(?:value|price)|\b(?:msrp|rrp|worth)\b|(?:обща|комбинирана|пакетна|препоръчителна)[-_ ]?(?:стойност|цена)|стойност[-_ ]?на[-_ ]?(?:комплекта|продуктите)/i;
const EXPLICIT_PRICE_TYPE_PATTERN = /(?:list|regular|original|was|strikethrough)[-_ ]?price/i;
const BUNDLE_PATTERN = /(?:\b(?:bundle|gift\s*box|kit|set|package)\b|комплект|подаръч(?:на|ен)\s+кутия|кутия|пакет|(?:^|\s)сет(?:\s|$))/i;

const decodedVisibleText = (html = "") => String(html)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ").replace(/&euro;|&#8364;/gi, "€")
  .replace(/&amp;/gi, "&").replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/\s+/g, " ").trim();

export function extractPromotionSemanticEvidence({ html = "", productName = "", regularPriceMethod = "" } = {}) {
  const visible = decodedVisibleText(html); const combined = `${productName} ${visible}`;
  const temporary = [];
  if (/само\s+сега|limited[- ]time|this\s+week/i.test(visible)) temporary.push("limited_time_label");
  if (/промоционална\s+цена|промо\s+цена|promotional\s+price/i.test(visible)) temporary.push("promotional_price_label");
  if (/(?:^|\s)sale(?:\s|$)|отстъпка|намален(?:ие|а)\b|save\s+\d+(?:[.,]\d+)?\s*%/i.test(visible)) temporary.push("sale_or_discount_label");
  if (/original\s+price\s+was|текущата\s+цена\s+е|стара\s+цена/i.test(visible)
    || /(?:old_current|del_ins|price-old)/i.test(regularPriceMethod)) temporary.push("explicit_old_current_labels");
  if (/редовна\s+цена[\s\S]{0,120}(?:промоционална|промо)\s+цена/i.test(visible)) temporary.push("regular_promotional_pair");

  const reference = [];
  if (REFERENCE_VALUE_PATTERN.test(visible)) reference.push("combined_or_reference_value_label");
  if (/(?:спест(?:и|яваш|ете)|save)\s+(?:€|£|\$|\d)[^.!?]{0,90}(?:комплект|пакет|кутия|bundle|set|package)|(?:комплект|пакет|кутия|bundle|set|package)[^.!?]{0,90}(?:спест(?:и|яваш|ете)|save)\s+(?:€|£|\$|\d)/i.test(visible)) reference.push("quantified_bundle_saving_claim");
  return { product_is_bundle: BUNDLE_PATTERN.test(combined), temporary_sale_signals: [...new Set(temporary)], reference_value_signals: [...new Set(reference)] };
}

function parsedEvidence(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") return {};
  try { return JSON.parse(value); } catch { return {}; }
}

export function classifyPromotionSemantics({ activeSale = false, verifiedPriceDrop = false, regularPriceMethod, regularPriceEvidence, productName = "" } = {}) {
  if (verifiedPriceDrop) return PROMOTION_CONFIDENCE.VERIFIED_PRICE_DROP;
  if (!activeSale) return PROMOTION_CONFIDENCE.UNKNOWN;

  const method = text(regularPriceMethod).toLowerCase();
  const parsed = parsedEvidence(regularPriceEvidence); const semantic = parsed?.promotion_semantics || {};
  if (Array.isArray(semantic.reference_value_signals) && semantic.reference_value_signals.length) return PROMOTION_CONFIDENCE.REFERENCE_VALUE_SAVING;
  const legacyEvidence = parsed && Object.keys(parsed).length
    ? evidenceText(Object.fromEntries(Object.entries(parsed).filter(([key]) => key !== "promotion_semantics")))
    : evidenceText(regularPriceEvidence);
  if (REFERENCE_VALUE_PATTERN.test(`${method} ${legacyEvidence}`)) return PROMOTION_CONFIDENCE.REFERENCE_VALUE_SAVING;
  const bundle = semantic.product_is_bundle === true || BUNDLE_PATTERN.test(productName);
  if (bundle) {
    if (Array.isArray(semantic.temporary_sale_signals) && semantic.temporary_sale_signals.length) return PROMOTION_CONFIDENCE.EXPLICIT_SALE;
    return PROMOTION_CONFIDENCE.UNKNOWN;
  }

  if ([
    "semantic_colocated_old_current_pair",
    "semantic_old_current_pair",
    "shopify_compare_at_price_enrichment",
    "woocommerce_regular_sale_price",
    "woocommerce_variation_regular_sale",
    "woocommerce_del_ins",
  ].includes(method)) return PROMOTION_CONFIDENCE.EXPLICIT_SALE;

  if (method === "json_ld_list_price" && EXPLICIT_PRICE_TYPE_PATTERN.test(legacyEvidence)) {
    return PROMOTION_CONFIDENCE.EXPLICIT_SALE;
  }

  return PROMOTION_CONFIDENCE.UNKNOWN;
}

export function promotionConsumerEligible(state) {
  return state === PROMOTION_CONFIDENCE.VERIFIED_PRICE_DROP || state === PROMOTION_CONFIDENCE.EXPLICIT_SALE;
}
