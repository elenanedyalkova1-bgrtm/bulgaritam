import fs from "node:fs";
import path from "node:path";
import specs from "../src/data/primary-cluster-landings.json";
import { loadProducts } from "../src/lib/products";
import { productMatchesStructuredState, serializeSeoLandingState } from "../src/lib/seo-landings";

type Spec = (typeof specs)[number];
type Result = {
  primary_keyword: string;
  url: string;
  structured_state: Spec["structuredState"];
  expected_product_count: number;
  rendered_product_count: number;
  unexpected_products: string[];
  missing_products: string[];
  status: "PASS" | "FAIL";
};

const products = await loadProducts();
const results: Result[] = [];

for (const spec of specs) {
  const structuredState = spec.structuredState as Record<string, string[]>;
  const stateKey = serializeSeoLandingState(structuredState);
  const expected = stateKey
    ? products.filter((product) => productMatchesStructuredState(product, structuredState))
    : [];
  const expectedIds = new Set(expected.filter((product) => product.image_urls.some(Boolean)).map((product) => String(product.id)));
  const htmlPath = path.join("dist", spec.path.replace(/^\/+|\/+$/g, ""), "index.html");
  const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, "utf8") : "";
  const renderedIds = new Set(Array.from(html.matchAll(/data-product-id="([^"]+)"/g), (match) => match[1]));
  const unexpected = [...renderedIds].filter((id) => !expectedIds.has(id));
  const missing = [...expectedIds].filter((id) => !renderedIds.has(id));
  const routeValid = Boolean(html) && (html.match(/<h1\b/g) || []).length === 1 &&
    (html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] || "").endsWith(spec.path);
  const status = stateKey && routeValid && unexpected.length === 0 && missing.length === 0 ? "PASS" : "FAIL";
  results.push({
    primary_keyword: spec.primaryKeyword,
    url: spec.path,
    structured_state: spec.structuredState,
    expected_product_count: expectedIds.size,
    rendered_product_count: renderedIds.size,
    unexpected_products: unexpected,
    missing_products: missing,
    status,
  });
}

const report = {
  total_landings: results.length,
  pass: results.filter((result) => result.status === "PASS").length,
  fail: results.filter((result) => result.status === "FAIL").length,
  results,
};

fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync("reports/seo-product-membership.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ total_landings: report.total_landings, pass: report.pass, fail: report.fail }, null, 2));
if (report.fail) process.exitCode = 1;
