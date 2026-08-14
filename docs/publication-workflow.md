# Public-site publication workflow

The Admin triggers `.github/workflows/publish-public.yml`. Every run builds the root Astro project from current Baserow data, verifies the generated Product and Brand routes, and uploads the verified `dist/` as a GitHub artifact.

`dry-run` stops after artifact upload. `deploy` additionally enters the protected GitHub environment `public-production` and publishes to SuperHosting over explicit FTPS with certificate and hostname verification.

## GitHub repository settings

Create an Actions environment named `public-production` and add the administrator as a required reviewer. Do not approve its first deployment until the safe dry-run artifact has been reviewed.

Repository Actions variables:

- `BASEROW_TABLE_ID` = `906650`
- `BASEROW_BRANDS_TABLE_ID` = `1133942`

Repository Actions secrets:

- `BASEROW_API_TOKEN`
- `SUPERHOSTING_FTPS_USERNAME`
- `SUPERHOSTING_FTPS_PASSWORD`

Repository Actions variables:

- `SUPERHOSTING_FTPS_SERVER_IP` — the IP serving the restricted FTP account
- `SUPERHOSTING_FTPS_TLS_HOST` — the SuperHosting hostname covered by the TLS certificate
- `SUPERHOSTING_FTPS_PORT` — `21` for explicit FTPS

The deployment account is jailed to the `bulgaritam.bg` document root, which is exposed as `/` inside the FTP session. The deploy stage uploads all generated files without deleting unrelated hosting files. It synchronizes only `dist/p/` and `dist/brand/` with deletion enabled so stale Product and Brand pages are removed.

## Vercel Admin settings

Sensitive variables:

- `GITHUB_DEPLOY_TOKEN` — a fine-grained GitHub token limited to this repository with Actions write and repository metadata read access

Non-sensitive variables:

- `GITHUB_REPOSITORY` — `owner/repository`
- `GITHUB_DEPLOY_WORKFLOW` — `publish-public.yml`
- `GITHUB_DEPLOY_REF` — `main`
- `PUBLISH_PRODUCTION_ENABLED` — keep `false` until the first live publish is approved

The GitHub token and all SuperHosting credentials are server-only. None use Astro's `PUBLIC_` prefix and none are included in client-side JavaScript.
