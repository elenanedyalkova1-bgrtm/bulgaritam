const API = "https://api.baserow.io/api";
export const PRODUCTS_TABLE = import.meta.env?.BASEROW_TABLE_ID || "906650";
export const BRANDS_TABLE = import.meta.env?.BASEROW_BRANDS_TABLE_ID || "1133942";

function headers() {
  const token = import.meta.env?.BASEROW_API_TOKEN;
  if (!token) throw new Error("BASEROW_API_TOKEN is missing");
  return { Authorization: `Token ${token}`, "Content-Type": "application/json" };
}

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, { ...init, headers: { ...headers(), ...(init.headers || {}) } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Baserow ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function schemaAuthorization() {
  const jwt = import.meta.env?.BASEROW_SCHEMA_JWT;
  if (jwt) return `JWT ${jwt}`;
  const email = import.meta.env?.BASEROW_SCHEMA_EMAIL;
  const password = import.meta.env?.BASEROW_SCHEMA_PASSWORD;
  if (!email || !password) throw new Error("Schema option creation is not configured.");
  const response = await fetch(`${API}/user/token-auth/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, password }),
  });
  const data = await response.json();
  const token = data.access_token || data.token;
  if (!response.ok || !token) throw new Error("Baserow schema authentication failed.");
  return `JWT ${token}`;
}

export async function listRows(table: string) {
  const rows: any[] = [];
  let next: string | null = `/database/rows/table/${table}/?user_field_names=true&size=200`;
  while (next) {
    const data = await request(next.startsWith("http") ? next.replace(API, "") : next);
    rows.push(...(data.results || []));
    next = data.next || null;
  }
  return rows;
}

export const getRow = (table: string, id: number) => request(`/database/rows/table/${table}/${id}/?user_field_names=true`);
export const createRow = (table: string, fields: Record<string, unknown>) => request(`/database/rows/table/${table}/?user_field_names=true`, { method: "POST", body: JSON.stringify(fields) });
export const updateRow = (table: string, id: number, fields: Record<string, unknown>) => request(`/database/rows/table/${table}/${id}/?user_field_names=true`, { method: "PATCH", body: JSON.stringify(fields) });
export const listFields = (table: string) => request(`/database/fields/table/${table}/`);

export async function createSelectOption(fieldName: "subcategory" | "product_type", rawValue: string) {
  const value = rawValue.trim().replace(/\s+/g, " ");
  if (!value) throw new Error("The new taxonomy value is empty.");
  if (value.length > 120) throw new Error("The taxonomy value is too long.");
  const fields = await listFields(PRODUCTS_TABLE);
  const field = fields.find((item: any) => item.name === fieldName);
  if (!field || field.type !== "single_select") throw new Error(`Baserow field ${fieldName} is unavailable.`);
  const normalize = (input: string) => input.trim().replace(/\s+/g, " ").toLocaleLowerCase("bg");
  const duplicate = field.select_options?.find((option: any) => normalize(option.value) === normalize(value));
  if (duplicate) return { created: false, option: duplicate };
  const select_options = [...(field.select_options || []).map(({ id, value, color }: any) => ({ id, value, color })), { value, color: "light-blue" }];
  const authorization = await schemaAuthorization();
  const response = await fetch(`${API}/database/fields/${field.id}/`, {
    method: "PATCH",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ select_options }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Could not create Baserow option: ${data.detail || data.error || response.status}`);
  const option = data.select_options?.find((item: any) => normalize(item.value) === normalize(value));
  if (!option) throw new Error("The option was not returned by Baserow after creation.");
  return { created: true, option };
}
