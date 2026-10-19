# Consolidated production release

Prepared from approved remote main `c08bba899ea96eb1a5c21b29e21d3d6651bb0905` (PR #2). Branch: `codex/consolidated-production-release`.

## Included work

- Reuse the completed dynamic discounts release `ab92ab847978cb55ff8d0b4e183de6d4c026b528`: live Consumer Deals API, zero-static-result initialization, neutral SEO fallback, response/URL/price/timestamp validation, 72-hour freshness, timeout/error/empty states and visibility/expiry checks.
- Consolidate reviewed branding (logo, icons, social image, shared favicon head), typography, taxonomy aliases, category/SEO facets and discovery links, pagination, partner-form presentation and consent-gated Meta Pixel.
- Preserve PR #2's homepage, `product-discovery.js` and discovery ordering unchanged. Preserve main's price-monitor implementation, recovery, persistence and both monitoring workflows unchanged.
- Partner applications accept website OR Instagram OR Facebook. The live Baserow schema has no Facebook column: Facebook is retained in the existing `raw_payload` and notification, never written to a nonexistent column. No schema migration is required.
- Keep the existing manual-price approval and 83-day build eligibility rules. Eligible references are inert HTML templates; browser validation exposes them only through their inclusive 90-day expiry. Static/no-JS fallback remains orientational. Timer, visibility and page restoration remove expired amounts without needing another publication.
- Upgrade public Astro from 6.x to 7.4.1 and Admin from 7.2.2 to 7.4.1 to address reported security advisories; refresh compatible lockfile dependencies. This framework major upgrade is deliberate and covered by the full build/browser regression checks. Explicitly declare parse5 for the existing internal-link verifier.
- Add a secret-free PR validation workflow. It runs tests, local offline browser fixtures, Admin checking and Admin build; it contains no deployment or data mutation steps.
- Add branch-specific `git.deploymentEnabled: false` in both Vercel roots for this preparation branch only. It does not override existing ignored-build commands or change main's deployment behavior. Official contract: https://vercel.com/docs/project-configuration/git-configuration
- Include reviewed legacy-icon retirement from the branding branch; only previously tracked, explicitly named legacy icons absent from the new build are removable. Hosting-owned .htaccess remains protected.

Full per-file local-work disposition: [inventory](consolidated-release-inventory.md). Reports, exports, caches, source snapshots, migrations and unfinished canary experiments remain in the original checkout and are not staged. The two existing package commands for read-only offer auditing/canary now have their missing implementation files; the canary is not run or injected into public builds.

## Validation (local, 2026-10-19)

- Local Node 24.13.0; GitHub runner Node 24.21.0/npm 11.19.0. Initial CI exposed missing optional compiler dependencies in the old-npm-generated lockfile. Both locks were regenerated with npm 11.19.0 in clean directories and Linux-target `npm ci --dry-run` passed.
- Public/monitoring/discounts suite: **423 passed**, including 19 offline deals browser tests. `DEALS_BROWSER_CHANNEL=chrome TSX_DISABLE_CACHE=1 npm run test:release`.
- Admin suite: **24 passed** (several files run additional assertions internally), `npm run test:release-admin`.
- Built-site browser smoke: **5 passed**. Desktop/mobile main routes, no overflow or uncaught script errors, homepage unique products/load-more/filter/sort, no-JS SEO/neutral deals/manual references, full catalog partition across pagination without duplicates/omissions, and a real product's manual amount disappearing at the original expiry without rebuilding. `DEALS_BROWSER_CHANNEL=chrome npm run test:release-smoke` after build.
- Admin build: passed with Vercel adapter. Admin check: **0 errors, 0 warnings** (nonblocking hints remain).
- Public production-equivalent build: **1682 pages**. Production endpoints and catalog/table inputs match publish-public.yml; source credentials used read-only. The same product-health exclusion report is supplied to the build and verifier.
- Product health: **1163 checked**, 8 confirmed broken images excluded from the artifact; 64 inconclusive images retained under existing rules; 0 products deactivated, 0 confirmed gone.
- Public build verifier: passed; **1138 product pages, 120 brand pages**, correct dynamic loader/endpoint/assets and branding across 1682 pages.
- Primary-cluster content validation: passed. Internal-link validator: **no broken internal destinations**.
- Offer audit: 1138 Product entities, 286 Offers; no malformed JSON-LD, price/currency mismatch, fabricated availability or range-generated Offer.
- Production Consumer Deals GET: HTTP 200, correct public-origin CORS, `stale:false`, generated `2026-10-19T19:10:03.295Z`, **127 deals accepted** by release validator. This is API read evidence, not deployment evidence.
- `npm audit --omit=dev`: **0 vulnerabilities** in both public and Admin resolved dependency trees.
- `git diff --check`: passed. Main monitoring files and PR #2 implementation have no diff. Original dirty checkout's binary diff matches its preserved pre-integration snapshot.

## Read-only deployment findings

Vercel settings were inspected in the signed-in dashboard; no Save/deploy/rollback action was used.

| Project | Root / Node | Production branch | Current ignored-build command |
| --- | --- | --- | --- |
| bulgaritam | repository root / 24.x | main | `node scripts/vercel-ignore-reviewed-release.mjs 04bb409eb826af50e7451ab5b642f0da1a28f378 manual-price-admin-only` |
| bulgaritam-admin | admin-app / 24.x; outside-root files included | main | `node ../scripts/vercel-ignore-reviewed-release.mjs 6bb6d3c10fe736f98f53d66a10dc89bf3bfdd338 Копирай командата` |

Both commands allow the new combined release to build (the extra Admin text is tolerated by the existing parser). They are historical exact-release exclusions, not a universal publication lock. Public Vercel's last successful deployment shown in dashboard is `21f23ad` from September 13; the PR #2 public build failed. Admin's production source is PR #2. Do not merge until the user approves both Vercel consequences and the public hosting release sequence.

Public Vercel lists `www.bulgaritam.bg`; the FTPS workflow targets `https://bulgaritam.bg`. Read-only HTTP checks confirmed apex returns 200 from Apache and www returns 301 from Apache to apex. Thus current public traffic uses SuperHosting despite the Vercel domain listing. Recheck before approval; FTPS does not update Vercel's separate artifact.

`publish-public.yml` remains manual-only, with its protected `public-production` environment and deployment concurrency. A branch push/PR does not invoke FTPS. The environment currently requires a human reviewer. Permanent Thursday publishing is not silently enabled by this release.

## FTPS artifact plan and approval

Read-only byte comparison against `https://bulgaritam.bg` produced **1781 generated files: 81 unchanged, 1683 changed, 17 new, 0 stale; 1700 planned uploads**. No remote state was available. This is a whole-catalog release, not a discounts-only upload. Exact path lists and hashes are outside Git at `/private/tmp/bulgaritam-release-ftps-plan.json`; generated `/private/tmp/bulgaritam-release-ftps.lftp` was NOT executed. Refresh the plan after artifact/manifest changes or production drift.

The planner uses temporary-file rename per upload; it is not whole-site atomic. Failed uploads can leave a mixed release. Keep the verified artifact and a pre-release backup of every replaced/deleted generated file, plus the prior deployment state. Do not rely on the deployment-state cache after a partial upload: perform a fresh origin-byte comparison for recovery. Existing .htaccess, hosting-owned files and unrelated paths must remain untouched.

## Safe release sequence — requires explicit approval

1. Review this single PR, inventory, exact diff and validation. Freeze the approved SHA and final artifact hashes. Recheck remote main and resolve any drift before approval.
2. Inspect current apex/www routing and Vercel release behavior. Approve the merge/deployment sequence explicitly. Both existing Vercel guards allow builds for the combined release; merging is therefore also a Vercel deployment decision. No dashboard protection should be disabled as an implicit step.
3. After approval, publish/verify the Admin change before the public partner form: the old Admin endpoint still requires a website. Smoke-test social-only submissions only with separately approved test data/notification handling; no production form has been submitted during preparation.
4. Run the approved public workflow in dry-run mode with production secrets, inspect product health and verified artifact, and refresh the complete incremental FTPS plan. Keep the protected environment gate and existing concurrency. Failed build/verification must not deploy.
5. Back up the exact replaced files; approve and perform the controlled FTPS publication. Verify /, /namaleniya/, representative /p/, /brand/, /k/, /partnyori/, mobile/no-JS behavior, all changed assets and both apex/www routing. Compare manifest commit and hashes with the approved artifact; a green build alone is insufficient.
6. Roll back generated files from the reviewed backup if needed. Do not restore stale active discounts: use neutral SEO fallback for /namaleniya/. Roll back Admin only to its recorded previous deployment if needed, accounting for the partner-form dependency. Never rewrite Baserow/Sheets data as rollback.

## Remaining risks

- Production deployment itself is untested by design; no push to main, merge, FTPS or production setting/data changes are authorized in this preparation.
- A source-data duplicate slug `roklya-dark-allure-dress` emits an existing Astro route-conflict warning. No source record was modified; owner should resolve the duplicate separately.
- 64 product image checks are inconclusive. Existing policy retains them; transient network blocking is not proof of a broken image.
- Client freshness gates rely on a reasonably accurate browser clock. Static automatic Offer expiry behavior outside /namaleniya/ is unchanged. Baserow approvals and source changes after build cannot be inferred from an offline artifact.
- Framework major upgrade increases review scope; local behavior/build checks pass, but the first approved Vercel runtime deployment still requires smoke verification.
- Main is not branch-protected. Keep human approval and verify the exact SHA immediately before release.
