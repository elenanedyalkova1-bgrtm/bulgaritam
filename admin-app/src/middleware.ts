import { defineMiddleware } from "astro:middleware";
import { readSession, sessionCookie } from "./lib/auth";

function secure(response: Response) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "same-origin");
  return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;
  if (["/api/events", "/api/events/", "/api/brand-applications", "/api/brand-applications/"].includes(pathname)) return secure(await next());
  const isLogin = pathname === "/login/" || pathname === "/login";
  const session = await readSession(context.cookies.get(sessionCookie.name)?.value);
  context.locals.admin = { authenticated: Boolean(session), csrf: session?.csrf || "" };
  if (!isLogin && !session) return secure(context.redirect("/login/"));
  if (isLogin && session) return secure(context.redirect("/"));
  return secure(await next());
});
