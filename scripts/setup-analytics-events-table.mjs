const API = "https://api.baserow.io/api";
const DATABASE_ID = process.env.BASEROW_DATABASE_ID || "404859";
const TABLE_NAME = "Analytics Events";

const email = process.env.BASEROW_SCHEMA_EMAIL;
const password = process.env.BASEROW_SCHEMA_PASSWORD;
if (!email || !password) throw new Error("BASEROW_SCHEMA_EMAIL and BASEROW_SCHEMA_PASSWORD are required.");

const authResponse = await fetch(`${API}/user/token-auth/`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: email, password }),
});
const auth = await authResponse.json();
const schemaToken = auth.access_token || auth.token;
if (!authResponse.ok || !schemaToken) throw new Error(`Baserow schema authentication failed (${authResponse.status}).`);
const headers = { Authorization: `JWT ${schemaToken}`, "Content-Type": "application/json" };

const request = async (path, init = {}) => {
  const response = await fetch(`${API}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Baserow ${response.status} ${path}: ${body.detail || body.error || "request failed"}`);
  return body;
};

const tables = await request(`/database/tables/database/${DATABASE_ID}/`);
let table = tables.find((item) => item.name === TABLE_NAME);
if (!table) table = await request(`/database/tables/database/${DATABASE_ID}/`, { method: "POST", body: JSON.stringify({ name: TABLE_NAME }) });

const desiredFields = [
  ["event_name", "text"], ["occurred_at", "text"], ["anonymous_session_id", "text"],
  ["anonymous_journey_id", "text"], ["product_id", "text"], ["product_name", "text"],
  ["brand_id", "text"], ["brand_name", "text"], ["category", "text"], ["subcategory", "text"],
  ["product_type", "text"], ["search_term", "text"], ["search_results_count", "number"],
  ["collection_id", "text"], ["source_context", "text"], ["destination_domain", "text"],
  ["payload_json", "long_text"],
];
const fields = await request(`/database/fields/table/${table.id}/`);
for (const [name, type] of desiredFields) {
  if (fields.some((field) => field.name === name)) continue;
  const body = type === "number" ? { name, type, number_decimal_places: 0, number_negative: false } : { name, type };
  await request(`/database/fields/table/${table.id}/`, { method: "POST", body: JSON.stringify(body) });
}

console.log(JSON.stringify({ table_id: table.id, table_name: table.name, fields: desiredFields.map(([name]) => name) }));
