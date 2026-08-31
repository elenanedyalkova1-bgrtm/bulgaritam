import fs from "node:fs/promises";
import path from "node:path";
import { BRANDS_TABLE, PRODUCTS_TABLE, listRows, updateRow } from "../src/lib/baserow";
import { brandMirrorFields, productBrandIdentity, resolveBrandIdentity, resolveOrCreateBrand } from "../src/lib/brand-sync";
import { PRODUCT_TAXONOMY, selectValue } from "../src/lib/product-taxonomy";

const apply = process.argv.includes("--apply");
const products = await listRows(PRODUCTS_TABLE);
const brands = await listRows(BRANDS_TABLE);
const brandsById = new Map(brands.map((brand) => [Number(brand.id), brand]));
const summary = { productsScanned: products.length, alreadyCorrectlyLinked: 0, linksRepairable: 0, newBrandsThatWouldBeCreated: 0, ambiguousCases: 0, unresolvedCases: 0, appliedRepairs: 0 };
const plannedBrandKeys = new Set<string>();
const details: any[] = [];

for (const product of products) {
  const linkedId = Number(product.brand_ref?.[0]?.id || 0);
  if (linkedId && brandsById.has(linkedId)) { summary.alreadyCorrectlyLinked++; continue; }
  const identity = { ...productBrandIdentity(product), preferredBrandId: undefined };
  const resolution = resolveBrandIdentity(brands, identity);
  if (resolution.status === "resolved") summary.linksRepairable++;
  else if (resolution.status === "missing") {
    summary.linksRepairable++;
    plannedBrandKeys.add(resolution.key);
  } else if (resolution.status === "ambiguous") summary.ambiguousCases++;
  else summary.unresolvedCases++;
  details.push({ product_id: product.id, product_name: product.name_bg || "", product_slug: product.slug || "", brand_name: product.brand_name || "", brand_slug: product.brand_slug || "", status: resolution.status, message: "message" in resolution ? resolution.message : "" });
  if (apply && (resolution.status === "resolved" || resolution.status === "missing")) {
    const brand = await resolveOrCreateBrand(identity);
    await updateRow(PRODUCTS_TABLE, product.id, brandMirrorFields(brand));
    summary.appliedRepairs++;
  }
}
summary.newBrandsThatWouldBeCreated = plannedBrandKeys.size;

const taxonomyProblems = products.flatMap((product) => {
  const category = selectValue(product.category);
  const subcategory = selectValue(product.subcategory);
  const productType = selectValue(product.product_type);
  const tree = PRODUCT_TAXONOMY[category as keyof typeof PRODUCT_TAXONOMY] as Record<string, readonly string[]> | undefined;
  const problem = !tree
    ? "Unknown category"
    : !tree[subcategory]
      ? "Subcategory is not valid under the current category"
      : productType && !tree[subcategory].includes(productType)
        ? "Product type is not valid under the current category/subcategory"
        : "";
  return problem ? [{ product_id: product.id, product_name: product.name_bg || "", current_category: category, current_subcategory: subcategory, current_product_type: productType, problem, suggested_review: "Review structured Product taxonomy manually" }] : [];
});

const csvEscape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const reportDir = path.resolve(process.cwd(), "../reports");
await fs.mkdir(reportDir, { recursive: true });
const headers = ["product_id", "product_name", "current_category", "current_subcategory", "current_product_type", "problem", "suggested_review"];
await fs.writeFile(path.join(reportDir, "invalid-product-taxonomy.csv"), [headers.join(","), ...taxonomyProblems.map((row) => headers.map((key) => csvEscape(row[key as keyof typeof row])).join(","))].join("\n") + "\n");

console.log(JSON.stringify({ mode: apply ? "APPLY" : "DRY_RUN", brandSync: summary, brandCases: details, invalidTaxonomyProducts: taxonomyProblems.length, taxonomyReport: path.join(reportDir, "invalid-product-taxonomy.csv") }, null, 2));
