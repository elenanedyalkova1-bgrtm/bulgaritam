#!/usr/bin/env node
try { process.loadEnvFile?.(); } catch (error) { if (error?.code !== "ENOENT") throw error; }
const API = "https://api.baserow.io/api";
const PRODUCTS_TABLE_ID = process.env.BASEROW_TABLE_ID || "906650";
const APPLY = process.argv.includes("--apply-schema");
const token = process.env.BASEROW_SCHEMA_JWT ? `JWT ${process.env.BASEROW_SCHEMA_JWT}` : process.env.BASEROW_API_TOKEN ? `Token ${process.env.BASEROW_API_TOKEN}` : null;
if (!token) throw new Error("BASEROW_SCHEMA_JWT or BASEROW_API_TOKEN is required");
const monitoringStatuses = ["verified", "changed", "ambiguous", "not_detected", "browser_required", "blocked", "dead_url", "redirected", "error"];
const confidenceOptions = ["high", "medium", "low"];
const offerStatusOptions = ["unverified", "verified_current", "change_pending", "stale", "source_unavailable", "revoked"];
const offerSourceOptions = ["monitor_json_ld_product_offer", "monitor_product_meta", "monitor_schema_microdata", "manual_external_product_page"];
const colors = ["dark-green", "dark-red", "dark-yellow", "dark-gray", "dark-purple", "dark-orange", "dark-red", "dark-blue", "dark-gray"];
const select = (name, values, palette = colors) => ({ name, type: "single_select", select_options: values.map((value, index) => ({ value, color: palette[index % palette.length] })) });
const decimal = (name) => ({ name, type: "number", number_decimal_places: 4, number_negative: false });
const datetime = (name) => ({ name, type: "date", date_include_time: true, date_time_format: "24" });
const fields = [
  datetime("price_last_checked_at"), select("price_check_status", monitoringStatuses), decimal("price_detected_amount"),
  { name: "price_detected_currency", type: "text" }, { name: "price_extraction_method", type: "text" },
  select("price_confidence", confidenceOptions, ["dark-green", "dark-yellow", "dark-gray"]), { name: "price_change_detected", type: "boolean" },
  decimal("offer_price_amount"), { name: "offer_price_currency", type: "text" }, datetime("offer_price_verified_at"),
  select("offer_price_source", offerSourceOptions), { name: "offer_price_source_url", type: "url" }, select("offer_price_status", offerStatusOptions),
  decimal("manual_price_amount"), { name: "manual_price_currency", type: "text" }, datetime("manual_price_verified_at"), { name: "manual_price_source_url", type: "url" },
];
async function request(path, init = {}) { const response = await fetch(`${API}${path}`, { ...init, headers: { Authorization: token, "Content-Type": "application/json", ...(init.headers || {}) } }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(`Baserow ${response.status} ${path}: ${JSON.stringify(body)}`); return body; }
const existing = await request(`/database/fields/table/${PRODUCTS_TABLE_ID}/`);
const actions = fields.filter((field) => !existing.some((item) => item.name === field.name)).map((field) => ({ action: "create_product_field", table_id: Number(PRODUCTS_TABLE_ID), field }));
if (APPLY) for (const action of actions) await request(`/database/fields/table/${PRODUCTS_TABLE_ID}/`, { method: "POST", body: JSON.stringify(action.field) });
console.log(JSON.stringify({ mode: APPLY ? "apply-schema" : "dry-run", writes_performed: APPLY, products_table_id: Number(PRODUCTS_TABLE_ID), actions,
  historical_storage: "Google Sheets / Price History (append-only)", baserow_history_table_created: false,
  protected_fields_never_written_by_monitor: ["price_min_eur", "price_max_eur", "offer_price_amount", "offer_price_currency", "offer_price_verified_at", "offer_price_source", "offer_price_source_url"],
}, null, 2));
