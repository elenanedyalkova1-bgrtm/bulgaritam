export type ProductPriceRange = {
  price_min_eur?: number | null;
  price_max_eur?: number | null;
};

export type BudgetRangeKey = "0-25" | "25-50" | "50-100" | "100+";

const finite = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const productOverlapsBudget = (
  product: ProductPriceRange,
  bucketMin: number | null,
  bucketMax: number | null,
) => {
  const rawMin = finite(product.price_min_eur);
  const rawMax = finite(product.price_max_eur);
  const productMin = rawMin ?? rawMax;
  const productMax = rawMax ?? rawMin;
  if (productMin === null || productMax === null) return false;
  if (bucketMax !== null && productMin > bucketMax) return false;
  if (bucketMin !== null && productMax < bucketMin) return false;
  return true;
};

export const priceRangesForProduct = (product: ProductPriceRange): BudgetRangeKey[] => [
  productOverlapsBudget(product, null, 25) ? "0-25" as const : null,
  productOverlapsBudget(product, 25, 50) ? "25-50" as const : null,
  productOverlapsBudget(product, 50, 100) ? "50-100" as const : null,
  productOverlapsBudget(product, 100, null) ? "100+" as const : null,
].filter((value): value is BudgetRangeKey => value !== null);
