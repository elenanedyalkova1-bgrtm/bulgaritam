# Inventory of accumulated work

Baseline: `c08bba899ea96eb1a5c21b29e21d3d6651bb0905` (merged PR #2). Original checkout is preserved in place; its binary diff snapshot is outside the repository at `/private/tmp/bulgaritam-local-preserved.patch`. No local files were deleted.

## Branches

- `release/homepage-random-load`: already merged as PR #2; homepage, discovery module and runtime kept identical to main.
- `codex/price-monitor-recovery-release`: already merged as PR #1; current main monitoring/recovery implementation retained byte-for-byte.
- `codex/manual-price-fallback-90-days` and merge-validation: already in main; approval rules retained, static display expiry safeguarded.
- `codex/safe-dynamic-discounts`: reused commit `ab92ab847978cb55ff8d0b4e183de6d4c026b528` via clean cherry-pick.
- `codex/branding-production` / branding-main-sync: branding assets/components/verifier and narrowly scoped retired-icon planner included; layout combines branding with local consent-gated pixel.
- `codex/public-thursday-readiness`: preparation document only; no completed automatic publisher exists. Weekly scheduling is not enabled in this release.

## Local tracked changes

| File | Decision |
| --- | --- |
| `.astro/data-store.json` | Excluded: generated cache/report; original retained. |
| `.astro/settings.json` | Excluded: generated cache/report; original retained. |
| `admin-app/src/lib/analytics-ingestion.ts` | Included; integrated with main and discounts release. |
| `admin-app/src/lib/product-taxonomy.ts` | Included; integrated with main and discounts release. |
| `admin-app/src/pages/api/brand-applications.ts` | Included and tested; API Facebook storage adapted to existing raw_payload column. |
| `admin-app/tests/brand-applications.test.ts` | Included and tested; API Facebook storage adapted to existing raw_payload column. |
| `package.json` | Merge usable scripts/dependencies; exclude experiment entry points, retain complete monitoring suite. |
| `public/_headers` | Included; integrated with main and discounts release. |
| `public/apple-touch-icon.png` | Included; integrated with main and discounts release. |
| `public/favicon-192x192.png` | Included; integrated with main and discounts release. |
| `public/favicon-48x48.png` | Included; integrated with main and discounts release. |
| `public/favicon-512x512.png` | Included; integrated with main and discounts release. |
| `public/favicon.ico` | Included; integrated with main and discounts release. |
| `public/favicon.png` | Included; integrated with main and discounts release. |
| `public/favicon.svg` | Included; integrated with main and discounts release. |
| `public/mstile-150x150.png` | Included; integrated with main and discounts release. |
| `public/site.webmanifest` | Included; integrated with main and discounts release. |
| `public/social-preview.png` | Included; integrated with main and discounts release. |
| `reports/seo-product-membership.json` | Excluded: generated cache/report; original retained. |
| `scripts/run-scheduled-price-monitor.mjs` | Superseded: retain newer approved main monitoring/price tests; do not regress recovery or identity guards. |
| `scripts/setup-price-monitor-sheet.mjs` | Excluded: operational spreadsheet setup change; not needed by release, not executed. |
| `scripts/verify-public-build.mjs` | Included; integrated with main and discounts release. |
| `src/components/BrandsDirectory.astro` | Included; integrated with main and discounts release. |
| `src/components/SeoProductLanding.astro` | Included; integrated with main and discounts release. |
| `src/components/src/components/Header.astro` | Included; integrated with main and discounts release. |
| `src/layouts/BaseLayout.astro` | Included; integrated with main and discounts release. |
| `src/layouts/Layout.astro` | Included; integrated with main and discounts release. |
| `src/lib/price-monitor/README.md` | Superseded: retain newer approved main monitoring/price tests; do not regress recovery or identity guards. |
| `src/lib/price-monitor/index.mjs` | Superseded: retain newer approved main monitoring/price tests; do not regress recovery or identity guards. |
| `src/lib/price-monitor/monitor.mjs` | Superseded: retain newer approved main monitoring/price tests; do not regress recovery or identity guards. |
| `src/lib/price-monitor/persistence.mjs` | Superseded: retain newer approved main monitoring/price tests; do not regress recovery or identity guards. |
| `src/lib/price-monitor/scheduler.mjs` | Superseded: retain newer approved main monitoring/price tests; do not regress recovery or identity guards. |
| `src/lib/products.ts` | Include taxonomy normalization only; retain main manual fields and exclude canary snapshot injection. |
| `src/lib/public-browse-taxonomy.ts` | Included; integrated with main and discounts release. |
| `src/lib/seo-landings.ts` | Included; integrated with main and discounts release. |
| `src/pages/blog/[slug].astro` | Included; integrated with main and discounts release. |
| `src/pages/blog/index.astro` | Included; integrated with main and discounts release. |
| `src/pages/brand/[brand_slug].astro` | Included; integrated with main and discounts release. |
| `src/pages/category/idei-za-podarak.astro` | Included; integrated with main and discounts release. |
| `src/pages/category/podaratsi.astro` | Included; integrated with main and discounts release. |
| `src/pages/index.astro` | Already identical to merged main / PR #2; no duplicate change. |
| `src/pages/page/[page].astro` | Included; integrated with main and discounts release. |
| `src/pages/partnyori.astro` | Included; integrated with main and discounts release. |
| `src/pages/politika-na-poveritelnost.astro` | Included; integrated with main and discounts release. |
| `src/pages/spodelena-kolekciya.astro` | Included; integrated with main and discounts release. |
| `src/pages/za-nas.astro` | Included; integrated with main and discounts release. |
| `src/pages/zapazeni.astro` | Included; integrated with main and discounts release. |
| `test/homepage-discovery.test.mjs` | Included; integrated with main and discounts release. |
| `test/price-monitor-scheduler.test.mjs` | Superseded: retain newer approved main monitoring/price tests; do not regress recovery or identity guards. |
| `test/price-monitor.test.mjs` | Superseded: retain newer approved main monitoring/price tests; do not regress recovery or identity guards. |
| `test/verified-offer.test.ts` | Superseded: retain newer approved main monitoring/price tests; do not regress recovery or identity guards. |

## Local untracked files

| File | Decision |
| --- | --- |
| `brands_enriched.csv` | Excluded: generated audit/export/evidence, original retained. |
| `brands_enrichment_audit.csv` | Excluded: generated audit/export/evidence, original retained. |
| `bulgaritam_products_reenriched_v2.csv` | Excluded: generated audit/export/evidence, original retained. |
| `docs/apps-script-price-fetch-canary.md` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `docs/catalog-price-operating-model.md` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `docs/external-monitoring-phase2.md` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `export - Brands - Grid-2 - list.backup.csv` | Excluded: generated audit/export/evidence, original retained. |
| `integrations/apps-script-price-fetch-canary/Code.gs` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `integrations/apps-script-price-fetch-canary/appsscript.json` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `public/filter-options.js` | Included: reviewed supporting component, verifier or behavioral test. |
| `public/product-discovery.js` | Already merged in PR #2; retain main version. |
| `reports/all-indexable-search-landing-routes.csv` | Excluded: generated audit/export/evidence, original retained. |
| `reports/bulgarian-intent-landing-registry.csv` | Excluded: generated audit/export/evidence, original retained. |
| `reports/discounts-2026-09-21.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/discounts-after-enrichment-2026-09-21.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/final-seo-content-inventory.csv` | Excluded: generated audit/export/evidence, original retained. |
| `reports/final-seo-content-inventory.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/REPORT.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/audit.mjs` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/catalogue-field-summary.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/catalogue-fields.mjs` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/database-access.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/details.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/details.mjs` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/fetch-evidence.mjs` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live-crawl.mjs` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live-graph.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live-graph.mjs` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live-link-inventory.csv` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live-page-checks.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live-product-checks.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/%2Fcategory%2Fidei-za-podarak%2F.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/%2Fcategory%2Fpodaratsi%2F.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/%2Fk%2Fbulgarski-drehi%2F.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/%2Fk%2Fbulgarski-podaratsi%2F.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/%2Fk%2Fdetski-knigi%2F.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/%2Fk%2Fidei-za-podarak%2F.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/%2Fk%2Fobleklo%2F.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/%2Fk%2Fpodaraci%2F.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/%2Fk%2Fpodaraci-za-bebe%2F.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/%2Fk%2Fpodaraci-za-jena%2F.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/%2Fk%2Fpodaraci-za-nego%2F.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/%2Fk%2Fpodaraci-za-svatba%2F.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/%2Fk%2Fza-bebe%2F.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/%2Fk%2Fza-dete%2F.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/%2Fk%2Fza-mazh%2F.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/%2Fk%2Fza-svatba%2F.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/%2Fk%2Fza-zhena%2F.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/bulgarski-drehi__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/bulgarski-podaratsi__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/home.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/manifest.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/p__cheresha__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/p__roklya-dot__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/p__surov-borov-prashets-tinktura__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__10__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__11__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__12__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__13__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__14__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__15__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__16__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__17__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__18__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__19__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__20__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__21__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__22__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__2__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__3__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__4__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__5__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__6__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__7__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__8__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/page__9__.html` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/robots.txt` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/sitemap-0.xml` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/live/sitemap-index.xml` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/omitted-description-evidence.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/pages.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/product-inventory.csv` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/products.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/rendered-catalogue-fields.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/summary.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forensic-product-seo-2026-09-29/validation.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/forum-manrope-normalization.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/gift-feed-mobile-investigation.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/home-hero-save-discoverability.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/landing-content-update-mapping.csv` | Excluded: generated audit/export/evidence, original retained. |
| `reports/landing-page-content-for-human-review.csv` | Excluded: generated audit/export/evidence, original retained. |
| `reports/landing-page-content-for-human-review.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/manrope-typography-validation.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/natural-materials-membership-audit.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/pre-freeze-report-summary.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/pre-freeze-ux-mobile-audit.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/price-monitor-100-after-2026-09-17.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/price-monitor-100-before-2026-09-17.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/price-monitor-100-validation-2026-09-17.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/price-monitor-forensic-after-2026-09-25.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/price-monitor-forensic-final-2026-09-25.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/price-monitor-fresh-full-scan-2026-09-19.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/price-monitor-fresh-persistence-2026-09-19.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/price-monitor-full-catalog-2026-09-17.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/price-monitor-full-refresh-after-enrichment.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/price-monitor-full-refresh.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/price-monitor-low-confidence-final-2026-09-25.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/price-monitor-persistence-migration-plan-2026-09-17.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/price-monitor-scheduler-dry-run-2026-09-17.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/price-monitor-v1-final-2026-09-19.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/price-monitor-v1-report-2026-09-17.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/price-monitor-v1-validation-2026-09-17.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-discovery-2026-10-19/investigation.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-seo-coverage.csv` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-seo-phase1-2026-09-29/REPORT.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-seo-phase1-2026-09-29/build-and-tests.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-seo-phase1-2026-09-29/check-local-http.mjs` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-seo-phase1-2026-09-29/check-render-fixtures.mjs` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-seo-phase1-2026-09-29/duplicate-titles-after.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-seo-phase1-2026-09-29/implementation.patch` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-seo-phase1-2026-09-29/local-http.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-seo-phase1-2026-09-29/prepare-render-fixtures.mjs` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-seo-phase1-2026-09-29/product-before-after.csv` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-seo-phase1-2026-09-29/product-before-after.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-seo-phase1-2026-09-29/read-catalogue.mjs` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-seo-phase1-2026-09-29/renderer-fixtures.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-seo-phase1-2026-09-29/reviewed-exceptions.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-seo-phase1-2026-09-29/source-hashes-before.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-seo-phase1-2026-09-29/validation.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-title-quality-2026-09-29/REPORT.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-title-quality-2026-09-29/build-summary.txt` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-title-quality-2026-09-29/duplicate-titles.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-title-quality-2026-09-29/products.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-title-quality-2026-09-29/source-hashes-before.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-title-quality-2026-09-29/title-policy.patch` | Excluded: generated audit/export/evidence, original retained. |
| `reports/product-title-quality-2026-09-29/validation.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/public-ui-cleanup-2026-09-23.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/recommendations-homepage-2026-10-06/activation-artifact-check.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/recommendations-homepage-2026-10-06/activation-production-unchanged.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/recommendations-homepage-2026-10-06/implementation.diff` | Excluded: generated audit/export/evidence, original retained. |
| `reports/recommendations-homepage-2026-10-06/production-activation.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/recommendations-homepage-2026-10-06/review.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/recommendations-homepage-2026-10-06/validation.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/seo-consolidation-after.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/seo-consolidation-before.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/seo-consolidation-group2-difference.csv` | Excluded: generated audit/export/evidence, original retained. |
| `reports/seo-consolidation-http.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/seo-consolidation-page-metadata-after.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/seo-consolidation-page-metadata-before.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/seo-consolidation-page-metadata-recheck-2026-09-18.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/seo-consolidation-recheck-2026-09-18.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/seo-consolidation-report.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/seo-consolidation-validation-after.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/seo-consolidation-validation-before.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/seo-consolidation-validation-recheck-2026-09-18.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/seo-landing-content-inventory.csv` | Excluded: generated audit/export/evidence, original retained. |
| `reports/ux-internal-linking-2026-10-04.md` | Excluded: generated audit/export/evidence, original retained. |
| `reports/ux-related-selection-validation-2026-10-04.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/verified-offer-canary-20-2026-09-17-final.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/verified-offer-canary-20-2026-09-17.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/verified-offer-fresh-build-audit-2026-09-19.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/verified-offer-fresh-candidates-2026-09-19.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/verified-offer-fresh-cohort-build-audit-2026-09-19.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/verified-offer-fresh-population-2026-09-19.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/verified-offer-fresh-readback-2026-09-19.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/verified-offer-full-build-audit-2026-09-17.json` | Excluded: generated audit/export/evidence, original retained. |
| `reports/verified-offer-full-catalog-analysis-2026-09-17.json` | Excluded: generated audit/export/evidence, original retained. |
| `scripts/analyze-verified-offer-catalog.ts` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `scripts/apps-script-price-fetch-canary.mjs` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `scripts/audit-seo-consolidation.ts` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `scripts/audit-verified-offer-build.mjs` | Included: reviewed supporting component, verifier or behavioral test. |
| `scripts/benchmark-external-monitor.mjs` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `scripts/canary-verified-offers.ts` | Included: reviewed supporting component, verifier or behavioral test. |
| `scripts/crawl-brand-sites.mjs` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `scripts/fetch-live-product-pages.mjs` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `scripts/finalize-brand-enrichment.py` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `scripts/finalize-seo-editorial-content.mjs` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `scripts/generate-bulgarian-intent-registry.ts` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `scripts/generate-pre-freeze-reports.ts` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `scripts/pilot-observed-products.mjs` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `scripts/reenrich-products.py` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `scripts/render-price-monitor-validation-report.mjs` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `scripts/simulate-price-monitor-scheduler.mjs` | Included: reviewed supporting component, verifier or behavioral test. |
| `scripts/validate-product-seo-phase1.ts` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `scripts/validate-product-title-quality.ts` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `scripts/validate-seo-consolidation.mjs` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `scripts/verify-branding.mjs` | Included: reviewed supporting component, verifier or behavioral test. |
| `scripts/verify-price-ranges.ts` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `scripts/verify-related-selections.mjs` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `scripts/verify-seo-consolidation-http.mjs` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `src/components/BrandLogo.astro` | Included: reviewed supporting component, verifier or behavioral test. |
| `src/components/FaviconHead.astro` | Included: reviewed supporting component, verifier or behavioral test. |
| `src/components/MetaPixel.astro` | Included: reviewed supporting component, verifier or behavioral test. |
| `src/lib/discovery-order.ts` | Already merged in PR #2; retain main version. |
| `test/discovery-order.test.ts` | Already merged in PR #2; retain main version. |
| `test/facet-overflow.test.mjs` | Included: reviewed supporting component, verifier or behavioral test. |
| `test/meta-pixel.test.mjs` | Included: reviewed supporting component, verifier or behavioral test. |
| `test/newsletter-popup.test.mjs` | Included: reviewed supporting component, verifier or behavioral test. |
| `test/partner-web-presence.test.mjs` | Included: reviewed supporting component, verifier or behavioral test. |
| `test/price-monitor-apps-script-canary.test.mjs` | Excluded: standalone migration/enrichment/canary/diagnostic or draft documentation; not required by reviewed runtime, original retained. |
| `test/related-selections.test.ts` | Included: reviewed supporting component, verifier or behavioral test. |
| `test/seo-discovery.test.mjs` | Included: reviewed supporting component, verifier or behavioral test. |
| `test/seo-feed-loading.test.mjs` | Included: reviewed supporting component, verifier or behavioral test. |
