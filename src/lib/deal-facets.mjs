const clean = (value) => String(value ?? "").trim();

export function deriveDealFacets(deals) {
  const brands = new Map(); const materials = new Set(); const ingredients = new Set();
  for (const deal of Array.isArray(deals) ? deals : []) {
    const brandId = clean(deal?.brand_id); const brand = clean(deal?.brand);
    if (brandId && brand) brands.set(brandId, brand);
    for (const value of Array.isArray(deal?.materials) ? deal.materials : []) { const item = clean(value); if (item) materials.add(item); }
    for (const value of Array.isArray(deal?.ingredients) ? deal.ingredients : []) { const item = clean(value); if (item) ingredients.add(item); }
  }
  const sort = (a, b) => a[1].localeCompare(b[1], "bg");
  return {
    brand: [...brands.entries()].sort(sort),
    material: [...materials].map((value) => [value, value]).sort(sort),
    ingredient: [...ingredients].map((value) => [value, value]).sort(sort),
  };
}
