#!/usr/bin/env node
import { createGoogleSheetsHistory, DERIVED_SHEET_FORMULAS, PRICE_HISTORY_HEADERS, PRICE_HISTORY_TAB, PRICES_HEADERS, PRICES_TAB, PRICE_TIMELINE_TAB } from "../src/lib/price-monitor/google-sheets-history.mjs";

try { process.loadEnvFile?.(); } catch (error) { if (error?.code !== "ENOENT") throw error; }
const apply = process.argv.includes("--apply");
const plan = {
  mode: apply ? "apply" : "dry-run", tabs: [PRICE_HISTORY_TAB, PRICES_TAB, PRICE_TIMELINE_TAB],
  history_headers: PRICE_HISTORY_HEADERS, prices_headers: PRICES_HEADERS, prices_formulas: DERIVED_SHEET_FORMULAS.prices,
  timeline_formula: DERIVED_SHEET_FORMULAS.timeline.A1, runtime_writes: `${PRICE_HISTORY_TAB} append only`,
};
if (!apply) { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }

const client = createGoogleSheetsHistory({
  spreadsheetId: process.env.GOOGLE_PRICE_MONITOR_SPREADSHEET_ID,
  serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
});
let metadata = await client.metadata(); const existing = new Set(metadata.sheets.map((sheet) => sheet.properties.title));
const missing = plan.tabs.filter((title) => !existing.has(title));
if (missing.length) await client.batchUpdate(missing.map((title) => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } })));
metadata = await client.metadata();
const currentHeader = (await client.getValues(`${PRICE_HISTORY_TAB}!A1:Q1`)).values?.[0] || [];
const legacyHeader = PRICE_HISTORY_HEADERS.slice(0, 13);
const currentLegacy = currentHeader.slice(0, 13);
const currentExtension = currentHeader.slice(13).filter((value) => String(value ?? "").trim());
if (currentHeader.length && JSON.stringify(currentLegacy) !== JSON.stringify(legacyHeader)) throw new Error("Price History legacy headers differ from the required append-only contract; refusing to overwrite them");
if (currentExtension.length && JSON.stringify(currentHeader) !== JSON.stringify(PRICE_HISTORY_HEADERS)) throw new Error("Price History extension headers differ from the required append-only contract; refusing to overwrite them");
if (!currentHeader.length) await client.updateValues(`${PRICE_HISTORY_TAB}!A1:Q1`, [PRICE_HISTORY_HEADERS]);
else if (!currentExtension.length) await client.updateValues(`${PRICE_HISTORY_TAB}!N1:Q1`, [PRICE_HISTORY_HEADERS.slice(13)]);
await client.updateValues(`${PRICES_TAB}!A1:M1`, [PRICES_HEADERS]);
for (const [cell, formula] of Object.entries(DERIVED_SHEET_FORMULAS.prices)) await client.updateValues(`${PRICES_TAB}!${cell}`, [[formula]]);
await client.updateValues(`${PRICE_TIMELINE_TAB}!A1`, [[DERIVED_SHEET_FORMULAS.timeline.A1]]);
const ids = Object.fromEntries(metadata.sheets.map((sheet) => [sheet.properties.title, sheet.properties.sheetId]));
await client.batchUpdate(plan.tabs.flatMap((title) => [
  { updateSheetProperties: { properties: { sheetId: ids[title], gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
  { repeatCell: { range: { sheetId: ids[title], startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.18, green: 0.36, blue: 0.29 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true } } }, fields: "userEnteredFormat(backgroundColor,textFormat)" } },
]));
await client.batchUpdate([{ repeatCell: { range: { sheetId: ids[PRICES_TAB], startRowIndex: 1, startColumnIndex: 12, endColumnIndex: 13 }, cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "0.00" } } }, fields: "userEnteredFormat.numberFormat" } }]);
console.log(JSON.stringify({ ...plan, spreadsheet_id: process.env.GOOGLE_PRICE_MONITOR_SPREADSHEET_ID, created_tabs: missing, configured: true }, null, 2));
