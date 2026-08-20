import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const token = process.env.BASEROW_API_TOKEN;
const productsTable = process.env.BASEROW_TABLE_ID || "906650";
const brandsTable = process.env.BASEROW_BRANDS_TABLE_ID || "1133942";
const dist = path.resolve("dist");
const healthReportPath = process.env.PRODUCT_HEALTH_REPORT_PATH;
if (!token) throw new Error("BASEROW_API_TOKEN is required");

async function rows(table) {
  const result = [];
  let next = `https://api.baserow.io/api/database/rows/table/${table}/?user_field_names=true&size=200`;
  while (next) {
    const response = await fetch(next, { headers: { Authorization: `Token ${token}` } });
    if (!response.ok) throw new Error(`Baserow ${table}: ${response.status} ${await response.text()}`);
    const page = await response.json();
    result.push(...(page.results || []));
    next = page.next || null;
  }
  return result;
}

const clean = value => String(value ?? "").trim();
const productActive = value => ["true", "1", "yes", "y"].includes(clean(value).toLowerCase());
const pageSlugs = directory => fs.existsSync(directory)
  ? fs.readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isDirectory() && fs.existsSync(path.join(directory, entry.name, "index.html"))).map(entry => entry.name).sort()
  : [];

for (const required of ["index.html", "sitemap-index.xml", ".htaccess", "p", "brand"]) {
  if (!fs.existsSync(path.join(dist, required))) throw new Error(`Missing required build output: dist/${required}`);
}

const [products, brands] = await Promise.all([rows(productsTable), rows(brandsTable)]);
const healthExcluded = healthReportPath
  ? new Set((JSON.parse(fs.readFileSync(healthReportPath, "utf8")).confirmed_broken_image_products || []).map(item => clean(item.slug)).filter(Boolean))
  : new Set();
const activeBrands = brands.filter(row => row.is_active === true && clean(row.brand_slug) && clean(row.brand_name));
const activeBrandIds = new Set(activeBrands.map(row => Number(row.id)));
const activeProducts = products.filter(row => productActive(row.is_active) && clean(row.slug) && clean(row.name_bg) && activeBrandIds.has(Number(row.brand_ref?.[0]?.id)) && !healthExcluded.has(clean(row.slug)));
const expectedProducts = activeProducts.map(row => clean(row.slug)).sort();
const expectedBrands = activeBrands.filter(brand => activeProducts.some(product => Number(product.brand_ref?.[0]?.id) === Number(brand.id))).map(row => clean(row.brand_slug)).sort();
const generatedProducts = pageSlugs(path.join(dist, "p"));
const generatedBrands = pageSlugs(path.join(dist, "brand"));

function reconcile(label, expected, generated) {
  const expectedSet = new Set(expected);
  const generatedSet = new Set(generated);
  const missing = expected.filter(value => !generatedSet.has(value));
  const stale = generated.filter(value => !expectedSet.has(value));
  if (missing.length || stale.length) throw new Error(`${label} mismatch. Missing: ${missing.join(", ") || "none"}. Stale: ${stale.join(", ") || "none"}.`);
}
reconcile("Product pages", expectedProducts, generatedProducts);
reconcile("Brand pages", expectedBrands, generatedBrands);

const manifest = {
  generated_at: new Date().toISOString(),
  commit: process.env.BUILD_COMMIT_SHA || "local-dry-run",
  products: generatedProducts.length,
  brands: generatedBrands.length,
  product_paths: generatedProducts.map(slug => `/p/${slug}/`),
  brand_paths: generatedBrands.map(slug => `/brand/${slug}/`),
  index_sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(dist, "index.html"))).digest("hex"),
  health_excluded_products: [...healthExcluded].sort(),
};
fs.writeFileSync(path.join(dist, "deploy-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ verified: true, products: manifest.products, brands: manifest.brands, manifest: "dist/deploy-manifest.json" }));
