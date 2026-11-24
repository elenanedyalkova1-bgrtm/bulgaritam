#!/usr/bin/env node
import fs from "node:fs/promises";
import { createGoogleSheetsHistory, observationId } from "../src/lib/price-monitor/index.mjs";
try { process.loadEnvFile?.(); } catch (error) { if (error?.code !== "ENOENT") throw error; }
const file = process.argv.find((v) => v.endsWith(".json"));
if (!file) throw new Error("Supply a reviewed recovery JSON file");
const source = JSON.parse(await fs.readFile(file,"utf8"));
const rows = source.observations.map((r) => ({ ...r, brand_name:r.brand, previous_offer_price:r.previous_verified_price }));
if (rows.some((r,i) => observationId(r) !== source.observations[i].observation_id)) throw new Error("Recovery observation ID mismatch");
const client = createGoogleSheetsHistory({ spreadsheetId:process.env.GOOGLE_PRICE_MONITOR_SPREADSHEET_ID, serviceAccountEmail:process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, privateKey:process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY });
if (process.argv.includes("--apply")) console.log(JSON.stringify(await client.append(rows),null,2));
else {
  const ids = new Set(((await client.getValues("Price History!M2:M")).values || []).map((r)=>String(r[0] || "")));
  console.log(JSON.stringify({ mode:"dry-run", total:rows.length, existing:rows.filter((r)=>ids.has(observationId(r))).length, missing:rows.filter((r)=>!ids.has(observationId(r))).length },null,2));
}
