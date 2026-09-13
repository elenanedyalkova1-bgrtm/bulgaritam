# Analytics V2 Data Capability Audit

Status: post–Phase 6A/6B, production-verified. This audit describes the current code and storage contract at commit `21f23ad`; it does not infer capabilities from the legacy dashboard.

## Rating key

- 🟢 **RELIABLE** — the required event or canonical fact is captured with a stable identity and sufficient context.
- 🟡 **RELIABLE WITH CAVEAT** — measurable, but interpretation, legacy coverage, catalogue completeness, consent, or identity constraints must remain visible.
- 🔴 **NOT CURRENTLY MEASURABLE** — the required observation does not exist in the current contract.

All behavioral statements apply to consenting Bulgaritam browsers, not to Bulgarian consumers or the Bulgarian population.

## A. Visitor, session, and journey

| Capability | Status | Evidence and caveat |
|---|---|---|
| Anonymous visitor continuity | 🟢 | `anonymous_journey_id` persists across sessions in the same consenting browser. |
| Session reconstruction | 🟢 | `anonymous_session_id`, `occurred_at`, and `sequence_number` identify and order a browser session. |
| Journey reconstruction | 🟢 | Events share `anonymous_journey_id`; sessions can be ordered by first activity. |
| Event ordering | 🟡 | Prefer `occurred_at`, then `sequence_number`, then storage `id`. Legacy rows may lack sequence numbers and client clocks can skew. |
| New vs returning anonymous browser | 🟢 | A journey with activity in an earlier session/window is returning. |
| Cross-session return and time between visits | 🟢 | Different session IDs under one journey permit return intervals. |
| Guaranteed person identity | 🔴 | A browser identifier is not a verified person; resets and shared browsers exist. |
| Cross-device identity | 🔴 | No login or durable cross-device identity exists. |

## B. Acquisition

| Capability | Status | Evidence and caveat |
|---|---|---|
| Landing page, referrer, UTM source/medium/campaign | 🟢 | Stored on events as `landing_page`, `referrer_domain`, and UTM fields. |
| Direct traffic | 🟢 | `acquisition_channel` and absent external referrer/UTMs support deterministic direct classification. |
| Google organic landing | 🟢 | Search-engine referrer plus landing page identifies organic Google arrivals. |
| Exact Google organic query | 🔴 | Referrer data does not expose it; Search Console integration is required. |
| Acquisition → discovery/attention/outbound | 🟢 | Session/journey identity connects acquisition to canonical discovery, impressions, selections, views, consideration, and outbound intent. |
| Acquisition → return behavior | 🟡 | Supported within the same anonymous browser; consent/reset/cross-device limitations apply. |

## C. Discovery

| Capability | Status | Evidence and caveat |
|---|---|---|
| Canonical discovery state and surface | 🟢 | `analytics_discovery_states` records stable state identity, `surface_type`, filters, ordering context, and result count. |
| Full ordered eligible result set | 🟢 | `analytics_discovery_results` stores every product/brand member with 1-based `position`; RPC enforces count equality atomically. |
| Qualified impressions | 🟢 | Product/brand impressions use the existing ≥50% IntersectionObserver qualification and event deduplication. |
| Absolute position | 🟢 | Canonical membership and events carry 1-based position/source position. |
| Search ID/query | 🟢 | `search_id`, query/search term, revision, and canonical state are recorded. |
| Category/subcategory/product type, filters, gift dimensions, price, sort | 🟢 | Canonical state columns plus `active_filters` retain the active discovery constraints. |
| Brand directory | 🟢 | Canonical states include brand results and qualified brand impressions/selections. |
| Homepage | 🟢 | `homepage_default` canonical state captures the complete eligible set. |
| SEO landing | 🟡 | Surface and interactions are measurable; whether a page has a canonical result set depends on that page's implementation. |
| Infinite scroll | 🟢 | It reveals members of the same canonical state and does not create a second opportunity. |

## D. Non-canonical surfaces

Brand-page products, more-from-brand, related products, saved products, named collections, shared collections, and blog recommendations have stable `source_surface`, 1-based position, and product/brand context. Origin product context exists for related and more-from-brand. Collection analytics uses opaque `collection_id` and omits collection/board names.

All are 🟢 **RELIABLE** as instrumentation capabilities. Blog recommendations are currently 🟡 **RELIABLE WITH CAVEAT** operationally because live content contains no recommendation cards; the contract is implemented and tested but cannot yet produce observations. Saved/local collection continuity is browser-local. Shared collections deliberately exclude PII and names.

## E. Product and brand funnel

| Stage | Status | Canonical source |
|---|---|---|
| Returned / Eligible | 🟢 | Product/brand membership in `analytics_discovery_results`, keyed by discovery state and position. |
| Qualified Impression | 🟢 | `product_impression` / `brand_impression`, direct source fields, qualified visibility. |
| Selection Click | 🟢 | `view_product` / `view_brand` with `metadata.view_stage = selection_click`. |
| Page Load | 🟢 | `view_product` / `view_brand` with `metadata.view_stage = page_load`. |
| Consideration | 🟢 | Direct actions: `save_product`, `add_to_collection`, and sharing where the UI emits it; behavioral consideration can be derived separately. |
| Outbound Intent | 🟢 | `outbound_product_click` / `outbound_brand_click`. It is intent, never purchase or conversion. |

Rates must deduplicate by the relevant visitor/opportunity/entity tuple, not divide arbitrary event totals. Canonical eligible denominators apply only to canonical discovery surfaces; non-canonical surfaces begin at qualified exposure unless their complete eligible set is independently represented.

## F. Consideration

- 🟢 Directly observed: product save, add to collection, collection share, product share where emitted, outbound click.
- 🟢 Derived behavioral signals: repeat product/brand page load, multiple products from one brand, related-product and more-from-brand exploration, cross-session return to a product/brand.
- 🟡 Cross-session signals remain anonymous-browser signals and legacy `view_product` without `view_stage` must be classified conservatively as an undifferentiated legacy view.

## G. Search intelligence

| Capability | Status | Caveat |
|---|---|---|
| Demand, returned count, zero results, supply | 🟢 | Search event/state and canonical `result_count`. |
| Qualified exposure, selection, consideration, outbound | 🟢 | Direct `source_search_id` / state attribution connects downstream facts. |
| Reformulation | 🟡 | Deterministic sequence of changed queries within a session/search episode; intent equivalence is not inferred. |
| Abandonment | 🟡 | Absence of downstream meaningful activity within a declared episode/window; tab closure is not directly observed. |
| Search → filter/category refinement | 🟢 | Ordered canonical states and filter/category events. |
| Search success levels | 🟢 | Can be a transparent ordinal hierarchy from exposure through outbound intent. |
| Exact external Google query | 🔴 | Requires Search Console. |

## H. Demand × supply

Query, category, recipient, occasion, and selected filter demand; supply counts; zero/thin supply; weak engagement; and intent leakage are 🟢 **RELIABLE** inputs. Thin/weak classifications are 🟡 until distribution-based eligibility and minimum-sample rules are specified. These describe Bulgaritam demand signals only.

## I. Product performance

Eligible appearances, qualified exposures, unique exposed visitors, selection/page-view/consideration/outbound rates, repeat interest, position distribution, surface mix, acquisition mix, and search-context mix are 🟢 **RELIABLE** for V2 observations. Legacy-stage ambiguity and sparse cohorts are 🟡 caveats. Product keys must use a composite identity; `product_id` alone is not globally unique.

## J. Brand performance

Brand exposure, product exposure, direct brand attention, portfolio attention, consideration, outbound intent, repeat interest, discovery gateways, traffic drivers, and intent drivers are 🟢 **RELIABLE** as derived facts. Brand-level conclusions require aggregation across composite product identities and transparent opportunity context.

## K. Choice sets and competition

Co-return, co-exposure, same-opportunity selection, brand co-exposure, head-to-head opportunities, and position/context stratification are 🟢 **RELIABLE** from canonical state membership plus qualified impressions. Behavioral competitors are 🟡 until sufficient repeated head-to-head evidence exists. Taxonomy similarity alone is not behavioral competition.

Every product key must be based on `product_id + brand_id`, with deterministic slug fallbacks for missing legacy IDs. `product_id` is **not globally unique**.

## L. Price and attribute intelligence

- 🟢 Price-filter demand is directly measurable from canonical state/filter context.
- 🟡 Viewed, saved, and outbound price ranges/materials/colors/audience/gift attributes/gemstones are derivable by joining product identity to catalogue context.
- Catalogue facet completeness is separate from instrumentation: a missing catalogue attribute means unknown, not absence or lack of demand.
- 🔴 Willingness-to-pay and optimal price are not observed.

## M. Confidence and benchmark readiness

Unique visitor denominators, samples, opportunity counts, cohorts, medians, quartiles/IQR, percentiles, equivalent time windows, and reliability labels are all technically available. Status is 🟢 **RELIABLE** for inputs and 🟡 **RELIABLE WITH CAVEAT** for conclusions until real distributions inform centralized minimum-sample and cohort-size thresholds. No thresholds are asserted by this audit.

## N. Representativeness limitations

- Bulgaritam user behavior is not Bulgarian population behavior.
- An anonymous browser is not guaranteed to be one human.
- Outbound intent is not a purchase.
- Exact Google organic query is unavailable without Search Console.
- Identity does not cross devices.
- The data supports no demographic inference.
- Consent gating means non-consenting activity is intentionally absent.

## Business-question readiness matrix

| Business question | Status | Required source/events | Caveat | Ready for derived model? |
|---|---|---|---|---|
| How many consenting visitors and sessions were active? | 🟢 | journey/session IDs, timestamps | Browser-scoped identity | YES |
| Which discovery opportunities were available and exposed? | 🟢 | discovery states/results, impressions | V2 canonical surfaces | YES |
| Which products win attention fairly? | 🟡 | eligibility, exposure, selection, cohort dimensions | Needs minimum-sample/cohort rules | YES |
| Which searches have no or thin supply? | 🟢 | search states and result counts | Thin threshold remains configurable | YES |
| Where does attention fail to become consideration or intent? | 🟡 | funnel facts | Absence is not a causal explanation | YES |
| Which surfaces directly drive selection? | 🟢 | direct source surface/state/position | Keep influenced attribution separate | YES |
| Which acquisition sources lead to downstream quality? | 🟢 | acquisition fields plus journey facts | Anonymous-browser scope | YES |
| Which products/brands are behavioral alternatives? | 🟡 | repeated canonical co-exposure/head-to-head facts | Requires adequate opportunity samples | YES |
| What do Bulgarian consumers prefer? | 🔴 | Representative population research | Bulgaritam is not representative | NO |
| Which outbound click became a purchase? | 🔴 | Merchant-side conversion integration | Outbound is intent only | NO |
| What exact Google query produced an organic visit? | 🔴 | Search Console | Not in browser referrer | NO |
| What is a person's cross-device journey? | 🔴 | Authenticated identity/linkage | No such identity exists | NO |

## BLOCKERS BEFORE DERIVED ANALYTICS

There are no instrumentation or schema blockers for the requested first derived analytics layer. The layer must explicitly handle legacy stage ambiguity, composite product identity, consent/browser identity, catalogue incompleteness, sparse cohorts, and canonical versus non-canonical denominators.

**FOUNDATION READY FOR DERIVED ANALYTICS**
