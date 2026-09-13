# Analytics V2 UI wiring

## Repository flow

The admin analytics request creates the existing server-only `SupabaseAnalyticsRepository` and performs one bounded event read covering historical lookback, the previous equivalent period, and the selected period. Canonical discovery states are loaded once for the previous and selected periods. Their result members are loaded in deduplicated state-ID chunks through the repository's complete pagination path.

The processing order is:

`repository load → deduplication/range partition → discovery integrity validation → derived domain → period snapshots → deterministic insight engine → Bulgarian view model → server-rendered admin UI`

No browser-side Supabase client or credential is introduced. V1 reuses the selected and previous event arrays returned by this same load instead of issuing another analytics event query.

## Date, comparison, and lookback

- Current activity uses the existing admin half-open range `[start, end)`.
- Comparison is the immediately preceding range of equal length `[previousStart, start)`.
- Historical lookback begins 90 days before `previousStart` by default. It is bounded and is used only to classify returning visitors and cross-session repeat interest.
- Events before the selected range never count as current activity.
- The load result exposes all three boundaries and explicit comparison/lookback availability.
- When the previous period has neither events nor discovery states, comparison insights are suppressed and the UI says that comparison data is insufficient.

## Sections added

Analytics V2 appears above a clearly marked Analytics V1 section. V1 reports and tables remain available for parallel validation.

1. **Какво се случва** — eligible deterministic insights only.
2. **Пътят до интерес** — eligible opportunity, qualified exposure, selection, product page, consideration, and outbound-intent stages.
3. **Търсене** — demand, visitors, zero results, reformulation, selection/outbound rates, and query drill-downs.
4. **Откъде хората откриват продукти** — surface-level discovery behavior.
5. **Продукти** — composite product/brand identity and decision-useful stage metrics.
6. **Брандове** — direct brand facts kept separate from product-derived brand facts.
7. **Връщащ се интерес** — browser-scoped returning and cross-session repeat facts.
8. **Качество на трафика** — source/medium/campaign/referrer groups with tiny groups suppressed.
9. **Качество и надеждност на данните** — admin-only tracking/integrity diagnostics.

The existing date presets/custom range control applies to both versions. Existing brand/product/category filters remain V1-only in this first side-by-side phase; the page labels this explicitly because V2 conclusions require the complete period population.

## Metric mappings

- **Допустими възможности**: unique identifiable visitor-product-state-position units from complete canonical discovery states.
- **Реално показване**: qualified `product_impression` facts; its eligible rate uses only linked unique opportunities.
- **Отваряне от списък**: `view_product` with `view_stage=selection_click`; its rate uses linked exposure opportunities.
- **Преглед на продуктова страница**: `view_product` with `view_stage=page_load`; the selection rate is shown only when an opportunity link is available.
- **Сигнал за интерес**: save, add-to-collection, and product-share facts. Page-load and exposure variants remain separately calculated.
- **Преминаване към сайта на бранда**: outbound intent, never purchase or sales. Page-load and qualified-exposure denominator variants stay distinct.
- Search rates use session-scoped search episodes.
- Canonical surfaces may show eligible opportunities. Non-canonical surfaces show “Не е приложимо”, never a fabricated zero denominator.
- Product identity remains the product + brand composite key.
- Brand direct impression/selection/page-load/outbound metrics remain distinct from product-derived exposure/selection/outbound metrics.

## Insight and empty-state behavior

Insight text is generated only from structured insight objects through deterministic Bulgarian templates. Cards include comparison, evidence, real sample size, confidence, caveat, and a follow-up question/action. No AI-generated prose is used.

Confidence is presented as “Ниска/Средна/Висока увереност”. Provisional calibration is stated. Sparse samples, missing comparison data, missing cohorts, missing search demand, repeat interest, and acquisition data have explicit empty states. Thresholds are not lowered to populate the page.

## Reliability behavior

- Result/member reads retain repository pagination beyond 1,000 rows.
- Event IDs, state IDs, and result identities are deduplicated defensively.
- Count mismatch or duplicate member positions make a discovery state incomplete; it is excluded from eligible denominators and reported in diagnostics.
- Legacy undifferentiated views and missing visitor identity are reported, not silently normalized into stronger facts.
- Repository/network errors keep the existing controlled admin failure and safe server diagnostics.

## Performance observations

The final read-only production validation for 2026-09-07 through 2026-09-14 loaded 4,231 bounded events and 6,960 discovery members in approximately 3.6 seconds locally. It made one paginated event window load, one paginated state load, and chunked/paginated member loads. All derivation, aggregation, insights, and view-model construction then reused those in-memory rows; there is no query per product, metric, or insight.

This is practical for the current volume, but server execution time should be observed as the dataset grows. No cache, materialized table, or schema optimization is introduced in this phase.

## Read-only validation snapshot

- Current events: 2,261; previous events: 1,967; pre-comparison lookback events: 3.
- Complete current discovery states: 36; incomplete: 0; current members: 6,960; integrity diagnostics: 0.
- Search episodes: 9 across 2 visitors; no zero-result episode; reformulation rate 44.4%.
- Funnel display counts: 6,666 eligible opportunities, 1,300 qualified exposure events, 6 selections, 8 product page loads, 4 consideration signals, and 13 outbound intents. Transition rates remain opportunity-linked and are unavailable where the evidence cannot support a shared denominator.
- Product rows: 551; brand rows: 93; acquisition groups surviving the minimum two-visitor display threshold: 3.
- Returning anonymous visitors: 2 of 56; unique repeat-product visitors: 1; unique repeat-brand visitors: 2.
- One medium-confidence `homepage_default` surface behavior-change insight remained eligible. Product-performance conclusions remained suppressed, as expected for the sample.

The period contains rollout/smoke activity and is suitable for wiring validation, not durable business conclusions.

## Known limitations

- The 90-day lookback is bounded. A browser last seen before it may be classified as new.
- Anonymous identity is browser-scoped and cannot identify a person or connect devices.
- Session-sequence opportunity linkage remains explicitly inferred; unlinked downstream facts retain counts but do not receive fabricated transition rates.
- Current confidence and thin-supply thresholds are provisional.
- V2 catalog labels use safely available event context; there is no new per-product catalog query.
- Acquisition groups with fewer than two visitors are hidden. This is a conservative initial UI threshold, not a quality score.
- No schema changes, public-site changes, deployment, brand reports, paid reports, or Search Console integration are included.
