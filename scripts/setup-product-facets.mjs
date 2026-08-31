const API = "https://api.baserow.io/api";
const tableId = process.env.BASEROW_TABLE_ID || "906650";
const schemaJwt = process.env.BASEROW_SCHEMA_JWT;
const email = process.env.BASEROW_SCHEMA_EMAIL;
const password = process.env.BASEROW_SCHEMA_PASSWORD;

const desiredFields = {
  role_interest: ["Кулинар", "Учителка", "Спортист", "Рибар", "Ловец"],
  wedding_anniversary_type: ["10 годишнина", "20 годишнина", "40 годишнина", "Обща годишнина", "Първа годишнина", "Перлена сватба", "Сребърна сватба", "Златна сватба"],
  gemstone: ["Диамант", "Изумруд", "Рубин", "Хематит", "Тигрово око", "Кехлибар", "Перла", "Цитрин", "Лабрадорит", "Мойсанит", "Черен турмалин"],
  jewelry_detail: ["Годежен", "Буква", "Име", "Кръст", "Червен конец"],
  clothing_style: ["Ежедневен", "Официален", "Спортен", "Бален", "Елегантен", "Бохо", "Вечерен"],
  sleeve: ["Къс ръкав", "Дълъг ръкав"],
  season: ["Летен", "Зимен", "Преходен", "Есенен"],
  ingredient: ["Розово масло", "Шафран"],
  skin_type: ["Нормална кожа", "Суха кожа", "Мазна кожа", "Комбинирана кожа", "Чувствителна кожа", "Дехидратирана кожа"],
  skin_need: ["Хидратация", "Против бръчки"],
  hair_need: ["Против косопад", "За мазна коса", "За суха коса", "За увредена коса"],
};
const existingFieldOptions = {
  recipient_age: ["1", "20", "25", "30", "35", "40", "45", "50", "60", "70", "80", "2", "3", "4", "7", "9", "10", "14"],
  recipient_gender: ["Момиче", "Момче"],
};
const existingSingleSelectOptions = {
  product_type: ["Блузи", "Ризи", "Палта", "Якета"],
};
const colors = ["light-blue", "light-green", "light-yellow", "light-red", "light-purple", "blue", "green", "yellow"];
const normalize = (value) => String(value || "").trim().toLocaleLowerCase("bg");

async function authorization() {
  if (schemaJwt) return `JWT ${schemaJwt}`;
  if (!email || !password) throw new Error("Set BASEROW_SCHEMA_JWT or BASEROW_SCHEMA_EMAIL + BASEROW_SCHEMA_PASSWORD before running this script.");
  const response = await fetch(`${API}/user/token-auth/`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: email, password }),
  });
  const data = await response.json();
  if (!response.ok || !(data.access_token || data.token)) throw new Error(`Baserow schema authentication failed (${response.status}).`);
  return `JWT ${data.access_token || data.token}`;
}

const auth = await authorization();
const request = async (path, init = {}) => {
  const response = await fetch(`${API}${path}`, { ...init, headers: { Authorization: auth, "Content-Type": "application/json", ...(init.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(`Baserow ${response.status}: ${JSON.stringify(data)}`);
  return data;
};
let fields = await request(`/database/fields/table/${tableId}/`);

for (const [name, values] of Object.entries(desiredFields)) {
  if (fields.some((field) => field.name === name)) continue;
  await request(`/database/fields/table/${tableId}/`, {
    method: "POST",
    body: JSON.stringify({ name, type: "multiple_select", select_options: values.map((value, index) => ({ value, color: colors[index % colors.length] })) }),
  });
  console.log(`created ${name}`);
}

fields = await request(`/database/fields/table/${tableId}/`);
for (const [name, additions] of Object.entries(existingFieldOptions)) {
  const field = fields.find((item) => item.name === name);
  if (!field || field.type !== "multiple_select") throw new Error(`Expected existing multiple_select field ${name}.`);
  const known = new Set((field.select_options || []).map((option) => normalize(option.value)));
  const missing = additions.filter((value) => !known.has(normalize(value)));
  if (!missing.length) continue;
  const select_options = [
    ...(field.select_options || []).map(({ id, value, color }) => ({ id, value, color })),
    ...missing.map((value, index) => ({ value, color: colors[index % colors.length] })),
  ];
  await request(`/database/fields/${field.id}/`, { method: "PATCH", body: JSON.stringify({ select_options }) });
  console.log(`updated ${name}: ${missing.join(", ")}`);
}

for (const [name, additions] of Object.entries(existingSingleSelectOptions)) {
  const field = fields.find((item) => item.name === name);
  if (!field || field.type !== "single_select") throw new Error(`Expected existing single_select field ${name}.`);
  const known = new Set((field.select_options || []).map((option) => normalize(option.value)));
  const missing = additions.filter((value) => !known.has(normalize(value)));
  if (!missing.length) continue;
  const select_options = [
    ...(field.select_options || []).map(({ id, value, color }) => ({ id, value, color })),
    ...missing.map((value, index) => ({ value, color: colors[index % colors.length] })),
  ];
  await request(`/database/fields/${field.id}/`, { method: "PATCH", body: JSON.stringify({ select_options }) });
  console.log(`updated ${name}: ${missing.join(", ")}`);
}
