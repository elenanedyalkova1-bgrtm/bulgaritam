# Isolated no-site and catalog production release

Prepared 2026-11-05 (Europe/Sofia). The user explicitly approved commit, push, safe merge and publication through the existing workflow. Current Baserow data, including the intentional Daily Carryall rename and edits to existing records, is the approved source of truth.

## Baseline, branch and working-tree isolation

- Live `https://bulgaritam.bg/deploy-manifest.json` identifies production commit `b629cd7d1a5a30e2efc9063128e773d8e49888da`, generated 2026-11-02T19:36:33.428Z. GitHub's current `main`, the shared checkout's HEAD and local `origin/main` identify the same commit.
- Dedicated branch: `codex/no-site-catalog-release-2026-11-05`.
- Separate worktree: `/private/tmp/bulgaritam-no-site-release-2026-11-05`.
- The shared checkout `/Users/elenanedyalkova/bulgaritam-clean` remained on `main`. It initially had no staged changes. No reset, stash, discard, overwrite or checkout was performed there.
- Inspected local/remote branch references, history, staged diff and worktree registrations. Existing older/prunable worktree registrations and the separate clean `release/homepage-random-load` checkout were left alone.
- Reviewed the actual feature diff against production, then applied a path-limited patch to ten tracked files in the new worktree. Six reviewed feature/helper/test/audit files were transferred separately. No unrelated commits were cherry-picked or merged. No wholesale copy of a modified shared file was used.
- The other sessions' untracked `studio-app/`, `tools/`, Admin performance/cache/dashboard work, reports and generated `.astro` changes were excluded. Studio and tools are absent from this worktree. Package manifests/lockfiles, deployment workflows/configuration, global styles, SEO landing definitions and product SEO publishing logic are unchanged from production.
- Independent dependency installations were used; node_modules, Astro caches and build outputs are not shared with the original checkout.
- A before/after SHA-256 snapshot of 691 source files, original HEAD and staged diff verifies the shared checkout remained unchanged. Final result: zero changed/missing files; original HEAD and staged diff unchanged. Snapshot evidence lives outside the repository under `/tmp/bulgaritam-isolation-source-before.json`.

## Exact proposed files

Runtime changes (13 files):

| File | Change |
| --- | --- |
| `src/lib/brand-contact.ts` | Shared contact validation, authoritative no_site flag and retail checks. |
| `src/lib/brands.ts` | Normalize existing Brands contacts and no_site. |
| `src/lib/products.ts` | Propagate linked Brands flag/contacts through the existing ID/slug join. |
| `src/lib/verified-offer.ts` | Suppress online Offers and website-based manual references for no-site products. |
| `src/components/InquiryDialog.astro` | Responsive accessible contact dialog, copyable email/subject, real social/retail methods. |
| `src/scripts/copy-contact.ts` | Clipboard and brief copy confirmation; no mailto. |
| `src/components/HomepageProductCard.astro` | Internal inquiry CTA; existing card styles retained. |
| `src/components/SeoProductLanding.astro` | Same inquiry behavior in existing category/landing cards; no SEO content/layout work transferred. |
| `src/pages/blog/[slug].astro` | Same inquiry behavior in existing editorial product cards. |
| `src/pages/p/[slug].astro` | Product inquiry CTA, related cards, existing structured-data inputs. |
| `src/pages/brand/[brand_slug].astro` | Hide website action for no-site brands; reuse social styling and copy email. Minimal mobile fallback when no description exists. |
| `src/layouts/BaseLayout.astro` | Contact analytics using existing consent-aware tracking and shared clipboard script. |
| `admin-app/src/lib/analytics-ingestion.ts` | Only the allowlist addition of inquiry_open, inquiry_contact_click, physical_store_click. |

Verification and evidence (9 files):

- `test/brand-contact.test.ts`
- `test/no-site.browser.mjs`
- `test/no-site-release.smoke.mjs`
- `scripts/validate-brand-contacts.ts`
- `scripts/audit-no-site-release.ts`
- `reports/no-site-data-quality.json`
- `reports/no-site-release-catalog.json`
- `reports/no-site-release-health.json`
- `docs/no-site-isolated-release.md`

Generated `.astro/content.d.ts`, screenshots, node_modules, dist, `.vercel` output, raw health diagnostics and environment files are not proposed source changes.

## Strictly necessary dependency and small isolated correction

- No new npm packages, import schema or Baserow fields are required. Reuses Brands.no_site, email, instagram_url, facebook_url, address, physical_address_type and existing brand/product IDs and joins.
- First-party ingestion must eventually receive its single-line allowlist update through a separately approved Admin publication. Otherwise the existing production endpoint rejects the new inquiry event names; product/brand UI still works. No Admin performance, dashboard, cache, middleware, package or Studio change is included.
- Actual catalog testing found Styler lacks description_bg. Existing mobile profile CSS hid the desktop actions while the duplicated mobile actions existed only inside the description section. The release adds a conditional standalone-action class and adjusts one mobile selector, keeping contact/website actions available without a description. This narrowly scoped publication fix is covered by website and email-only fixture brands without descriptions. It was made only in this release worktree.
- Shared `.astro` prerender scratch files make simultaneous Astro fixture suites collide even with isolated fixture cache configuration. Final suites were run sequentially. This is a local test orchestration constraint, not a production code dependency.

## Catalog publication and eligibility

The public catalog and brand/product routes are static. Baserow additions do **not** automatically create production pages. They require a fresh build followed by explicit publication of that built artifact. The existing dynamic discount API does not change ordinary catalog route generation.

Current audit: 1,329 raw Products rows and 135 Brands rows. One no-site brand, Silkify, has three linked publishable products and a valid email. No required fields are missing and no no-site missing-contact issues remain.

The refreshed candidate contains **1,242 unique product pages**, **129 brand pages**, and **1,805 total pages**. There are 92 product routes absent from the previous live manifest, including recovered records and the intentional Daily Carryall rename. Newly generated/recovered brand profiles are `fold-your-mind`, `styler`, `valendy`, `silkify` and `arkobo`. All generated routes reconcile with current eligible records.

### Approved data decisions and narrowly scoped correction

- **Daily Carryall:** the user confirmed the change from `/p/kozhena-chanta-daily-carryall/` to `/p/kozhena-ranica-daily-carryall/` is intentional. It is retained. Existing-record edits are explicitly accepted; no additions-only content restriction remains.
- **Corrected Citrus image:** `bio-dush-gel-citrus` now passes the targeted report-only health check (1 checked, 1 healthy, no review issues). The corrected product is included. No image field was modified by Codex.
- **Goud duplicate:** only Baserow row **1284**, stable product ID **1232**, had its `slug` changed from `roklya-dark-allure-dress` to `roklya-dark-allure-dress-1232`. The existing live URL remains with row **1287**, stable product ID **1235**. A before/after check confirmed only `slug` changed; no unrelated record or product field was modified. Both distinct detail pages are verified by stable product ID. The refreshed audit finds **zero duplicate slugs**.
- The full report-only health audit checked 1,260 active rows, deactivated none, found no confirmed gone product URLs, and confirmed only two missing/bad images. Those two records remain excluded: `svobodna-riza-ot-organichen-pamuk` and `top-ot-koprinena-smes-s-obemni-volani-i-dalboko-izryazan-grab-v-byalo`. There were 28 inconclusive image results and 326 review rows, largely merchant automation blocking; these do not prove broken customer-facing destinations.
- The candidate uses fresh current health results in `reports/no-site-release-health.json`, not a union with old production exclusions. This matches the user's current-data approval and the existing deployment workflow.

No additional SEO, architecture or UX work was started. The previously approved minimal empty-description mobile contact fallback is the only layout correction in this release.

## Validation

Final recorded results:

- Public release suite: **875 passed, 0 failed**, in this worktree using baseline dependencies; rerun after the mobile fallback.
- Admin suite: **46 passed, 0 failed**, with only the event allowlist change over production (no performance changes).
- Feature fixtures: **3 passed, 0 failed**, covering all eight scenarios at 390px/1280px, plus analytics refusal; empty-description website/email brands included.
- Admin check: **0 errors, 0 warnings, 5 existing hints**.
- Admin production build: passed.
- Final public production build: **passed — 1,805 pages in 1m 25s**, using fresh health results; no duplicate-slug conflict remains.
- Existing public build verification: **passed — 1,242 product pages, 129 brand pages; branding/icons and dynamic deals valid**.
- Actual-catalog plus existing site browser smoke: **8 passed, 0 failed**, including all 92 new-route HTML checks, all five newly generated/recovered brand profiles, real Silkify product/profile clipboard actions at 390px/1280px, website purchase behavior, homepage pagination/filtering, no-JS behavior and static catalog partition checks.
- Existing public build verifier reconciles route membership, branding/icons and dynamic deals. Both Goud identities are now rendered distinctly, the corrected image is included, and the only removed product route is the user-approved Daily Carryall rename.
- `git diff --check`: passed.
- No unrelated source changes, no Studio imports/output and no changes to original checkout/staging.

## Approved commit and publication plan

All 22 paths are explicitly allowlisted. The approved commits are:

1. `feat: support brands without websites` — 13 runtime files, three focused tests and two read-only audit scripts (18 files).
2. `docs: record isolated catalog release validation` — this report and three sanitized JSON reports (4 files).

They are based directly on production baseline `b629cd7d1a5a30e2efc9063128e773d8e49888da`. No unrelated commits, Studio files, unfinished SEO/UX or Admin performance changes are imported. Only explicit paths are staged; neither `git add .` nor `git add -A` is used.

Recheck `main` immediately before merge and stop if it has diverged. Push only the isolated branch, open a PR, validate CI and merge with an expected head SHA only if safe. Publish the public catalog through existing `publish-public.yml` with `mode=deploy` and verify the live manifest's production SHA and route counts.

The minimal Admin analytics allowlist update uses the existing `bulgaritam-admin` Vercel production project. Protected production secrets cannot be pulled locally; therefore no placeholder-built local bundle will be deployed. A clean committed-source deployment uses the existing server-side production environment and project configuration, excluding Studio and unrelated working-tree files.

After publication, verify live no-site dialogs, email copy controls, no empty website CTA, normal website purchase links, both Goud pages, the corrected product image and the published counts. The actual merge/deployment identifiers are reported to the user after deployment; pre-publication local artifacts are not mislabeled as deployed commits.
