import type { APIRoute } from "astro";
import { ALLOWED_ANALYTICS_ORIGINS, analyticsCors, analyticsTextResponse } from "../../lib/analytics-ingestion";
import { handleDiscoverySnapshotPost } from "../../lib/analytics-discovery";
import { createServerSupabaseAnalyticsRepository } from "../../lib/supabase-analytics";

export const OPTIONS: APIRoute = ({ request }) => {
  const origin = request.headers.get("origin") || "";
  return ALLOWED_ANALYTICS_ORIGINS.has(origin)
    ? new Response(null, { status: 204, headers: analyticsCors(origin) })
    : analyticsTextResponse("Forbidden", 403, origin);
};

export const POST: APIRoute = ({ request }) =>
  handleDiscoverySnapshotPost(request, createServerSupabaseAnalyticsRepository);
