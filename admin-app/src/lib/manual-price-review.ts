import { buildManualPriceMutation, evaluateManualPriceReference, MANUAL_PRICE_REVIEW_DUE_DAYS, MANUAL_PRICE_REFERENCE_DAYS, normalizedProductUrl } from "../../../src/lib/verified-offer";

export const MANUAL_PRICE_REVIEW_OUTCOMES = ["confirmed_unchanged", "change_found", "unable_to_verify", "source_unavailable"] as const;
export type ManualPriceReviewOutcome = typeof MANUAL_PRICE_REVIEW_OUTCOMES[number];

const text = (value: unknown) => String(value ?? "").trim();
const selectValue = (value: unknown) => text(value && typeof value === "object" && "value" in value ? (value as any).value : value);
const truthy = (value: unknown) => value === true || ["true", "1", "yes", "y"].includes(text(value).toLowerCase());

export function manualPriceReviewQueueState(product: Record<string, any>, now: Date | number = new Date()) {
  const currentMs = now instanceof Date ? now.getTime() : Number(now);
  const verifiedMs = Date.parse(text(product.manual_price_verified_at));
  if (!Number.isFinite(currentMs) || !Number.isFinite(verifiedMs) || verifiedMs > currentMs) return null;
  const ageDays = (currentMs - verifiedMs) / 86_400_000;
  return {
    ageDays,
    state: ageDays >= MANUAL_PRICE_REFERENCE_DAYS ? "overdue" as const : ageDays >= MANUAL_PRICE_REVIEW_DUE_DAYS ? "due" as const : "current" as const,
    due: ageDays >= MANUAL_PRICE_REVIEW_DUE_DAYS,
  };
}

function assertCompleteManualProvenance(product: Record<string, any>) {
  const evaluation = evaluateManualPriceReference({ ...product, price_check_status: "not_detected", offer_price_status: "unverified", price_change_detected: false }, new Date(text(product.manual_price_verified_at) || 0));
  if (!evaluation.reference && evaluation.rejectionReason !== "invalid_manual_verification_date") throw new Error(`Manual price provenance is not complete (${evaluation.rejectionReason}).`);
  if (!normalizedProductUrl(product.manual_price_source_url) || normalizedProductUrl(product.manual_price_source_url) !== normalizedProductUrl(product.product_url)) throw new Error("Manual price source does not match the canonical Product URL.");
}

export function buildManualPriceReviewMutation(product: Record<string, any>, outcome: ManualPriceReviewOutcome, now: Date | number = new Date()): Record<string, unknown> {
  if (!MANUAL_PRICE_REVIEW_OUTCOMES.includes(outcome)) throw new Error("Unknown manual price review outcome.");
  const currentMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(currentMs)) throw new Error("Manual review time is invalid.");
  assertCompleteManualProvenance(product);
  const reviewedAt = new Date(currentMs).toISOString();
  const audit = { manual_price_last_reviewed_at: reviewedAt, manual_price_review_outcome: outcome };
  if (outcome === "confirmed_unchanged") {
    const monitorStatus = selectValue(product.price_check_status);
    const offerStatus = selectValue(product.offer_price_status);
    const extractionOutcome = selectValue(product.price_extraction_outcome || product.extraction_outcome);
    const manualCurrency = text(product.manual_price_currency).toUpperCase();
    const detectedCurrency = text(product.price_detected_currency).toUpperCase();
    if (monitorStatus === "changed" || offerStatus === "change_pending" || truthy(product.price_change_detected)) throw new Error("Positive price-change evidence must be resolved before confirming an unchanged manual price.");
    if (monitorStatus === "ambiguous" || /variation|range|currency_conflict/i.test(extractionOutcome)) throw new Error("Ambiguous or variation price evidence cannot be confirmed unchanged.");
    if (monitorStatus === "dead_url" || offerStatus === "source_unavailable") throw new Error("An unavailable source cannot be confirmed unchanged.");
    if (monitorStatus === "redirected") throw new Error("Canonical redirect identity must be reviewed before confirmation.");
    if (detectedCurrency && detectedCurrency !== manualCurrency) throw new Error("Currency mismatch must be reviewed before confirmation.");
    return {
      ...buildManualPriceMutation(product, {
        manual_price_amount: product.manual_price_amount,
        manual_price_currency: product.manual_price_currency,
        manual_price_verified_at: product.manual_price_verified_at,
        manual_price_source_url: product.manual_price_source_url,
      }, "confirm", currentMs),
      ...audit,
    };
  }
  if (outcome === "change_found") return { ...audit, offer_price_status: "change_pending" };
  if (outcome === "source_unavailable") return { ...audit, offer_price_status: "source_unavailable" };
  return audit;
}
