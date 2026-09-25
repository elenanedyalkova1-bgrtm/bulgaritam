#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { buildDiscountReport, createGoogleSheetsHistory } from "../src/lib/price-monitor/index.mjs";

try { process.loadEnvFile?.(); } catch (error) { if (error?.code !== "ENOENT") throw error; }
const args = new Map(process.argv.slice(2).map((value) => {
  const at = value.indexOf("="); return at < 0 ? [value, true] : [value.slice(0, at), value.slice(at + 1)];
}));
const arg = (name) => args.get(name) === true ? "" : String(args.get(name) || "").trim();
const week_start = arg("--week-start"); const week_end = arg("--week-end"); const output = arg("--output");
if (!week_start || !week_end) throw new Error("Usage: report:discounts -- --week-start=<ISO timestamp> --week-end=<ISO timestamp> [--output=local.json]");

const history = createGoogleSheetsHistory({
  spreadsheetId: process.env.GOOGLE_PRICE_MONITOR_SPREADSHEET_ID,
  serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
});
const rows = (await history.getValues("Price History!A2:Q")).values || [];
const report = buildDiscountReport(rows, { week_start, week_end });
if (output) {
  const absolute = path.resolve(output);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify(report, null, 2));
