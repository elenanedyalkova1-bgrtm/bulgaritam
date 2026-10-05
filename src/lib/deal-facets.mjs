const clean = (value) => String(value ?? "").trim();
export const DEAL_CATEGORY_ORDER = ["Аксесоари","Деца и бебе","Дом и интериор","Домашни любимци","Книги, игри и творчество","Здраве и грижа","Козметика","Облекло","Спорт и туризъм","Храна и напитки"];

export function deriveDealFacets(deals) {
  const brands = new Map(); const categories = new Set(); const materials = new Set(); const ingredients = new Set();
  for (const deal of Array.isArray(deals) ? deals : []) {
    const brandId = clean(deal?.brand_id); const brand = clean(deal?.brand);
    if (brandId && brand) brands.set(brandId, brand);
    const category=clean(deal?.deal_category); if(DEAL_CATEGORY_ORDER.includes(category)) categories.add(category);
    for (const value of Array.isArray(deal?.materials) ? deal.materials : []) { const item = clean(value); if (item) materials.add(item); }
    for (const value of Array.isArray(deal?.ingredients) ? deal.ingredients : []) { const item = clean(value); if (item) ingredients.add(item); }
  }
  const sort = (a, b) => a[1].localeCompare(b[1], "bg");
  return {
    category: DEAL_CATEGORY_ORDER.filter((value)=>categories.has(value)).map((value)=>[value,value]),
    brand: [...brands.entries()].sort(sort),
    material: [...materials].map((value) => [value, value]).sort(sort),
    ingredient: [...ingredients].map((value) => [value, value]).sort(sort),
  };
}
