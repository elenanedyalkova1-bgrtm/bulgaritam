import type { APIRoute } from "astro";
import { createSelectOption } from "../../lib/baserow";

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    if (!locals.admin?.csrf || body.csrf !== locals.admin.csrf) return Response.json({ error: "Invalid CSRF token" }, { status: 403 });
    if (!['subcategory', 'product_type'].includes(body.field)) return Response.json({ error: "Unsupported taxonomy field" }, { status: 400 });
    const result = await createSelectOption(body.field, String(body.value || ""));
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not create taxonomy option" }, { status: 400 });
  }
};
