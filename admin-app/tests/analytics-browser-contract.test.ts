import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const base = readFileSync(resolve(root, "src/layouts/BaseLayout.astro"), "utf8");
const home = readFileSync(resolve(root, "src/pages/index.astro"), "utf8");
const brands = readFileSync(resolve(root, "src/components/BrandsDirectory.astro"), "utf8");
const seo = readFileSync(resolve(root, "src/components/SeoProductLanding.astro"), "utf8");
const migration = readFileSync(resolve(root, "supabase/migrations/202609120002_create_analytics_discovery_states.sql"), "utf8");

assert.match(base, /const signature = node\.dataset\.discoveryStateId \|\| `legacy:/, "same node/state impressions must dedupe by canonical state");
assert.match(base, /source_discovery_state_id: scope\?\.dataset\?\.discoveryStateId/);
assert.match(base, /last_discovery_state_id: state\.discovery_state_id/);
assert.doesNotMatch(base, /bulgaritam_discovery_context_v1/, "legacy context must not be merged as direct attribution");
assert.match(base, /threshold: \[0\.5\]/, "qualified impression threshold must stay unchanged");
assert.match(base, /bulgaritam:discovery-state-committed/,
  "a new state must re-evaluate already visible nodes without changing the 50% qualification rule");

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
assert.match(migration, /create or replace function public\.insert_analytics_discovery_state/);
assert.match(migration, /expected_count <> actual_count/);
assert.match(migration, /revoke all on table public\.analytics_discovery_states, public\.analytics_discovery_results from anon, authenticated/);

console.log("analytics browser contract tests passed");
