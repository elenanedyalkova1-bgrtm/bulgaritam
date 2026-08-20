import { baserowUrl } from "./lib/baserow-url.mjs";

try { process.loadEnvFile?.(); } catch (error) { if (error?.code !== "ENOENT") throw error; }

const token = process.env.BASEROW_API_TOKEN;
const productsTable = process.env.BASEROW_TABLE_ID || "906650";
const brandsTable = process.env.BASEROW_BRANDS_TABLE_ID || "1133942";
const applyBrands = process.argv.includes("--apply-brands");
const applyMetadata = process.argv.includes("--apply-metadata");
if (!token) throw new Error("BASEROW_API_TOKEN is required");

const headers = { Authorization: `Token ${token}`, "Content-Type": "application/json" };
const clean = (value) => String(value ?? "").trim();
const fold = (value) => clean(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("bg").replace(/[^\p{L}\p{N}]+/gu, "");
const validSlug = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean(value));
const placeholder = (value) => !clean(value) || /^(unknown|brand|n\/a|няма|без бранд)$/i.test(clean(value));
const selectValues = (value) => Array.isArray(value) ? value.map((item) => clean(item?.value ?? item)).filter(Boolean) : [];

async function rows(table) {
  const result = []; let next = `/database/rows/table/${table}/?user_field_names=true&size=200`;
  while (next) {
    const response = await fetch(baserowUrl(next), { headers });
    if (!response.ok) throw new Error(`Baserow ${table} read failed: ${response.status}`);
    const page = await response.json(); result.push(...(page.results || [])); next = page.next || "";
  }
  return result;
}

async function write(table, method, body, id = "") {
  const path = `/database/rows/table/${table}/${id ? `${id}/` : ""}?user_field_names=true`;
  const response = await fetch(baserowUrl(path), { method, headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Baserow ${method} ${table}/${id}: ${response.status} ${await response.text()}`);
  return response.json();
}

const uniqueMap = (items, key) => {
  const map = new Map();
  for (const item of items) { const value = key(item); if (!value) continue; const list = map.get(value) || []; list.push(item); map.set(value, list); }
  return map;
};

function brandCandidates(product, brands) {
  const names = uniqueMap(brands, (brand) => fold(brand.brand_name));
  const slugs = uniqueMap(brands, (brand) => fold(brand.brand_slug));
  return [...new Map([...(names.get(fold(product.brand_name)) || []), ...(slugs.get(fold(product.brand_slug)) || [])].map((brand) => [brand.id, brand])).values()];
}

function brandGroups(products) {
  const groups = new Map(); const malformed = [];
  for (const product of products.filter((row) => !row.brand_ref?.length)) {
    if (placeholder(product.brand_name) || !validSlug(product.brand_slug) || !clean(product.name_bg) || !clean(product.slug) || !clean(product.product_url)) { malformed.push(product); continue; }
    const key = fold(product.brand_name);
    const group = groups.get(key) || { key, products: [], names: new Set(), slugs: new Set(), urls: new Set() };
    group.products.push(product); group.names.add(clean(product.brand_name)); group.slugs.add(clean(product.brand_slug));
    if (clean(product.brand_url)) group.urls.add(clean(product.brand_url)); groups.set(key, group);
  }
  return { groups: [...groups.values()], malformed };
}

const materialRules = [
  ["Органичен памук", /\bорганич\p{L}*[- ]+памук\b/iu], ["Мериносова вълна", /\bмеринос?(?:ова)?\s+вълна\b|\bмерино\b/iu],
  ["Естествена кожа", /\bестествена\s+кожа\b|\bкожен[аио]?\b/iu], ["Веган кожа", /\bвеган(?:ска)?\s+кожа\b/iu],
  ["Неръждаема стомана", /\bнеръждаема\s+стомана\b/iu], ["Памук", /\bпамук|памуч/iu], ["Лен", /\bлен(?:ен|ена|ено|ени)?\b/iu],
  ["Вълна", /\bвълна|вълнен/iu], ["Коприна", /\bкоприна|копринен/iu], ["Вискоза", /\bвискоза|вискозен/iu], ["Полиестер", /\bполиестер/iu],
  ["Еластан", /\bеластан/iu], ["Акрил", /\bакрил/iu], ["Коноп", /\bконоп/iu], ["Бамбук", /\bбамбук/iu], ["Дърво", /\bдърв(?:о|ен|ена|ени)\b/iu],
  ["Керамика", /\bкерамик/iu], ["Порцелан", /\bпорцелан/iu], ["Стъкло", /\bстъкло|стъклен/iu], ["Метал", /\bметал(?:ен|на|ни)?\b/iu],
  ["Сребро", /\bсребро\b/iu], ["Злато", /\bзлато\b/iu], ["Хартия", /\bхартия|хартиен/iu], ["Картон", /\bкартон/iu],
];
const colorRules = [["Бяло",/\bбял(?:о|а|и)?\b/iu],["Черно",/\bчер(?:ен|на|но|ни)\b/iu],["Сиво",/\bсив(?:о|а|и)?\b/iu],["Бежово",/\bбежов(?:о|а|и)?\b/iu],["Кафяво",/\bкафяв(?:о|а|и)?\b/iu],["Червено",/\bчервен(?:о|а|и)?\b/iu],["Розово",/\bрозов(?:о|а|и)?\b/iu],["Оранжево",/\bоранжев(?:о|а|и)?\b/iu],["Жълто",/\bжълт(?:о|а|и)?\b/iu],["Зелено",/\bзелен(?:о|а|и)?\b/iu],["Синьо",/\bсин(?:ьо|я|и)?\b/iu],["Лилаво",/\bлилав(?:о|а|и)?\b/iu],["Златисто",/\bзлатист(?:о|а|и)?\b/iu],["Сребристо",/\bсребрист(?:о|а|и)?\b/iu],["Прозрачно",/\bпрозрач(?:но|на|ни)?\b/iu],["Многоцветно",/\bмногоцвет(?:но|ен|на|ни)?\b/iu]];
const audienceRules = [["Унисекс",/\bунисекс\b/iu],["Бебета",/\bбебе|бебешк/iu],["Деца",/\bдет(?:е|ски|ска|ско|ския)\b/iu],["Жени",/\bдамск(?:и|а|о)|\bза жена\b/iu],["Мъже",/\bмъжк(?:и|а|о)|\bза мъж\b/iu]];
const derive = (text, rules) => rules.filter(([, pattern]) => pattern.test(text)).map(([value]) => value);
const deriveMaterials = (text) => {
  const values = derive(text, materialRules);
  const remove = (value) => { const index = values.indexOf(value); if (index >= 0) values.splice(index, 1); };
  if (values.includes("Органичен памук")) remove("Памук");
  if (values.includes("Мериносова вълна")) remove("Вълна");
  return values;
};

const [products, initialBrands] = await Promise.all([rows(productsTable), rows(brandsTable)]);
const unresolved = products.filter((row) => !row.brand_ref?.length);
const { groups, malformed } = brandGroups(products);
const plan = { brands_reused: [], brands_to_create: [], ambiguous: [], malformed: malformed.map((row) => ({ id: row.id, slug: clean(row.slug), brand_name: clean(row.brand_name) })), products_to_link: 0 };

for (const group of groups) {
  const sample = group.products[0]; const candidates = brandCandidates(sample, initialBrands);
  if (candidates.length === 1) { plan.brands_reused.push({ id: candidates[0].id, name: candidates[0].brand_name, products: group.products.length }); plan.products_to_link += group.products.length; continue; }
  if (candidates.length > 1 || group.names.size !== 1 || group.slugs.size !== 1 || group.urls.size > 1) { plan.ambiguous.push({ names: [...group.names], slugs: [...group.slugs], products: group.products.length }); continue; }
  plan.brands_to_create.push({ name: [...group.names][0], slug: [...group.slugs][0], url: [...group.urls][0] || "", products: group.products.length }); plan.products_to_link += group.products.length;
}

const result = { ...plan, created_brand_ids: [], linked_product_ids: [], metadata_updates: [] };
if (applyBrands) {
  for (const group of groups) {
    let latestBrands = await rows(brandsTable);
    let candidates = brandCandidates(group.products[0], latestBrands);
    if (candidates.length > 1 || group.names.size !== 1 || group.slugs.size !== 1 || group.urls.size > 1) continue;
    let brand = candidates[0];
    if (!brand) {
      const sample = group.products[0];
      brand = await write(brandsTable, "POST", { brand_name: [...group.names][0], brand_slug: [...group.slugs][0], brand_url: [...group.urls][0] || "", description_bg: clean(sample.intro_bg), instagram_url: clean(sample.instagram_url), logo_url: clean(sample.brand_logo_url), address: clean(sample.address), is_active: true });
      result.created_brand_ids.push(brand.id);
    }
    for (const product of group.products) {
      await write(productsTable, "PATCH", { brand_ref: [brand.id], brand_name: brand.brand_name, brand_slug: brand.brand_slug, brand_url: brand.brand_url || "" }, product.id);
      result.linked_product_ids.push(product.id);
    }
  }
}

for (const product of products) {
  const text = [product.name_bg, product.tags].map(clean).join(" ");
  const fields = {};
  if (!selectValues(product.materials).length) { const values = deriveMaterials(text); if (values.length) fields.materials = values; }
  if (!selectValues(product.colors).length) { const values = derive(text, colorRules); if (values.length) fields.colors = values; }
  if (!selectValues(product.audience).length) { const values = derive(text, audienceRules); if (values.length) fields.audience = values; }
  if (!Object.keys(fields).length) continue;
  result.metadata_updates.push({ id: product.id, slug: clean(product.slug), fields });
  if (applyMetadata) await write(productsTable, "PATCH", fields, product.id);
}

console.log(JSON.stringify({ mode: { applyBrands, applyMetadata }, initial: { products: products.length, brands: initialBrands.length, unresolved: unresolved.length }, result }, null, 2));
