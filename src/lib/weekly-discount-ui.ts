export type DiscountPriceBucket = "under-25" | "25-50" | "50-100" | "over-100";
export type DiscountSort = "discount-desc" | "price-asc" | "price-desc";

export type DiscountFilterItem = {
  row_id: string;
  product_type: string;
  facets: string[];
  current_price: number;
  discount_percent: number;
  original_index: number;
};

export type DiscountFilterState = {
  productTypes: string[];
  priceBucket: DiscountPriceBucket | "all";
  facets: string[];
};

export const PRICE_BUCKET_LABELS: Record<DiscountPriceBucket, string> = {
  "under-25": "До 25 €",
  "25-50": "25–50 €",
  "50-100": "50–100 €",
  "over-100": "Над 100 €",
};

export function normalizeFacet(value: string) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("bg-BG");
}

export function combineStructuredFacets(materials: string[] = [], ingredients: string[] = []) {
  const labels = new Map<string, string>();
  [...materials, ...ingredients].forEach((value) => {
    const label = String(value || "").trim().replace(/\s+/g, " ");
    const key = normalizeFacet(label);
    if (key && !labels.has(key)) labels.set(key, label);
  });
  return [...labels.values()].sort((a, b) => a.localeCompare(b, "bg"));
}

export function priceBucketFor(price: number): DiscountPriceBucket | null {
  if (!Number.isFinite(price) || price < 0) return null;
  if (price < 25) return "under-25";
  if (price < 50) return "25-50";
  if (price <= 100) return "50-100";
  return "over-100";
}

function matches(item: DiscountFilterItem, state: DiscountFilterState, omitted?: "productType" | "price" | "facet") {
  const typeMatch = omitted === "productType" || !state.productTypes.length || state.productTypes.includes(item.product_type);
  const priceMatch = omitted === "price" || state.priceBucket === "all" || priceBucketFor(item.current_price) === state.priceBucket;
  const itemFacets = new Set(item.facets.map(normalizeFacet));
  const facetMatch = omitted === "facet" || !state.facets.length || state.facets.some((value) => itemFacets.has(normalizeFacet(value)));
  return typeMatch && priceMatch && facetMatch;
}

export function filterDiscountItems(items: DiscountFilterItem[], state: DiscountFilterState) {
  return items.filter((item) => matches(item, state));
}

export function sortDiscountItems(items: DiscountFilterItem[], sort: DiscountSort) {
  return [...items].sort((a, b) => {
    if (sort === "price-asc") return a.current_price - b.current_price || a.original_index - b.original_index;
    if (sort === "price-desc") return b.current_price - a.current_price || a.original_index - b.original_index;
    return b.discount_percent - a.discount_percent || a.original_index - b.original_index;
  });
}

export function discountFacetCounts(items: DiscountFilterItem[], state: DiscountFilterState) {
  const count = (values: string[]) => values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
  return {
    productTypes: count(items.filter((item) => matches(item, state, "productType")).map((item) => item.product_type).filter(Boolean)),
    priceBuckets: count(items.filter((item) => matches(item, state, "price")).map((item) => priceBucketFor(item.current_price)).filter((value): value is DiscountPriceBucket => Boolean(value))),
    facets: count(items.filter((item) => matches(item, state, "facet")).flatMap((item) => item.facets.map(normalizeFacet)).filter(Boolean)),
  };
}
