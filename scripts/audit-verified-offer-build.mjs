#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] || "dist/p");
const outputArg = process.argv.find((value) => value.startsWith("--output="));
const outputPath = outputArg ? path.resolve(outputArg.slice(9)) : null;
const files = [];
async function walk(directory) { for (const entry of await fs.readdir(directory, { withFileTypes: true })) { const full = path.join(directory, entry.name); if (entry.isDirectory()) await walk(full); else if (entry.name === "index.html") files.push(full); } }
await walk(root);
const audit = { total_product_pages: files.length, product_json_ld_entities: 0, offer_entities: 0, pages_without_offer: 0, malformed_json_ld: 0, malformed_offers: 0, offers_produced_from_range_fields: 0, offers_without_matching_visible_exact_price: 0, offers_with_currency_mismatch: 0, offers_from_ambiguous_range_variant_evidence: 0, offers_with_non_publishable_status: 0, offers_without_valid_external_url: 0, offers_without_canonical_brand_seller: 0, offers_with_fabricated_availability: 0, offers_where_seller_is_bulgaritam: 0 };
const failures = [];
const decode = (value) => value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
for (const file of files) {
  const html = await fs.readFile(file, "utf8"); let pageOffers = 0;
  const productEntities = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const parsed = JSON.parse(match[1]); for (const entity of (Array.isArray(parsed) ? parsed : [parsed])) if (entity?.["@type"] === "Product") productEntities.push(entity); }
    catch { audit.malformed_json_ld += 1; failures.push({ file, reason: "malformed_json_ld" }); }
  }
  audit.product_json_ld_entities += productEntities.length;
  for (const entity of productEntities) {
    if (!entity.offers) continue; pageOffers += 1; audit.offer_entities += 1;
    const offer = entity.offers; const visible = html.match(/data-verified-offer-price[^>]*>([\s\S]*?)<\/[^>]+>/i); const visibleText = visible ? decode(visible[1]) : "";
    const visibleAmount = Number((visibleText.match(/[\d\s.,]+/)?.[0] || "").replace(/\s/g, "").replace(",", "."));
    const visibleCurrency = visibleText.match(/\b[A-Z]{3}\b/)?.[0] || "";
    const source = html.match(/data-verified-offer-source="([^"]+)"/i)?.[1] || "";
    const allowedSources = new Set(["monitor_json_ld_product_offer", "monitor_product_meta", "monitor_schema_microdata", "manual_external_product_page"]);
    if (!source) audit.offers_produced_from_range_fields += 1;
    if (!visible || visibleAmount !== Number(offer.price)) audit.offers_without_matching_visible_exact_price += 1;
    if (!visible || visibleCurrency !== offer.priceCurrency) audit.offers_with_currency_mismatch += 1;
    if (!allowedSources.has(source)) audit.offers_from_ambiguous_range_variant_evidence += 1;
    if (!html.includes('data-verified-offer-status="verified_current"')) audit.offers_with_non_publishable_status += 1;
    let validExternalUrl = true;
    try { const url = new URL(offer.url); if (!["http:", "https:"].includes(url.protocol) || /(^|\.)bulgaritam\.bg$/i.test(url.hostname)) throw new Error(); } catch { validExternalUrl = false; audit.offers_without_valid_external_url += 1; }
    if (!offer.seller?.name || offer.seller?.["@type"] !== "Organization") audit.offers_without_canonical_brand_seller += 1;
    if (/^българитъм$|^bulgaritam$/i.test(String(offer.seller?.name || ""))) audit.offers_where_seller_is_bulgaritam += 1;
    if ("availability" in offer) audit.offers_with_fabricated_availability += 1;
    if (!(Number(offer.price) > 0) || !/^[A-Z]{3}$/.test(String(offer.priceCurrency || "")) || !validExternalUrl || !offer.seller?.name || offer.seller?.["@type"] !== "Organization") audit.malformed_offers += 1;
  }
  if (!pageOffers) audit.pages_without_offer += 1;
}
const report = { generated_at: new Date().toISOString(), build_root: root, audit, failures };
if (outputPath) await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
