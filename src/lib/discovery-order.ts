/** Stable build-time membership: imports cannot push a date-sorted cluster to the top.
 * Keep this local to discovery feeds; other consumers retain their existing order.
 */
export function discoveryProducts<T extends { slug: string; brand_slug?: string; brand_name?: string }>(products: T[]): T[] {
  const score = (text: string) => {
    let hash = 2166136261;
    for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return hash >>> 0;
  };
  const remaining = [...products].sort((a, b) => score(a.slug) - score(b.slug) || a.slug.localeCompare(b.slug));
  const result: T[] = [];
  const recent: string[] = [];
  while (remaining.length) {
    const brand = (p: T) => p.brand_slug || p.brand_name || p.slug;
    const candidate = remaining.findIndex((p) => !recent.includes(brand(p)));
    const [product] = remaining.splice(Math.max(0, candidate), 1);
    result.push(product);
    recent.push(brand(product));
    if (recent.length > 4) recent.shift();
  }
  return result;
}
