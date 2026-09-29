export const PROMOTION_CONFIDENCE = Object.freeze({
  VERIFIED_PRICE_DROP: "VERIFIED_PRICE_DROP",
  EXPLICIT_SALE: "EXPLICIT_SALE",
  REFERENCE_VALUE_SAVING: "REFERENCE_VALUE_SAVING",
  UNKNOWN: "UNKNOWN",
});

const text = (value) => String(value ?? "").trim();

function evidenceText(value) {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value ?? ""); }
  catch { return ""; }
}

const REFERENCE_VALUE_PATTERN = /(?:combined|component|package|bundle)[-_ ]?(?:value|worth)|(?:recommended|reference|retail)[-_ ]?(?:value|price)|\b(?:msrp|rrp|worth)\b|(?:обща|комбинирана|пакетна|препоръчителна)[-_ ]?(?:стойност|цена)|стойност[-_ ]?на[-_ ]?(?:комплекта|продуктите)/i;
const EXPLICIT_PRICE_TYPE_PATTERN = /(?:list|regular|original|was|strikethrough)[-_ ]?price/i;

export function classifyPromotionSemantics({ activeSale = false, verifiedPriceDrop = false, regularPriceMethod, regularPriceEvidence } = {}) {
  if (verifiedPriceDrop) return PROMOTION_CONFIDENCE.VERIFIED_PRICE_DROP;
  if (!activeSale) return PROMOTION_CONFIDENCE.UNKNOWN;

  const method = text(regularPriceMethod).toLowerCase();
  const evidence = evidenceText(regularPriceEvidence);
  const combined = `${method} ${evidence}`;
  if (REFERENCE_VALUE_PATTERN.test(combined)) return PROMOTION_CONFIDENCE.REFERENCE_VALUE_SAVING;

  if ([
    "semantic_colocated_old_current_pair",
    "semantic_old_current_pair",
    "shopify_compare_at_price_enrichment",
    "woocommerce_regular_sale_price",
    "woocommerce_variation_regular_sale",
    "woocommerce_del_ins",
  ].includes(method)) return PROMOTION_CONFIDENCE.EXPLICIT_SALE;

  if (method === "json_ld_list_price" && EXPLICIT_PRICE_TYPE_PATTERN.test(evidence)) {
    return PROMOTION_CONFIDENCE.EXPLICIT_SALE;
  }

  return PROMOTION_CONFIDENCE.UNKNOWN;
}

export function promotionConsumerEligible(state) {
  return state === PROMOTION_CONFIDENCE.VERIFIED_PRICE_DROP || state === PROMOTION_CONFIDENCE.EXPLICIT_SALE;
}
