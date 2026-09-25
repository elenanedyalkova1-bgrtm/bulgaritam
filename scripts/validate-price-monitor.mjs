#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { monitorBatch } from "../src/lib/price-monitor/index.mjs";
import { baserowUrl } from "./lib/baserow-url.mjs";

try { process.loadEnvFile?.(); } catch (error) { if (error?.code !== "ENOENT") throw error; }

const args = new Map(process.argv.slice(2).map((arg) => {
  const at = arg.indexOf("="); return at < 0 ? [arg, true] : [arg.slice(0, at), arg.slice(at + 1)];
}));
const arg = (name, fallback = "") => args.get(name) === true ? fallback : args.get(name) || fallback;
const token = process.env.BASEROW_API_TOKEN;
const tableId = process.env.BASEROW_TABLE_ID || "906650";
const size = Math.max(1, Number(arg("--size", "100")) || 100);
const concurrency = Math.min(10, Math.max(1, Number(arg("--concurrency", "6")) || 6));
const outputPath = path.resolve(arg("--output", "reports/price-monitor-100-before.json"));
const samplePath = arg("--sample") ? path.resolve(arg("--sample")) : "";
if (!token) throw new Error("BASEROW_API_TOKEN is required");

const clean = (value) => String(value ?? "").trim();
const parseAmount = (value) => {
  const normalized = clean(value).replace(/\s/g, "").replace(",", ".");
  const number = normalized ? Number(normalized) : NaN;
  return Number.isFinite(number) ? number : null;
};
const domainOf = (url) => { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return "invalid"; } };
const increment = (map, key, amount = 1) => map.set(key || "(missing)", (map.get(key || "(missing)") || 0) + amount);
const sortedCounts = (map) => [...map].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

async function fetchCatalog() {
  const rows = []; let next = `https://api.baserow.io/api/database/rows/table/${tableId}/?user_field_names=true&size=200`;
  while (next) {
    const response = await fetch(baserowUrl(next), { headers: { Authorization: `Token ${token}` } });
    if (!response.ok) throw new Error(`Baserow read failed: ${response.status} ${response.statusText}`);
    const data = await response.json(); rows.push(...(data.results || [])); next = data.next || "";
  }
  return rows.map((row) => ({
    product_id: row.id, product_slug: clean(row.slug), product_name: clean(row.name_bg), brand_name: clean(row.brand_name),
    category: clean(row.category) || "(missing)", product_url: clean(row.product_url),
    offer_price_amount: row.offer_price_amount ?? row.exact_price_no_discount ?? null,
    offer_price_currency: clean(row.offer_price_currency ?? row.currency) || null,
    offer_price_verified: row.offer_price_verified === true || ["true", "1", "yes", "verified"].includes(clean(row.offer_price_verified ?? row.price_verified_status).toLowerCase()),
    is_active: row.is_active === undefined || !["false", "0", "no"].includes(clean(row.is_active).toLowerCase()),
  })).filter((row) => row.is_active && /^https?:\/\//i.test(row.product_url)).map((row) => ({ ...row, domain: domainOf(row.product_url) }));
}

function catalogCensus(rows) {
  const domains = new Map(); const brands = new Map(); const categories = new Map(); const offerStatus = new Map();
  for (const row of rows) {
    if (!domains.has(row.domain)) domains.set(row.domain, { domain: row.domain, products: 0, brands: new Set(), categories: new Set(), verified_offer: 0, no_verified_offer: 0 });
    const group = domains.get(row.domain); group.products += 1; group.brands.add(row.brand_name); group.categories.add(row.category);
    if (row.offer_price_verified && parseAmount(row.offer_price_amount) != null) group.verified_offer += 1; else group.no_verified_offer += 1;
    increment(brands, row.brand_name); increment(categories, row.category);
    increment(offerStatus, row.offer_price_verified && parseAmount(row.offer_price_amount) != null ? "verified" : "not_verified");
  }
  const perDomain = [...domains.values()].map((item) => ({ ...item, brands: [...item.brands].sort(), categories: [...item.categories].sort() })).sort((a, b) => b.products - a.products || a.domain.localeCompare(b.domain));
  return {
    products_with_external_url: rows.length, unique_external_domains: domains.size,
    domains_with_one_product: perDomain.filter((item) => item.products === 1).length,
    domains_with_multiple_products: perDomain.filter((item) => item.products > 1).length,
    products_with_verified_offer_price: offerStatus.get("verified") || 0,
    products_without_verified_offer_price: offerStatus.get("not_verified") || 0,
    products_per_domain: perDomain, products_per_brand: sortedCounts(brands), products_per_category: sortedCounts(categories),
  };
}

function selectSample(rows, limit) {
  const categoryCounts = new Map(); rows.forEach((row) => increment(categoryCounts, row.category));
  const groups = new Map();
  for (const row of rows) { if (!groups.has(row.domain)) groups.set(row.domain, []); groups.get(row.domain).push(row); }
  const representatives = [...groups].map(([domain, products]) => {
    products.sort((a, b) => Number(b.offer_price_verified) - Number(a.offer_price_verified) || (categoryCounts.get(a.category) || 0) - (categoryCounts.get(b.category) || 0) || a.product_id - b.product_id);
    return { domain, products, row: products[0], weight: products.length };
  });
  const byCategory = new Map();
  for (const item of representatives) { if (!byCategory.has(item.row.category)) byCategory.set(item.row.category, []); byCategory.get(item.row.category).push(item); }
  for (const queue of byCategory.values()) queue.sort((a, b) => b.weight - a.weight || a.domain.localeCompare(b.domain));
  const selected = [];
  while (selected.length < limit && [...byCategory.values()].some((queue) => queue.length)) {
    for (const category of [...byCategory.keys()].sort((a, b) => (categoryCounts.get(a) || 0) - (categoryCounts.get(b) || 0) || a.localeCompare(b))) {
      const item = byCategory.get(category).shift(); if (item && selected.length < limit) selected.push(item.row);
    }
  }
  if (selected.length < limit) {
    const remaining = [...groups.values()].flat().filter((row) => !selected.some((item) => item.product_id === row.product_id));
    remaining.sort((a, b) => (groups.get(b.domain)?.length || 0) - (groups.get(a.domain)?.length || 0) || a.product_id - b.product_id);
    selected.push(...remaining.slice(0, limit - selected.length));
  }
  return selected;
}

function mode(values) {
  const counts = new Map(); values.filter((value) => value != null).forEach((value) => increment(counts, String(value)));
  return sortedCounts(counts)[0]?.key || null;
}

function outcome(result) { return result.extraction_status || result.status; }
function isExact(result) { return result.detected_price != null && ["high", "medium", "low"].includes(result.confidence); }
function pct(number, denominator) { return denominator ? Number((number * 100 / denominator).toFixed(2)) : null; }

function summaries(results, census) {
  const counts = (predicate) => results.filter(predicate).length;
  const domainMap = new Map();
  for (const result of results) { if (!domainMap.has(result.domain)) domainMap.set(result.domain, []); domainMap.get(result.domain).push(result); }
  const domains = [...domainMap].map(([domain, items]) => ({
    domain, brands: [...new Set(items.map((item) => item.brand_name))].sort(), products_tested: items.length,
    detected_platform: mode(items.map((item) => item.detected_platform)), successful_exact_price_extractions: items.filter(isExact).length,
    high_confidence: items.filter((item) => item.confidence === "high").length, medium_confidence: items.filter((item) => item.confidence === "medium").length,
    low_confidence: items.filter((item) => item.confidence === "low").length, ambiguous: items.filter((item) => outcome(item) === "ambiguous").length,
    not_detected: items.filter((item) => outcome(item) === "not_detected").length, browser_required: items.filter((item) => outcome(item) === "browser_required").length,
    blocked: items.filter((item) => item.status === "blocked").length, dead_url: items.filter((item) => item.status === "dead_url").length,
    redirected: items.filter((item) => item.redirected).length, error: items.filter((item) => item.status === "error").length,
    dominant_extraction_tier: mode(items.map((item) => item.extraction_tier)), dominant_extraction_method: mode(items.map((item) => item.extraction_method)),
  })).sort((a, b) => b.products_tested - a.products_tested || a.domain.localeCompare(b.domain));
  const failures = results.filter((item) => !isExact(item));
  const groupFailures = (keyFn) => sortedCounts(failures.reduce((map, item) => (increment(map, keyFn(item)), map), new Map()));
  const catalogWeights = new Map(census.products_per_domain.map((item) => [item.domain, item.products]));
  let weightedExact = 0; let weightedHigh = 0; let representedProducts = 0;
  for (const domain of domains) {
    const weight = catalogWeights.get(domain.domain) || 0; representedProducts += weight;
    weightedExact += weight * domain.successful_exact_price_extractions / domain.products_tested;
    weightedHigh += weight * domain.high_confidence / domain.products_tested;
  }
  return {
    overall: {
      checked: results.length, unique_domains_tested: domains.length, exact_price: counts(isExact), exact_price_rate: pct(counts(isExact), results.length),
      high_confidence: counts((item) => item.confidence === "high"), high_confidence_rate: pct(counts((item) => item.confidence === "high"), results.length),
      medium_confidence: counts((item) => item.confidence === "medium"), low_confidence: counts((item) => item.confidence === "low"),
      ambiguous: counts((item) => outcome(item) === "ambiguous"), ambiguous_rate: pct(counts((item) => outcome(item) === "ambiguous"), results.length),
      not_detected: counts((item) => outcome(item) === "not_detected"), not_detected_rate: pct(counts((item) => outcome(item) === "not_detected"), results.length),
      browser_required: counts((item) => outcome(item) === "browser_required"), browser_required_rate: pct(counts((item) => outcome(item) === "browser_required"), results.length),
      blocked: counts((item) => item.status === "blocked"), dead_url: counts((item) => item.status === "dead_url"), error: counts((item) => item.status === "error"), redirected: counts((item) => item.redirected),
    },
    platform_distribution: sortedCounts(results.reduce((map, item) => (increment(map, item.detected_platform), map), new Map())),
    extraction_tier_distribution: sortedCounts(results.reduce((map, item) => (increment(map, item.extraction_tier == null ? "none" : `tier_${item.extraction_tier}`), map), new Map())),
    extraction_method_distribution: sortedCounts(results.reduce((map, item) => (increment(map, item.extraction_method || "none"), map), new Map())),
    domain_analysis: domains,
    verified_offer_validation: {
      products: results.filter((item) => item.offer_price_verified),
      total: counts((item) => item.offer_price_verified), matches: counts((item) => item.offer_price_verified && item.price_changed === false),
      changed: counts((item) => item.offer_price_verified && item.price_changed === true),
      unable: counts((item) => item.offer_price_verified && item.price_changed == null),
    },
    failures: {
      total: failures.length, by_outcome: groupFailures((item) => outcome(item) || "error"), by_domain: groupFailures((item) => item.domain),
      by_platform: groupFailures((item) => item.detected_platform), by_reason: groupFailures((item) => item.error_reason || "other"),
      by_tier: groupFailures((item) => item.extraction_tier == null ? "none" : `tier_${item.extraction_tier}`),
    },
    weighted_catalog_estimate: {
      represented_catalog_products: representedProducts, total_catalog_products: census.products_with_external_url,
      represented_catalog_share: pct(representedProducts, census.products_with_external_url),
      weighted_exact_rate_within_represented_domains: pct(weightedExact, representedProducts),
      weighted_high_confidence_rate_within_represented_domains: pct(weightedHigh, representedProducts),
      conservative_full_catalog_exact_lower_bound: pct(weightedExact, census.products_with_external_url),
      untested_domain_products: census.products_with_external_url - representedProducts,
    },
  };
}

const catalog = await fetchCatalog();
const census = catalogCensus(catalog);
let sample;
if (samplePath) {
  const stored = JSON.parse(await fs.readFile(samplePath, "utf8")); const manifest = stored.sampling?.sample || stored.sample || stored;
  const ids = new Set(manifest.map((item) => Number(item.product_id ?? item)));
  sample = catalog.filter((item) => ids.has(Number(item.product_id)));
  if (sample.length !== ids.size) throw new Error(`Stored sample contains ${ids.size} ids but ${sample.length} still exist in catalog`);
} else sample = selectSample(catalog, size);

const monitored = await monitorBatch(sample, { concurrency });
const results = monitored.map((result, index) => ({
  ...result, brand_name: sample[index].brand_name, category: sample[index].category, domain: sample[index].domain,
  offer_price_verified: sample[index].offer_price_verified, existing_offer_price: parseAmount(sample[index].offer_price_amount),
  existing_offer_currency: sample[index].offer_price_currency,
}));
const report = {
  generated_at: new Date().toISOString(), mode: "read-only", writes_performed: false,
  sampling: { strategy: "domain-first, category-round-robin, verified-offer preference within domain; repeat domains only if unique domains are insufficient", requested: size, selected: sample.length, unique_domains: new Set(sample.map((item) => item.domain)).size, sample: sample.map((item) => ({ product_id: item.product_id, slug: item.product_slug, domain: item.domain, brand: item.brand_name, category: item.category, offer_price_verified: item.offer_price_verified })) },
  catalog: census, results, ...summaries(results, census),
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ output: outputPath, catalog: { products: census.products_with_external_url, domains: census.unique_external_domains, single: census.domains_with_one_product, multiple: census.domains_with_multiple_products, verified_offer: census.products_with_verified_offer_price, no_verified_offer: census.products_without_verified_offer_price }, sampling: report.sampling, overall: report.overall, weighted_catalog_estimate: report.weighted_catalog_estimate }, null, 2)}\n`);
