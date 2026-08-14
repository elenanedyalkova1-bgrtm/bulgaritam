import type { APIRoute } from "astro";
import { csvTemplate } from "../../lib/csv-import";
export const GET: APIRoute = () => new Response(csvTemplate(), { headers: { "Content-Type":"text/csv; charset=utf-8", "Content-Disposition":"attachment; filename=bulgaritam-products-template.csv", "Cache-Control":"no-store" } });
