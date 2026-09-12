import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const base = readFileSync(resolve(root, "src/layouts/BaseLayout.astro"), "utf8");
const home = readFileSync(resolve(root, "src/pages/index.astro"), "utf8");
const brands = readFileSync(resolve(root, "src/components/BrandsDirectory.astro"), "utf8");
const seo = readFileSync(resolve(root, "src/components/SeoProductLanding.astro"), "utf8");
const brandPage = readFileSync(resolve(root, "src/pages/brand/[brand_slug].astro"), "utf8");
const productPage = readFileSync(resolve(root, "src/pages/p/[slug].astro"), "utf8");
const blogPage = readFileSync(resolve(root, "src/pages/blog/[slug].astro"), "utf8");
const savedPage = readFileSync(resolve(root, "src/pages/zapazeni.astro"), "utf8");
const sharedCollection = readFileSync(resolve(root, "src/pages/spodelena-kolekciya.astro"), "utf8");
const middleware = readFileSync(resolve(root, "admin-app/src/middleware.ts"), "utf8");
const migration = readFileSync(resolve(root, "supabase/migrations/202609120002_create_analytics_discovery_states.sql"), "utf8");

assert.match(base, /const signature = node\.dataset\.discoveryStateId \|\| `legacy:/, "same node/state impressions must dedupe by canonical state");
assert.match(base, /source_discovery_state_id: scope\?\.dataset\?\.discoveryStateId/);
assert.match(base, /last_discovery_state_id: state\.discovery_state_id/);
assert.doesNotMatch(base, /bulgaritam_discovery_context_v1/, "legacy context must not be merged as direct attribution");
assert.match(base, /threshold: \[0\.5\]/, "qualified impression threshold must stay unchanged");
assert.match(base, /bulgaritam:discovery-state-committed/,
  "a new state must re-evaluate already visible nodes without changing the 50% qualification rule");
assert.match(base, /a\.card-link, a\.related-link, a\.saved-link/,
  "brand, related, and saved product links must use the central view_product handler");
assert.match(base, /view_stage: "selection_click"/,
  "product and brand selections must be distinguishable from destination page loads");
assert.match(base, /view_stage: "page_load"/,
  "product and brand destination page loads must retain their own semantic stage");
assert.match(base, /collection_id: scope\.dataset\.collectionId/);
assert.match(base, /origin_product_id: scope\.dataset\.originProductId/);
assert.match(base, /const outboundLink = target\.closest\("a\.cta-out, a\[data-analytics-event='outbound_brand_click'\]"\)/,
  "outbound tracking must remain opt-in and must not classify internal links");

assert.match(home, /matchedCards\.map\(\(card\) => \(\{ node: card, entity_type: "product"/);
assert.match(home, /card\.dataset\.position = String\(position \+ 1\)/, "homepage and infinite-scroll positions remain absolute and 1-based");
assert.equal((home.match(/bulgaritamCommitDiscoveryState\?\./g) || []).length, 1, "all homepage facets converge on one final-state commit path");
assert.doesNotMatch(home.slice(home.indexOf("function renderVisibleCards"), home.indexOf("function updateActiveChips")), /bulgaritamCommitDiscoveryState/, "render/load-more must not duplicate a canonical state");

const giftApply = home.slice(home.indexOf("occasionApply?.addEventListener"), home.indexOf("occasionReset?.addEventListener"));
assert.equal((giftApply.match(/applyDiscovery\(/g) || []).length, 1, "multi-facet gift Apply must calculate one final state");

const brandDebounce = brands.slice(brands.indexOf("const scheduleBrandSearchTracking"), brands.indexOf("const updateOccasionBadge"));
assert.ok(brandDebounce.indexOf("setTimeout") < brandDebounce.indexOf("randomUUID"), "brand search ID must only exist after debounce fires");
assert.match(brands, /entity_type: "brand"/);
assert.ok(brands.indexOf("const orderedCards =") < brands.indexOf("commitBrandDiscoveryState(orderedCards"),
  "brand membership must be committed only after final ordering");
assert.match(seo, /commitSeoDiscoveryState\(filteredCards\)/);

assert.match(brandPage, /data-list-context="brand_page_products"/);
assert.match(brandPage, /data-analytics-kind="product"/);
assert.match(brandPage, /data-position=\{index \+ 1\}/);
assert.match(brandPage, /class="card-link"/);
assert.ok((brandPage.match(/data-analytics-event="outbound_brand_click"/g) || []).length >= 4,
  "website and Instagram links in both brand-page layouts must be tracked");

for (const surface of ["more_from_brand", "related_products"]) {
  const marker = `data-list-context="${surface}"`;
  assert.match(productPage, new RegExp(marker));
  const section = productPage.slice(productPage.indexOf(marker) - 140, productPage.indexOf(marker) + 500);
  assert.match(section, /data-analytics-kind="product"/);
  assert.match(section, /data-position=\{index \+ 1\}/);
  assert.match(section, /data-origin-product-id=\{product\.id\}/);
  assert.match(section, /data-origin-product-slug=\{product\.slug\}/);
}
assert.ok((productPage.match(/class="related-link"/g) || []).length >= 2,
  "more-from-brand and related product selections must use the tracked link class");

assert.match(blogPage, /data-analytics-kind="product"/);
assert.match(blogPage, /data-list-context="blog_recommendations"/);
assert.match(blogPage, /data-position=\{index \+ 1\}/);
assert.match(blogPage, /class="card-imglink"/);
assert.match(blogPage, /class="card-titlelink"/);

assert.match(savedPage, /data-list-context="\$\{board\.id === SAVED_PAGE_DEFAULT_ID \? "saved_products" : "named_collection"\}"/);
assert.match(savedPage, /data-analytics-kind="product"/);
assert.match(savedPage, /data-position="\$\{index \+ 1\}"/);
assert.match(savedPage, /data-collection-id="\$\{escapeSavedPageHtml\(board\.id\)\}"/);
assert.doesNotMatch(savedPage, /data-collection-name/, "private collection names must not enter card analytics context");
assert.match(savedPage, /class="saved-link"/);
assert.match(savedPage, /bulgaritam:products-appended/);

assert.match(sharedCollection, /data-analytics-kind="product"/);
assert.match(sharedCollection, /data-list-context="shared_collection"/);
assert.match(sharedCollection, /data-position="\$\{index \+ 1\}"/);
assert.match(sharedCollection, /data-collection-id="\$\{escapeHtml\(payload\.id \|\| ""\)\}"/);
assert.match(sharedCollection, /class="shared-card__media"/);
assert.match(sharedCollection, /class="shared-card__cta"/);
assert.match(sharedCollection, /bulgaritam:products-appended/);
assert.match(middleware, /"\/api\/discovery-states", "\/api\/discovery-states\/"/,
  "the public discovery ingestion endpoint must bypass admin authentication");
assert.match(migration, /create or replace function public\.insert_analytics_discovery_state/);
assert.match(migration, /expected_count <> actual_count/);
assert.match(migration, /revoke all on table public\.analytics_discovery_states, public\.analytics_discovery_results from anon, authenticated/);

console.log("analytics browser contract tests passed");
