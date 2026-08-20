import type { APIRoute } from "astro";
import { baserowUrl } from "../../lib/baserow";

const DATABASE_ID = 404859;

async function schemaToken() {
  const response = await fetch(baserowUrl("/user/token-auth/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: import.meta.env.BASEROW_SCHEMA_EMAIL,
      password: import.meta.env.BASEROW_SCHEMA_PASSWORD,
    }),
  });
  const data = await response.json();
  const token = data.access_token || data.token;
  if (!response.ok || !token) throw new Error(`Schema authentication failed (${response.status}).`);
  return token;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    if (!locals.admin?.csrf || body.csrf !== locals.admin.csrf) return json({ error: "Invalid CSRF token" }, 403);
    if (import.meta.env.BASEROW_SITE_SETTINGS_TABLE_ID) return json({ tableId: import.meta.env.BASEROW_SITE_SETTINGS_TABLE_ID, created: false });

    const jwt = await schemaToken();
    const headers = { Authorization: `JWT ${jwt}`, "Content-Type": "application/json" };
    const tableResponse = await fetch(baserowUrl(`/database/tables/database/${DATABASE_ID}/`), {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Site Settings" }),
    });
    const table = await tableResponse.json();
    if (!tableResponse.ok || !table.id) throw new Error(`Table creation failed (${tableResponse.status}).`);

    const fields = [
      { name: "key", type: "text" },
      { name: "hero_image", type: "file" },
      { name: "hero_alt_bg", type: "long_text" },
      { name: "hero_alt_en", type: "long_text" },
    ];
    for (const field of fields) {
      const response = await fetch(baserowUrl(`/database/fields/table/${table.id}/`), {
        method: "POST",
        headers,
        body: JSON.stringify(field),
      });
      if (!response.ok) throw new Error(`Field ${field.name} creation failed (${response.status}).`);
    }
    return json({ tableId: String(table.id), created: true });
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : "Site Settings bootstrap failed." }, 400);
  }
};
