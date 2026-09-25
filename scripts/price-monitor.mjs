#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { createBaserowCurrentStatePersistence, createGoogleSheetsHistory, monitorBatch, monitorProduct, persistMonitorResults } from "../src/lib/price-monitor/index.mjs";
import { baserowUrl } from "./lib/baserow-url.mjs";

try { process.loadEnvFile?.(); } catch (error) { if (error?.code !== "ENOENT") throw error; }

const args = new Map(process.argv.slice(2).map((arg) => {
  const equal = arg.indexOf("=");
  return equal < 0 ? [arg, true] : [arg.slice(0, equal), arg.slice(equal + 1)];
}));
const value = (name, fallback = "") => args.get(name) === true ? fallback : args.get(name) || fallback;
const command = process.argv[2]?.startsWith("--") ? "batch" : process.argv[2] || "batch";
const tableId = process.env.BASEROW_TABLE_ID || "906650";
const token = process.env.BASEROW_API_TOKEN;
const limit = Math.max(1, Number(value("--limit", command === "batch" ? "20" : "1")) || 20);
const concurrency = Math.min(10, Math.max(1, Number(value("--concurrency", "5")) || 5));
const writeMonitorResults = args.has("--write-monitor-results");

function clean(value) { return String(value ?? "").trim(); }
function productFromRow(row) {
  return {
    product_id: row.id, product_slug: clean(row.slug), product_name: clean(row.name_bg),
    product_url: clean(row.product_url), offer_price_amount: row.offer_price_amount ?? row.exact_price_no_discount ?? null,
    offer_price_currency: row.offer_price_currency ?? row.currency ?? null,
    brand_name: clean(row.brand_name), category: clean(row.category),
  };
}

async function fetchRows() {
  if (!token) throw new Error("BASEROW_API_TOKEN is required for product and batch modes");
  const rows = []; let next = `https://api.baserow.io/api/database/rows/table/${tableId}/?user_field_names=true&size=200`;
  while (next) {
    const response = await fetch(baserowUrl(next), { headers: { Authorization: `Token ${token}` } });
    if (!response.ok) throw new Error(`Baserow read failed: ${response.status} ${response.statusText}`);
    const data = await response.json(); rows.push(...(data.results || [])); next = data.next || "";
  }
  return rows.map(productFromRow).filter((row) => /^https?:\/\//i.test(row.product_url));
}

function diverseSample(rows, count) {
  const selected = []; const usedDomains = new Set(); const usedBrands = new Set();
  const scored = rows.map((row) => ({ row, domain: new URL(row.product_url).hostname.replace(/^www\./, "") }));
  const priced = scored.filter((item) => item.row.offer_price_amount != null && item.row.offer_price_amount !== "");
  const unpriced = scored.filter((item) => item.row.offer_price_amount == null || item.row.offer_price_amount === "");
  const queues = [priced, unpriced];
  while (selected.length < count && queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      const index = queue.findIndex((item) => !usedDomains.has(item.domain));
      if (index >= 0 && selected.length < count) {
        const [item] = queue.splice(index, 1); selected.push(item.row); usedDomains.add(item.domain); usedBrands.add(item.row.brand_name);
      }
    }
  }
  for (const item of scored) {
    if (selected.length >= count) break;
    if (!selected.includes(item.row) && !usedBrands.has(item.row.brand_name)) { selected.push(item.row); usedBrands.add(item.row.brand_name); }
  }
  for (const item of scored) { if (selected.length < count && !selected.includes(item.row)) selected.push(item.row); }
  return selected;
}

let products;
if (command === "url") {
  const url = value("--url") || process.argv[3];
  if (!url) throw new Error("Usage: npm run price-monitor -- url --url=https://example.com/product");
  products = [{ product_url: url }];
} else {
  const rows = await fetchRows();
  if (command === "product") {
    const key = value("--slug") || value("--id") || process.argv[3];
    const product = rows.find((row) => row.product_slug === key || String(row.product_id) === String(key));
    if (!product) throw new Error(`Product not found: ${key}`);
    products = [product];
  } else if (command === "batch") products = diverseSample(rows, limit);
  else throw new Error("Commands: url, product, batch");
}

const results = products.length === 1 ? [await monitorProduct(products[0])] : await monitorBatch(products, { concurrency });
const persistableResults = results.filter((item) => item.product_id != null);
const persistence = await persistMonitorResults(persistableResults, writeMonitorResults ? {
  write: true,
  historyWriter: createGoogleSheetsHistory({
    spreadsheetId: process.env.GOOGLE_PRICE_MONITOR_SPREADSHEET_ID,
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  }),
  currentWriter: createBaserowCurrentStatePersistence({ token, productsTableId: tableId }),
} : { write: false });
persistence.skipped_without_product_id = results.length - persistableResults.length;
const summary = {
  generated_at: new Date().toISOString(), read_only: !writeMonitorResults, checked: results.length,
  exact_detected: results.filter((item) => item.detected_price != null).length,
  high_confidence: results.filter((item) => item.confidence === "high").length,
  statuses: Object.fromEntries([...new Set(results.map((item) => item.status))].map((status) => [status, results.filter((item) => item.status === status).length])),
  extraction_statuses: Object.fromEntries([...new Set(results.map((item) => item.extraction_status))].map((status) => [status, results.filter((item) => item.extraction_status === status).length])),
  catalog_offer_price_rows: products.filter((item) => item.offer_price_amount != null && item.offer_price_amount !== "").length,
  persistence,
  results,
};
const output = value("--output");
if (output) { const absolute = path.resolve(output); await fs.mkdir(path.dirname(absolute), { recursive: true }); await fs.writeFile(absolute, `${JSON.stringify(summary, null, 2)}\n`); }
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
