#!/usr/bin/env node
try { process.loadEnvFile?.(); } catch (error) { if (error?.code !== "ENOENT") throw error; }
const apply = process.argv.includes("--apply-schema");
const databaseId = process.env.BASEROW_DATABASE_ID || "404859";
let jwt = process.env.BASEROW_SCHEMA_JWT;
const brandsTableId = process.env.BASEROW_BRANDS_TABLE_ID || "1133942";
const observedTableId = process.env.BASEROW_OBSERVED_PRODUCTS_TABLE_ID;
const tableName = "Observed Products";
const text = (name) => ({ name, type: "text" }); const url = (name) => ({ name, type: "url" });
const number = (name, decimals = 4) => ({ name, type: "number", number_decimal_places: decimals, number_negative: false });
const date = (name) => ({ name, type: "date", date_include_time: true, date_time_format: "24" });
const fields = [
  text("canonical_key"), number("brand_id", 0), url("source_url"), url("canonical_url"), text("external_product_id"), text("sku"),
  text("title"), url("image_url"), number("current_price"), text("currency"), number("regular_price"), text("regular_price_currency"),
  text("availability"), date("first_seen_at"), date("last_seen_at"), date("last_checked_at"), text("discovery_method"),
  text("discovery_confidence"), text("reader_status"), text("reader_error"), text("lifecycle_status"), number("consecutive_not_seen", 0),
  number("consecutive_dead", 0), { name: "is_active", type: "boolean" }, number("bulgaritam_product_id", 0), text("deal_category"),
];
const brandFields = [{ name: "external_monitoring_enabled", type: "boolean" }, { name: "external_monitoring_paused", type: "boolean" }];
const plan = { mode: apply ? "apply-schema" : "dry-run", writes_performed: false, database_id: Number(databaseId), table: tableName, table_id: observedTableId ? Number(observedTableId) : null, create_table: !observedTableId, fields, brand_fields: brandFields, uniqueness: { database_unique_constraint: false, application_key: "canonical_key = brand_id + normalized canonical/source URL", behavior: "single-writer workflow concurrency + serialized lookup/create/update + duplicate verification and fail-closed audit" }, price_history_extension: ["entity_type", "entity_id"], backward_compatibility: "blank legacy entity_type/entity_id resolves to catalog_product/product_id" };
if (!apply) { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }
if (!jwt && process.env.BASEROW_SCHEMA_EMAIL && process.env.BASEROW_SCHEMA_PASSWORD) {
  const response = await fetch("https://api.baserow.io/api/user/token-auth/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: process.env.BASEROW_SCHEMA_EMAIL, password: process.env.BASEROW_SCHEMA_PASSWORD }) });
  const body = await response.json(); jwt = body.access_token || body.token;
  if (!response.ok || !jwt) throw new Error("Baserow schema authentication failed; no schema writes were performed");
}
if (!jwt) throw new Error("BASEROW_SCHEMA_JWT or schema email/password is required for --apply-schema; no schema writes were performed");
const request = async (path, init = {}) => { const response = await fetch(`https://api.baserow.io/api${path}`, { ...init, headers: { Authorization: `JWT ${jwt}`, "Content-Type": "application/json" } }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(`Baserow schema ${response.status}: ${JSON.stringify(body)}`); return body; };
const tables = await request(`/database/tables/database/${databaseId}/`);
let table = observedTableId ? tables.find((item) => Number(item.id) === Number(observedTableId)) : tables.find((item) => item.name === tableName);
if (observedTableId && !table) throw new Error(`Configured Observed Products table ${observedTableId} is not in database ${databaseId}; refusing to create another table`);
if (observedTableId && table.name !== tableName) throw new Error(`Configured table ${observedTableId} is named ${table.name}, expected ${tableName}; refusing mutation`);
if (!table) table = await request(`/database/tables/database/${databaseId}/`, { method: "POST", body: JSON.stringify({ name: tableName }) });
const existing = await request(`/database/fields/table/${table.id}/`);
for (const field of fields) if (!existing.some((item) => item.name === field.name)) await request(`/database/fields/table/${table.id}/`, { method: "POST", body: JSON.stringify(field) });
const existingBrandFields = await request(`/database/fields/table/${brandsTableId}/`);
for (const field of brandFields) if (!existingBrandFields.some((item) => item.name === field.name)) await request(`/database/fields/table/${brandsTableId}/`, { method: "POST", body: JSON.stringify(field) });
const finalFields = await request(`/database/fields/table/${table.id}/`);
const mismatch = fields.flatMap((expected) => { const actual = finalFields.find((item) => item.name === expected.name); return !actual || actual.type !== expected.type ? [{ name: expected.name, expected: expected.type, actual: actual?.type || null }] : []; });
if (mismatch.length) throw new Error(`Observed Products schema validation failed: ${JSON.stringify(mismatch)}`);
console.log(JSON.stringify({ ...plan, writes_performed: true, table_id: table.id, brands_table_id: Number(brandsTableId), validated_expected_fields: fields.length, extra_fields: finalFields.filter((item) => !fields.some((field) => field.name === item.name)).map((item) => ({ name: item.name, type: item.type })) }, null, 2));
