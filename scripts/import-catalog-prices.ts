#!/usr/bin/env node
import fs from "node:fs";
import { planCatalogPriceImport } from "../admin-app/src/lib/catalog-price-import";

try { process.loadEnvFile?.(); } catch (error: any) { if (error?.code !== "ENOENT") throw error; }
const args = process.argv.slice(2); const fileIndex = args.indexOf("--file");
const file = fileIndex >= 0 ? args[fileIndex + 1] : ""; const apply = args.includes("--apply");
if (!file) throw new Error("Usage: npm run prices:import -- --file prices.csv [--apply]");
const token = process.env.BASEROW_API_TOKEN; const table = process.env.BASEROW_TABLE_ID || "906650";
if (!token) throw new Error("BASEROW_API_TOKEN is required.");
const headers = { Authorization: `Token ${token}`, "Content-Type": "application/json" };
const request = async (url: string, init: RequestInit = {}) => {
  const parsed = new URL(url, "https://api.baserow.io"); const safe = `https://api.baserow.io${parsed.pathname}${parsed.search}`;
  const response = await fetch(safe, { ...init, headers: { ...headers, ...(init.headers || {}) } }); const body = await response.text();
  if (!response.ok) throw new Error(`Baserow ${response.status}: ${body.slice(0, 500)}`); return body ? JSON.parse(body) : null;
};
const products: Record<string, any>[] = []; let next: string | null = `/api/database/rows/table/${table}/?user_field_names=true&size=200`;
while (next) { const page = await request(next); products.push(...(page.results || [])); next = page.next || null; }
const plan = planCatalogPriceImport(fs.readFileSync(file, "utf8"), products, new Date());
if (apply && !plan.valid) throw new Error(`Import validation failed; no writes performed. ${JSON.stringify(plan.errors)}`);
const written: number[] = [];
if (apply) for (const item of plan.planned) { await request(`/api/database/rows/table/${table}/${item.product_id}/?user_field_names=true`, { method: "PATCH", body: JSON.stringify(item.mutation) }); written.push(item.product_id); }
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", writes_performed: apply, input_file: file, input_rows: plan.rows, valid: plan.valid, planned: plan.planned, errors: plan.errors, written_product_ids: written, untouched_products: products.length - written.length, history_observations_created: 0 }, null, 2));
