import type { Product } from "./products";
import { getTaxonomyForProduct } from "./taxonomy";

export type Recommendations = { sameBrand: Product[]; related: Product[] };
type Taxonomy = { categoryKeys: readonly string[]; subcategoryKeys: readonly string[] };
type Candidate = { product: Product; relevance: number; hash: number };
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const identity = (p: Product) => `${p.row_id ?? p.id ?? ""}|${p.slug}`;
const hash = (value: string) => {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
};
const tags = (p: Product) => (Array.isArray(p.tags) ? p.tags : String(p.tags || "").split(","))
  .map(t => String(t).trim().toLowerCase()).filter(Boolean);
const shared = (a: readonly string[], b: readonly string[]) => b.filter(key => a.includes(key)).length;

/** Allocate the complete graph in fixed rounds, never using previous-build exposure. */
export function buildRecommendationPlan(
  catalogue: readonly Product[],
  taxonomyFor: (p: Product) => Taxonomy = getTaxonomyForProduct,
): ReadonlyMap<string, Recommendations> {
  // Existing catalogue rows can share a URL. Allocate once per destination,
  // choosing its representative by stable ID rather than input array order.
  const products = [...new Map([...catalogue]
    .sort((a, b) => compare(identity(b), identity(a)))
    .map(p => [p.slug, p])).values()]
    .sort((a, b) => hash(a.slug) - hash(b.slug) || compare(identity(a), identity(b)));
  const plan = new Map<string, Recommendations>();
  const exposure = new Map<string, number>();
  const metadata = new Map(products.map(p => {
    const taxonomy = taxonomyFor(p);
    return [p.slug, { ...taxonomy, tags: tags(p),
      categories: taxonomy.categoryKeys.filter(k => k !== "gifts"),
      subcategories: taxonomy.subcategoryKeys.filter(k => !k.startsWith("gifts_")) }];
  }));
  for (const p of products) {
    plan.set(p.slug, { sameBrand: [], related: [] });
    exposure.set(p.slug, 0);
  }
  const pools = new Map(products.map(source => {
    const a = metadata.get(source.slug)!;
    const sameBrand: Candidate[] = [], related: Candidate[] = [];
    for (const product of products) {
      if (product.slug === source.slug) continue;
      const b = metadata.get(product.slug)!;
      const tier = source.product_type && source.product_type === product.product_type ? 3
        : shared(a.subcategories, b.subcategories) ? 2 : shared(a.categories, b.categories) ? 1 : 0;
      const tieHash = hash(`${source.slug}|${product.slug}`);
      if (source.brand_slug && source.brand_slug === product.brand_slug) {
        sameBrand.push({ product, relevance: tier, hash: tieHash });
      } else {
        const categoryCount = shared(a.categoryKeys, b.categoryKeys);
        const tagCount = shared(a.tags, b.tags);
        const score = (categoryCount ? 5 + (categoryCount - 1) * 2 : 0) + tagCount * 3;
        // Keep the existing positive-score gate; gifts alone is not relevance.
        if (score > 0 && (tier > 0 || tagCount > 0)) related.push({ product, relevance: score, hash: tieHash });
      }
    }
    return [source.slug, { sameBrand, related }];
  }));
  for (let slot = 0; slot < 4; slot++) {
    for (const source of products) {
      for (const block of ["sameBrand", "related"] as const) {
        const selected = plan.get(source.slug)![block];
        let best: Candidate | undefined;
        for (const candidate of pools.get(source.slug)![block]) {
          if (selected.some(p => p.slug === candidate.product.slug)) continue;
          if (!best || candidate.relevance > best.relevance || (candidate.relevance === best.relevance && (
            exposure.get(candidate.product.slug)! < exposure.get(best.product.slug)! ||
            (exposure.get(candidate.product.slug) === exposure.get(best.product.slug) && (
              candidate.hash < best.hash || (candidate.hash === best.hash && compare(identity(candidate.product), identity(best.product)) < 0)
            ))
          ))) best = candidate;
        }
        if (best) {
          selected.push(best.product);
          exposure.set(best.product.slug, exposure.get(best.product.slug)! + 1);
        }
      }
    }
  }
  return plan;
}

// loadProducts returns one immutable catalogue snapshot per build. Cache its plan,
// not exposure counters, so page rendering order cannot influence allocation.
const plans = new WeakMap<readonly Product[], ReadonlyMap<string, Recommendations>>();
export function getRecommendationPlan(catalogue: readonly Product[]) {
  let plan = plans.get(catalogue);
  if (!plan) {
    plan = buildRecommendationPlan(catalogue);
    plans.set(catalogue, plan);
  }
  return plan;
}
