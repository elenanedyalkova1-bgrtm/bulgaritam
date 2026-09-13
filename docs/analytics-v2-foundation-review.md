# Analytics V2 Foundation Review

Reviewed commits: `5ed1c49` and `17e763b`, against the capability audit and measurement specification. This is a strict first-pass review; implementation code was not changed.

### Executive verdict

## NOT READY

The implementation is a useful prototype, but it is not safe to wire into a UI yet. The most important problems are unit mismatches inside the product funnel, an unstratified product cohort that can produce misleading labels, fabricated cohort-size inputs in confidence checks, period-local “returning” logic, and search reconstruction that is not session-local. None requires a Supabase schema change.

### Critical issues

1. **Product funnel stages do not share a linkable unit.** `productFunnel` deduplicates every stage with `visitor + direct state + direct position + product`. Selection has an opportunity state/position, while destination page load, consideration, and outbound commonly have `product_page` context with no discovery state/position. All such events for one visitor/product therefore collapse together and are divided by differently keyed selections. `pageViewRate`, `considerationRate`, and `outboundRate` are not reliable funnel-transition rates.
2. **Insight product cohorts are hard-coded to `all-products`.** Products across different surfaces, taxonomy, position, price, device, acquisition, and opportunity conditions are compared as peers. Hidden-winner, underperformer, and outbound-intent labels are therefore not opportunity-adjusted as required by the measurement specification.
3. **Confidence checks fabricate cohort evidence.** Search and surface rules pass `Math.max(actual cohort size, minimumCohortSize)` and repeat interest passes the minimum itself. These rules can satisfy cohort eligibility when no real cohort of that size exists.

### High-priority issues

1. **Returning visitors are window-local.** A visitor is returning only when two session IDs occur in the supplied analysis slice. A visitor whose earlier session falls before `start` is labeled new. The source contract has no lookback/as-of history input.
2. **Search reformulation is globally adjacent, not session-local.** Each episode compares only with the next globally ordered search group. An intervening search from another session prevents a real reformulation; grouping by bare `search_id` can also merge a reused/corrupt ID across sessions.
3. **Direct search attribution falls back to `event.searchId`.** The implemented hierarchy is `source_search_id || search_id`. That can promote a general/legacy/persisted search field to direct attribution. Only explicit direct state/search context should be direct in V2; fallback must be marked inferred legacy.
4. **Discovery opportunity integrity is assumed.** Missing states, missing/truncated members, count mismatches, duplicate positions, and foreign results are silently ignored or partially aggregated. A dry-run query that hit Supabase’s 1,000-row response cap immediately demonstrated why repository pagination plus integrity validation is mandatory.
5. **Missing visitor identity collapses unrelated facts.** Product journey and funnel keys use the empty visitor string when identity is absent, merging unrelated legacy/corrupt observations across sessions. Session identity should be a conservative fallback or the fact should be explicitly unidentifiable.
6. **“Repeat interest” is actually period-local returning visitors.** The snapshot maps all returning anonymous visitors to `repeatInterest`; it does not require repeat interaction with the same product or brand. The label and insight statement overstate the represented behavior.
7. **Brand journey facts are incomplete.** Direct `brand_impression`, `view_brand/selection_click`, and `view_brand/page_load` are not modeled. `BrandJourneyFact` is built mainly from product facts plus brand outbound, so it cannot yet support the specified brand funnel or repeat-brand interest.

### Medium-priority issues

- Search episodes retain final result count but do not expose ordered filter/category transitions, episode bounds, abandonment cutoff, or direct/influenced downstream facts separately.
- Search aggregation keys queries exactly as stored; case/Unicode/spacing variants fragment demand.
- Zero-result opportunity fires when *any* grouped search has zero results, while the displayed current value is median supply. Mixed zero/non-zero groups can produce an overstated statement.
- Product cohort medians include the subject itself. This is tolerable for large cohorts but distorts small cohorts.
- `uniqueVisitors` on a product funnel row includes any visitor with any downstream fact, not specifically unique exposed visitors; the insight snapshot names it only `visitors`, making misuse easy.
- Surface aggregates are raw event counts, while product funnel counts are visitor-opportunity normalized. The distinction is not encoded in their names/types.
- Origin product context is retained only inside raw event payload. There is no normalized composite `originProduct` identity for related/more-from-brand analysis.
- `directPosition` can become `NaN` for malformed truthy payload values; it is typed as `number | null` without validation.
- State-only sessions use one timestamp as both start and end. This is conservative, but session duration is not meaningful for them.
- Timestamp ties fall through to sequence and storage ID, but invalid/missing sequence is coerced to zero by the legacy parser. The rule is deterministic, not necessarily true causal order.
- The insight engine declares `anomaly` and `friction` types but implements no rule for them. This is acceptable for a foundation only if the UI does not imply those families are available.

### Acceptable caveats

- Event-level duplicate suppression by `event_id` is sound when the ID exists; the database unique index supplies an additional guarantee.
- Legacy events without `view_stage` are retained separately rather than silently called click or page load.
- Brand identity uses brand ID with slug fallback. Current production product facts had no missing brand key in the dry run.
- Product identity includes both product and brand parts, so the known non-global product-ID collision is handled in product funnel and insight subject keys.
- Outbound language is consistently intent-oriented and does not claim purchase.
- Statistical helpers return `null` for empty/zero-denominator inputs.

### Derived-model findings

| Fact/metric | Implemented unit | Review |
|---|---|---|
| Visitor | unique journey ID | Correct browser-scoped identity; incomplete without lookback. |
| Session | unique session ID | Correct basic unit; conflicting journey IDs are silently resolved to the first. |
| Journey | journey ID with session list | Correct grouping, but no ordered visit/return intervals. |
| Canonical discovery opportunity | discovery-state row | Correct nominal unit; integrity is not validated. |
| Discovery member | state-position entity row | Correct product-/brand-opportunity unit; input completeness is assumed. |
| Qualified exposure facts | deduplicated event | Raw fact is event-level; product funnel later converts it to visitor-product-opportunity. |
| Selection facts | deduplicated event | Correct `selection_click` classification. |
| Page-view facts | deduplicated event | Correct `page_load` classification, but not linked back to selection. |
| Consideration facts | deduplicated event | Direct action event: save, add-to-collection, product share. |
| Product/brand outbound facts | deduplicated event | Correct direct intent facts. |
| Summary exposure/selection/view/action/outbound | event | Names do not state raw-event unit. |
| Product funnel eligible/exposed/selected | visitor-product-opportunity | Eligible and exposed/selected are broadly aligned on canonical surfaces. |
| Product funnel page-view/considered/outbound | visitor-product with usually blank opportunity fields | Unit mismatch with selection/eligible denominators. |
| Product `uniqueVisitors` | visitor with any product stage | Not equivalent to unique exposed visitor. |
| Search episode | grouped search ID (or session+query fallback) | V2 ID grouping is useful; reformulation and corruption isolation are unsafe. |
| Surface aggregate | raw stage event | Valid raw counts, not normalized rates. |
| Product journey fact | visitor-product across all sessions | Useful cross-session container; empty visitor IDs collide. |
| Brand journey fact | visitor-brand across available product/outbound facts | Missing direct brand exposure/view stages. |
| Returning anonymous visitor | journey with ≥2 sessions inside input | Session-window metric, not historical returning status. |

Event ordering is `occurred_at → sequence_number → storage id`. Range loading is expected to use half-open event boundaries, but the source interface does not state or enforce the same boundary contract for discovery states. Sessions crossing a requested boundary are truncated and can distort starts, ends, and returning status.

### Insight-engine findings

| Family | Trigger and subject | Rate/comparison | Evidence/confidence/suppression | False-positive risk |
|---|---|---|---|---|
| Search demand movement | Same exact query exists in both periods and absolute change ≥20% | searches vs previous searches | ≥20 current searches/opportunities; confidence helper | Query fragmentation; no previous minimum; fake cohort size. |
| Zero/thin supply | Any zero occurrence or median supply ≤3 | supply shown without comparison | ≥20 searches; provisional threshold | One zero among many non-zero searches can trigger; “3” is not distribution-derived. |
| High exposure + low selection | Exposure ≥ all-product median and rate <75% of median | selected/exposed vs cohort median | ≥20 exposed/eligible, cohort nominally ≥5 | Non-comparable products; subject included in median. |
| Hidden winner | Exposure below median and selection rate >125% of median | selected/exposed vs cohort median | Same as above | Same unstratified cohort; “lower exposure” may reflect surface/position. |
| Strong outbound intent | Rate >125% of all-product median | outbound/exposed | Reuses selection confidence/sample | Denominator differs from measurement spec’s multiple explicit variants; outbound sample itself can be tiny. |
| Surface change | Exposure change ≥20% | raw exposure events vs prior period | ≥20 current events; fake cohort size | Traffic/eligible opportunity changes are not controlled. |
| Acquisition quality | outbound events / unique visitors vs source median | source rate vs current-source median | ≥20 visitors, ≥5 real sources | Event numerator can exceed visitor denominator; sources are not context-stratified. |
| Repeat-interest movement | returning visitors / period visitors changes ≥20% | current vs previous | ≥20 visitors; fake cohort size | It measures window-local return, not repeat product/brand interest. |

The engine suppresses sparse product/acquisition rules reasonably when actual cohort size is supplied. It safely returns no result on zero denominators and avoids causal, purchase, and Bulgarian-population language. However, the regex guard is not a semantic safety system; correctness must come from rule templates and tests.

### Identity findings

`productIdentity` uses `product_id::brand_id` and deterministic slug fallbacks. Product funnel, product journeys, insight subjects, and cohort rows preserve the composite key. No reviewed product-level map directly keys only on product ID.

Unsafe or incomplete areas:

- normalized origin-product identity is absent;
- missing brand ID and brand slug produce a shared `slug:` brand part, making legacy product-ID collisions unresolved rather than explicit;
- missing visitor IDs collapse otherwise separate product/brand journey keys;
- brand portfolio facts omit direct brand stages rather than colliding identities.

### Attribution findings

Implemented hierarchy:

1. Surface: `payload.source_surface`, then legacy `listContext`, then `sourceContext`.
2. Direct state: only `payload.source_discovery_state_id`.
3. Direct search: `payload.source_search_id`, then `event.searchId`.
4. Position: `payload.source_position`, then payload `position`.
5. Influenced state: `payload.last_discovery_state_id`, always stored separately.

Related and saved clicks retain their immediate surface and a stale `last_discovery_state_id` does not overwrite it. The problematic exception is the unmarked `event.searchId` fallback: it can make a non-explicit legacy/general search association appear direct. The model also exposes no first-class influenced search ID or direct/influenced aggregate pair.

### Funnel findings

- Eligible → exposure and exposure → selection can use visitor-product-opportunity units on canonical surfaces.
- Page-view rate using selection as denominator is valid only when page loads are linked to their originating selections. The current implementation does not link them, so the formula is invalid as implemented.
- Consideration should expose explicit variants: per selected opportunity, per destination page view, and per qualified exposure. The current single page-view denominator is permitted by the spec only when labeled and linked; neither condition is satisfied.
- Outbound should likewise expose page-view-based and exposure-based variants. The single current page-view denominator is not enough.
- Raw repeated events remain available, while funnel deduplication prevents one visitor/opportunity from inflating exposure/selection. Conversely, all page loads/outbounds for a visitor/product can be over-collapsed across sessions because their opportunity fields are blank.
- Non-canonical surfaces generally lack full eligible denominators and must not receive an eligible/opportunity rate by implication.

### Search findings

Search state groups correctly retain multiple canonical states under one `search_id`, allowing filter states to remain connected. Directly attributed downstream events are matched through source search/state.

The episode model is not yet safe because grouping is not session-scoped, reformulation adjacency is global, episode time bounds are absent, exact query normalization is absent, and filters/category transitions are not materialized. An unrelated event with only stale `last_discovery_state_id` is not absorbed, which is good; an event carrying fallback `event.searchId` can be.

### Cohort/confidence findings

Statistical primitives for median, interpolated quartiles, percentile, absolute/percentage change, and zero-safe rates are correct for their documented simple definitions.

Current cohorts are **not defensible** for production product labels: every product is assigned `all-products`. Surface, taxonomy/product type, position, price, device, visitor status, acquisition, and time-window comparability are not implemented, nor is the documented sparse fallback hierarchy.

Current default thresholds are centralized:

- minimum sample: `20`
- minimum opportunities: `20`
- minimum cohort size: `5`
- medium sample/opportunities: `50`
- high sample/opportunities: `200`, plus cohort size ≥`10`
- material period change: `20%`
- thin supply maximum: `3`
- relative rate lift/gap: `25%`

They are explicitly provisional, which is appropriate. The dangerous behavior is not only the values: some rules manufacture the cohort-size input, outbound insights use exposure eligibility instead of an outbound-specific evidence minimum, and previous-period samples are not independently guarded.

### Consideration review

| Signal | Current classification | Review |
|---|---|---|
| `save_product` | Direct consideration action | Strong explicit signal. |
| `add_to_collection` | Direct consideration action | Strong explicit signal. |
| `share_product` | Direct consideration action | Explicit but potentially motivation-ambiguous; keep separately inspectable. |
| `share_collection` | Not product consideration | Correctly excluded from product consideration. |
| Repeat product page view | Product journey stage only | Correctly not counted as direct consideration, but no repeat-interest metric exists yet. |
| Repeat brand view | Not modeled | Missing derived repeat-brand signal. |
| Outbound | Separate intent stage | Correctly not double-counted as consideration. |

No composite consideration score is implemented. Page load and selection are not directly counted as consideration, which avoids misleading double counting.

### Returning/repeat-interest findings

The model can list distinct sessions per journey and product, so cross-session product return is derivable from `ProductJourneyFact.sessionIds`. It does not currently calculate repeat product interest, repeat brand interest, cross-session consideration, or time-to-return. Multiple page loads in one session do not make the visitor “returning,” but multiple sessions inside the requested window do. The anonymous-browser/no-cross-device caveat remains documented.

### Test coverage gaps

| Case | Coverage |
|---|---|
| Same product ID + different brand ID | Covered. |
| Duplicate impression | Partially: repeated opportunity with different event IDs is tested; same-event-ID duplication is not. |
| Same product selected twice | Missing. |
| Page reload | Partially: repeated page loads are counted, but cross-session/linkage behavior is not asserted. |
| Repeated outbound | Missing. |
| Same visitor across sessions | Covered only for returning summary. |
| Different visitors sharing one session/corruption | Missing. |
| Search reformulation | Covered only for globally adjacent single-session happy path. |
| Zero results | Covered only as an episode result, not insight mixed-supply behavior. |
| Search followed by unrelated navigation | Missing. |
| Related-product origin | Surface/stale state covered; normalized origin identity is not. |
| Stale last search | State separation covered; `event.searchId` fallback risk is not. |
| Named collection | Surface exposure covered. |
| Shared collection | Missing. |
| Legacy view without stage | Covered. |
| Malformed/missing optional fields | Missing. |
| Timestamp ties | Missing. |
| Events supplied out of order | Missing. |
| Sparse cohort | Covered. |
| Zero denominator | Covered for helper. |
| Comparison period with no data | Only indirectly; no explicit all-rule assertion. |
| Opportunity/member truncation or mismatch | Missing. |
| Brand impression/click/page-load funnel | Missing. |
| Cross-window returning visitor | Missing. |

### Real-data dry-run findings

A read-only dry run used production Supabase data for `2026-08-30T00:00:00Z`–`2026-09-14T00:00:00Z`; no rows were written or modified.

- 4,133 events; 105 journey IDs; 142 sessions; 23 canonical states.
- 2,775 discovery members; all 23 states matched their stored `result_count` when members were fetched per state.
- 2,593 eligible product opportunities; 2,752 raw qualified impression events; 2,493 normalized product exposures.
- 6 selections, 6 product page loads, 4 consideration actions, 32 product outbound events, and 5 brand outbound events.
- 554 composite product rows; 549 had canonical eligibility and 540 had exposure. No production product row lacked both brand ID and brand slug.
- Top sessions contained 489, 359, 168, 167, and 131 events. The period includes rollout/smoke traffic, so these distributions are not suitable for business conclusions.
- Previous half-period had no V2 canonical states and only two visitors; equivalent-period comparison is not yet representative.
- Search reconstruction yielded 9 episodes and 4 reformulation candidates, but the global-adjacency flaw prevents treating that count as reliable.
- Snapshot generation produced one product cohort only: `all-products`.
- Default insight generation produced zero insights in this sparse/asymmetric period. Suppression is preferable to weak claims, but this run does not validate the unsafe cohort logic.

The first dry-run member query returned exactly 1,000 rows and false count mismatches because it was not paginated. A corrected per-state read returned all 2,775 members and zero mismatches. Repository wiring must make complete pagination and integrity checks non-optional.

### Issue table

| Issue | Severity | File/function | Why it matters | Smallest fix | Requires schema change? |
|---|---|---|---|---|---|
| Funnel stage unit mismatch | Critical | `analytics-derived.ts:205-214` | Transition rates compare differently keyed facts | Build explicit selection→page-load journey linkage and expose labeled rate variants | NO |
| All-products cohort | Critical | `analytics-insights.ts:92-93` | Product labels compare non-peers | Build transparent strata and documented sparse fallback | NO |
| Fabricated cohort size | Critical | `generateAnalyticsInsights` search/surface/repeat rules | Sparse evidence can pass confidence | Pass actual comparison population; suppress when absent | NO |
| Window-local returning status | High | `deriveAnalyticsDomain:174-187` | Existing visitors can be called new | Accept prior-history/as-of visitor sessions or load explicit lookback | NO |
| Global search adjacency | High | `deriveAnalyticsDomain:227-239` | Reformulations are missed/misattributed | Partition and order episodes per session; key by session+search ID | NO |
| General search ID promoted to direct | High | `stageFact:157` | Stale search can become direct source | Keep explicit direct ID separate; mark fallback legacy/inferred | NO |
| Member integrity not enforced | High | `deriveAnalyticsDomain:173,198-202`; source contract | Truncation silently changes denominators | Paginate, validate counts/positions/ownership, fail closed | NO |
| Empty visitor collisions | High | funnel/journey keys | Unrelated legacy facts merge | Use session/event fallback and expose identity quality | NO |
| Returning mislabeled repeat interest | High | `buildInsightSnapshot:103` | Insight claims a behavior not measured | Separate platform return from product/brand repeat facts | NO |
| Missing direct brand stages | High | `brandJourneyFacts` | Brand funnel/repeat metrics cannot be trusted | Add brand exposure/selection/page-load facts | NO |
| Exact query grouping | Medium | snapshot search map | Demand fragments | Add deterministic normalized grouping key plus display query | NO |
| Any-zero opportunity trigger | Medium | insight line 115 | Mixed supply can overstate gap | Report zero rate and define deterministic eligibility | NO |
| Origin identity not normalized | Medium | `StageFact` | Cross-sell product collisions remain possible | Add composite origin product identity | NO |
| Malformed position can be NaN | Medium | `stageFact:158` | Keys and drill-down become unstable | Validate positive integer or null | NO |
| Subject included in cohort | Medium | product insight comparison | Small-cohort median is biased | Use leave-one-out peer reference | NO |

No production schema change is required. Review and fixes should remain in pure derived/repository-loading code before any dashboard wiring.

### Corrective implementation result

The approved corrective implementation is complete. Funnel stages now expose event, unique-visitor, and unique product-opportunity counts separately. Downstream facts retain session/product/direct attribution and carry either an explicit/session-sequence opportunity link or `null`; unknown context is never fabricated. Returning status accepts an explicit historical lookback. Search episodes are session-scoped. Discovery loading is paginated and incomplete states fail closed. Direct brand stages and cross-session product/brand repeat facts are first-class.

The insight layer now constructs transparent, leave-one-out cohorts with this fallback order: product type + surface + position band; product type + surface; subcategory + surface; category + surface; product type; otherwise suppress. It never falls back to all products. Confidence accepts actual subject samples, visitors, opportunities, cohort sizes, and comparison samples; no minimum value is substituted as evidence.

### Issues resolved

- Removed incompatible universal funnel rate and added denominator-specific transition/rate variants.
- Preserved composite product identity everywhere and isolated missing visitor/session identity from visitor-level metrics.
- Added lookback-based returning visitors and true cross-session product/brand repeat facts.
- Removed `event.searchId` as direct attribution; legacy/persisted context remains influenced only.
- Partitioned search ordering and reformulation by session, retaining filter states inside one search ID.
- Added paginated state/member reads, count/position validation, diagnostics, and incomplete-opportunity suppression.
- Added brand impression, selection, page-load, outbound, repeat-interest, and multi-product exploration facts.
- Replaced `all-products` with explicit defensible cohort fallbacks and actual cohort metadata.
- Removed artificial confidence evidence and added independent comparison-sample guards.
- Tightened repeat-interest insight eligibility after the real-data run exposed a tiny-numerator false positive.

### Remaining caveats

- Session-sequence opportunity linkage is deterministic but explicitly marked inferred; events that cannot be linked remain unlinked.
- Product/brand identity without a brand ID/slug is marked ambiguous and excluded from identity-dependent visitor opportunity counts where necessary.
- Confidence thresholds and `thinSupplyMax=3` remain centralized and provisional until longer post-rollout distributions are available.
- Current production volume is too sparse for product-performance insights: this is correct suppression, not a failure.
- The comparison period overlaps instrumentation rollout and smoke-test traffic. Surface-change output must not yet be interpreted as durable business movement.
- Identity remains consenting anonymous-browser identity and does not cross devices. Outbound remains intent, not purchase.

### Real-data revalidation

Read-only corrected-repository run for current `2026-09-07`–`2026-09-14`, previous `2026-08-31`–`2026-09-07`, with lookback from `2026-08-01`:

- 53 visitors and 67 sessions; 2 visitors had valid pre-period history.
- 24 complete and 0 incomplete canonical discovery states; 2,787 members loaded with no integrity diagnostics.
- 2,605 eligible product opportunities; 1,263 qualified exposures; 6 selections; 8 page loads; 4 considerations; 13 product outbound intents.
- 491 brand qualified impressions; 5 brand selections; 6 brand page loads; 5 brand outbound intents.
- Cross-session repeat facts covered 1 unique product-repeat visitor and 2 unique brand-repeat visitors. Raw repeat fact counts remain available separately and are not visitor denominators.
- 430 defensible leave-one-out cohorts were constructible; peer sizes ranged 5–98 with median 10. No product met all real default sample/visitor/opportunity requirements, so product labels were suppressed.
- One surface behavior-change insight was emitted for `homepage_default` (403 vs 302 qualified exposures, MEDIUM confidence, 20 visitors, 2,184 current eligible opportunities). Because rollout/smoke traffic affects the windows, it is technically valid but not yet business-representative.
- The initially emitted 2-vs-1 brand-repeat change was judged absurdly sparse and eliminated by requiring the real repeat numerator in both periods. The final run emitted no repeat insight.

### Final verdict

## READY WITH MINOR CAVEATS

The fact and insight foundations are now defensible for repository/UI wiring, provided the UI preserves unit labels, incomplete-state diagnostics, inferred-linkage markers, confidence/sample evidence, and sparse suppression. No schema change is required.
