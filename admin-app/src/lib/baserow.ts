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
