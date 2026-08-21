# Bulgaritam Admin V1

This is a separate server-rendered Astro application for `https://admin.bulgaritam.bg`. The existing root Astro application remains a static build for SuperHosting.bg.

## Local setup

Required environment variables in the repository `.env`:

- `BASEROW_API_TOKEN`
- `BASEROW_TABLE_ID=906650`
- `BASEROW_BRANDS_TABLE_ID=1133942` (optional; this ID is the fallback)
- `RESEND_API_KEY` (server-only key used by the public Brand Application endpoint)
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET` (at least 32 random characters)
- `ADMIN_ORIGIN=https://admin.bulgaritam.bg`
- `SITE_ORIGIN=https://bulgaritam.bg`

Generate a password hash with `npm run admin:password`, copy the output into `.env`, and generate the session secret with a cryptographically secure password manager or secret generator.

Run `npm run admin:dev`. The Admin is then available at `http://localhost:4321/`.

## Production status

The Admin uses the official Vercel adapter. It is deployed independently from the public SuperHosting site.

Before production deployment:

1. Configure the server-only environment variables in the separate `bulgaritam-admin` Vercel project.
2. Add `admin.bulgaritam.bg` to that project when DNS changes are approved.
3. Add a deployment hook so successful Baserow changes can rebuild and publish the root static site.
4. Verify secure cookies, origin checks, rate-limit behavior, and `Cache-Control: no-store`.

Do not deploy this app as static files: authentication and Baserow writes require a trusted server runtime.

## Brand Applications

The public partner form posts to the unauthenticated, validated `/api/brand-applications/` endpoint. The endpoint sends one email through Resend to `info@bulgaritam.bg`; it does not persist the submission or create Brands, Products, accounts, profiles, dashboards, or Admin workflow records. Configure `RESEND_API_KEY` only in the server-side Admin/Vercel environment.
