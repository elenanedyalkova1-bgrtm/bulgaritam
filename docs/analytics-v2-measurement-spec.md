# Analytics V2 Measurement Specification

This is the canonical specification for deterministic derived analytics after Phase 6A/6B. It applies to consenting Bulgaritam browsers and deliberately separates direct observation, derived behavior, and interpretation.

## Global conventions

### Identities and units

- **Visitor**: `anonymous_journey_id`; browser-scoped, never a guaranteed person.
- **Session**: `anonymous_session_id`.
- **Opportunity**: one canonical `discovery_state_id` and one member position.
- **Product identity**: `product_id + brand_id`; use product slug and then brand slug as deterministic legacy fallbacks. Product ID alone is not globally unique.
- **Brand identity**: brand ID, then brand slug fallback.
- **Direct attribution**: `source_surface`, `source_discovery_state_id`, `source_search_id`, and `source_position` on the action.
- **Influenced attribution**: `last_discovery_state_id`/persisted last context, reported separately and never substituted for direct source.
- **Time**: assign an event to a window by `occurred_at`; use half-open `[start, end)` intervals and equal-duration preceding comparison windows.
- **Deduplication**: raw event counts use unique `event_id` when present. Opportunity rates deduplicate by visitor + opportunity + entity + stage. Event rows without IDs remain distinct by storage ID/timestamp/sequence fallback.
- **Minimum data**: always return samples and opportunities. Suppress comparative labels when centralized eligibility rules are not met; do not turn missing data into zero.

### Canonical funnel

`Eligible / Returned → Qualified Impression → Selection → Page View → Consideration → Outbound Intent`

- Eligible: canonical discovery membership. Non-canonical surfaces do not claim an eligible denominator unless a complete set is represented.
- Qualified impression: `product_impression`/`brand_impression` after ≥50% visibility.
- Selection: `view_product`/`view_brand` with `view_stage=selection_click`.
- Page view: the corresponding event with `view_stage=page_load`.
- Consideration: direct `save_product`, `add_to_collection`, or supported share action. Repeat views are a separate behavioral signal.
- Outbound intent: `outbound_product_click`/`outbound_brand_click`; never purchase.

## Metric definition template

Every production metric record carries: name, business question, unit, numerator, denominator (nullable for counts), events, fields, deduplication, attribution, time rule, minimum-data behavior, caveat, decision value, and product destination.

## A. Platform health

| Metric | Business question / unit | Numerator and denominator | Source and rules | Caveat / decision value | Destination |
|---|---|---|---|---|---|
| Visitors | How many anonymous browsers participated? visitor | Distinct journey IDs / none | All valid events; window by event time | Consent/browser-scoped; platform reach | Internal, Future Public Index |
| Sessions | How many activity sessions occurred? session | Distinct session IDs / none | All valid events | Session lifecycle is client-defined | Internal |
| Returning anonymous visitors | How many visitors had prior-session activity? visitor | Visitors with an earlier distinct session / visitors | Journey + session chronology; require observable lookback | Left-censoring and browser resets | Internal, Paid Brand Intelligence |
| Discovery-active sessions | How many sessions created or used discovery? session | Sessions with canonical state/search/discovery event / sessions | States and directly attributed events | Excludes non-consenting sessions | Internal |
| Qualified product exposures | How much qualified attention was available? visitor-opportunity-product | Unique exposed tuples plus raw impressions / eligible tuples where available | `product_impression`, composite product key | Non-canonical denominator nullable | Internal, reports |
| Product selections | How often were products deliberately selected? visitor-opportunity-product | Unique selection tuples and raw clicks / qualified exposed tuples | `view_product`, `selection_click` | Legacy views excluded from stage rates | Internal, reports |
| Product page views | How many product destination loads occurred? visitor-product-session | Unique page-load tuples plus raw loads / selected tuples where linkable | `view_product`, `page_load` | Direct URL loads may have no selection | Internal, reports |
| Consideration actions | How often was explicit consideration observed? visitor-product-action | Unique direct actions plus raw count / page-view or exposure denominator per report | save/add/share events | Different actions remain separately inspectable | Internal, reports |
| Product outbound intent | How often did users leave toward a product? visitor-product-session | Unique outbound tuples plus raw clicks / page views or exposures | `outbound_product_click` | Not purchase | Internal, reports |
| Brand outbound intent | How often did users leave toward a brand? visitor-brand-session | Unique outbound tuples plus raw clicks / brand page views or reach | `outbound_brand_click` | Not purchase | Internal, reports |

## B. Discovery funnel metrics

For each stage expose both raw event/member counts and unique visitor-opportunity counts.

| Metric | Formula | Unit / deduplication | Required fields | Decision value / caveat | Destination |
|---|---|---|---|---|---|
| Eligible Opportunities | Count of discovery members | state-position-product | state ID, position, composite identity | Inventory of observable opportunities | Internal, reports |
| Qualified Exposure Rate | unique qualified exposed opportunity tuples / eligible opportunity tuples | visitor-state-position-product; eligible visitor comes from state owner | state/session/journey, impressions | Visibility efficiency; canonical surfaces only | Internal, reports, index |
| Selection Rate | unique selected opportunity tuples / qualified exposed tuples | visitor-state-position-product | selection stage, direct state/position | Card attention effectiveness | Internal, reports |
| Page View Rate | unique destination page-view tuples linked to selections / unique selections | visitor-product-session | stage, identity, timestamps | Navigation completion; direct loads reported separately | Internal, reports |
| Consideration Rate | unique products with consideration / unique page-viewed or exposed products (label denominator) | visitor-product-window | action and product identity | Intent depth, not conversion | Internal, reports |
| Outbound Intent Rate | unique outbound tuples / unique page-viewed or exposed tuples (label denominator) | visitor-product-window | outbound event, identity | Merchant-directed intent only | Internal, reports |

Never mix denominators under the same metric name. Rates return `null` when the denominator is zero.

## C. Search

| Metric | Definition and required source | Caveat / minimum data | Destination |
|---|---|---|---|
| Search Demand | Raw searches and distinct visitors/sessions by normalized query; `search_id`, query, time | Preserve original query for display; normalization only groups | Internal, Category / Market Report |
| Search Supply | Canonical result count and member count per search opportunity | Catalogue availability on Bulgaritam | Internal, reports |
| Zero-result Rate | Search opportunities with result count 0 / all search opportunities | No arbitrary sample label | Internal, reports |
| Low-supply Rate | Eligible searches whose supply falls below a configurable distribution-derived boundary / eligible searches | Boundary is centralized and provisional until distributions are reviewed | Internal, reports |
| Search Exposure Rate | unique exposed member opportunities / eligible search members | Canonical states only | Internal, reports |
| Search Selection/Consideration/Outbound Rate | unique directly attributed stage tuples / qualified search exposures | Use direct search/state attribution; last search is influenced only | Internal, reports |
| Reformulation Rate | Search episodes containing a subsequent materially different normalized query / episodes | Sequence-based candidate, no inferred semantic intent | Internal |
| Search Abandonment | Episodes with no exposure/selection/consideration/outbound before next episode/session inactivity boundary | Absence is observational; closure not observed | Internal |
| Search Success Level | Maximum deterministic direct stage: 0 none, 1 qualified results exposed, 2 selected, 3 considered, 4 outbound intent | Page load is reported but does not outrank explicit consideration; level is ordinal, not a score | Internal, reports |

Search episodes use `search_id`; when absent, conservative legacy grouping uses session + normalized query + bounded chronological adjacency and is marked legacy/inferred.

## D. Demand-gap dimensions

No composite magic score is permitted. Report demand volume, supply volume, exposure, selection, consideration, and intent separately.

- **Absolute Gap**: observed demand opportunity with zero supply.
- **Thin Supply**: positive supply below an eligible distribution/config boundary.
- **Choice Failure**: adequate qualified exposure but no/low selection relative to an eligible peer distribution.
- **Attention Failure**: eligible opportunities receive materially weak qualified exposure within comparable position/surface strata.
- **Intent Leakage**: selection/page attention occurs but downstream consideration/outbound is weak relative to an eligible cohort.

Eligibility requires minimum sample, opportunities, and cohort size from centralized configuration. Numeric production boundaries are not fixed until distributions are observed.

## E. Product performance

Metrics: Eligible Opportunities, Qualified Exposures, Unique Exposed Visitors, Selection Rate, Page View Rate, Consideration Rate, Outbound Intent Rate, Repeat Interest, Surface Mix, Search Demand Context, median/IQR position, and Acquisition Mix. Use the global product identity and attribution rules.

Future deterministic classifications:

| Label | Required evidence |
|---|---|
| Hero | Sufficient comparable opportunities; exposure, selection, and outbound/consideration all above eligible cohort references. |
| Hidden Winner | Below-cohort opportunity/exposure volume but above-cohort selection or intent rate with sufficient samples. |
| Attention Problem | Adequate eligible opportunities but qualified exposure or selection materially below comparable cohort. |
| Consideration Product | Consideration rate above peer reference with adequate page/exposure samples. |
| Traffic Driver | Product produces downstream internal exploration across multiple sessions, not merely raw views. |
| Intent Driver | Outbound intent rate and sample exceed comparable reference. |
| Discovery Gateway | Selection is followed by multi-product/brand exploration in the same journey. |
| Cross-sell Driver | Related/more-from-brand origin repeatedly precedes directly attributed selection/consideration. |

Labels are not assigned until confidence eligibility is met; no label implies causality.

## F. Brand performance

- Brand Qualified Reach: distinct exposed visitors across brand and its composite products.
- Brand Product Attention: unique qualified product exposures and selections.
- Brand Selection/Consideration/Outbound Intent Rates: unique brand-product visitor facts divided by explicitly labeled opportunity/exposure/page-view bases.
- Portfolio Breadth: distinct composite products exposed/viewed/considered per visitor and overall.
- Multi-product exploration: visitors engaging with ≥2 distinct brand products in the analysis window/session.
- Discovery gateway behavior: brand/product entry followed by additional internal brand-product engagement.
- Repeat-interest rate: visitors returning in another session for the brand or its products / eligible brand visitors.
- Demand fit: distribution of directly attributed query/filter/category opportunities involving the brand.

All are available to Internal, Free Brand Report (headline/adequately sampled), and Paid Brand Intelligence (context/cohorts). Category/Market reports may use anonymized aggregates.

## G. Opportunity-adjusted performance

**Observed Rate** is the subject's stage rate within a stratum. **Peer/Cohort Median** is the median comparable subject rate. **Percentile** is the subject's empirical rank. **Lift vs Cohort Median** is `(observed - median) / median`; return null when median is zero.

V1 uses transparent strata, in descending specificity: surface + category/product type + position band + price band + device + visitor status + acquisition + window. Sparse fallback removes dimensions in that order: visitor status, acquisition, device, price, product type, position, then category; surface is retained when semantics differ. Every comparison reports the actual cohort definition/size. If even the fallback cohort fails central eligibility, suppress the comparison.

## H. Choice sets and competition

- Co-return opportunity: two composite products in the same canonical result state.
- Co-exposure opportunity: both receive qualified impressions for the same visitor/state.
- Head-to-head qualified opportunity: co-exposure in comparable visibility/position context.
- Selection winner: one product selected directly from that head-to-head state; ties/no-selection remain explicit.
- Co-consideration: both products receive consideration within the declared journey/window.
- Behavioral competitor: repeated qualified head-to-head opportunities with selection tradeoffs and sufficient evidence.

Taxonomic competitors share catalogue taxonomy. They are not called behavioral competitors without behavioral evidence. Brand co-exposure aggregates composite products to stable brand identity.

## I. Return and retention of interest

Return Visitor = journey observed in a later distinct session. Repeat Product/Brand Interest = same identity viewed/considered in ≥2 sessions. Cross-session Consideration = consideration after prior-session exposure/view. Time to Return = elapsed time between qualifying sessions. Return After Outbound is measurable only when the same anonymous browser later returns; it does not prove merchant activity or purchase.

## J. Acquisition quality

Report each acquisition cohort's visitors, discovery-active sessions, qualified exposures, selections, considerations, outbound intents, and observable returns. Do not collapse these into one score. Direct and influenced downstream attribution remain separate. Product destinations: Internal and Paid Brand Intelligence; carefully aggregated Category/Market Report.

## K. Price and attribute intelligence

- Price-filter demand: visitors/search opportunities selecting a price constraint.
- Attention/consideration/outbound by price band: stage facts joined to catalogue price bands.
- Attribute demand: canonical selected filters/query context for material/color/audience/gift/gemstone/facet.
- Attribute attention/intent: product stage facts joined to populated catalogue facets.

Always report unknown catalogue values. These metrics describe observed behavior among Bulgaritam users; they do not establish willingness-to-pay or optimal price. Destinations: Internal, Paid Brand Intelligence, Category/Market Report.

## L. Confidence

Every insight includes raw sample size, unique visitors where relevant, opportunity count, comparison window, cohort definition and size, and `LOW | MEDIUM | HIGH` reliability. Thresholds are centralized and configurable. Initial defaults must be conservative and explicitly provisional; distribution review is required before production labeling. Insufficient evidence suppresses an insight rather than producing a weak claim.

## M. Insight output contract

```ts
type AnalyticsInsight = {
  type: "trend" | "anomaly" | "opportunity" | "hidden_winner" | "underperformer" | "friction" | "behavior_change" | "acquisition_quality";
  subject: { type: string; id: string; label?: string };
  statement: string;
  currentValue: number;
  comparisonValue: number | null;
  magnitude: { absolute: number | null; percent: number | null };
  sample: { events: number; visitors?: number; opportunities?: number; cohortSize?: number };
  confidence: "LOW" | "MEDIUM" | "HIGH";
  evidence: Array<{ metric: string; value: number; unit?: string }>;
  caveats: string[];
  suggestedAction?: string;
  drilldown: Record<string, string | number | boolean | null>;
};
```

The statement is a deterministic rendering of evidence. Interpretation cannot claim causality, population-wide preference, purchase, or demographic attributes. Suggested actions are questions/decisions to investigate, not facts.

## METRICS NOT TO BUILD

- Raw bounce rate as a headline KPI.
- Naive average time on site.
- Naive pages per session.
- Raw brand ranking without opportunity context.
- Purchase conversion without merchant conversion data.
- Inferred demographics.
- Willingness-to-pay or optimal price.
- Arbitrary composite/magic scores.
- Exact Google organic queries without Search Console.
- Cross-device person-level journeys.

This specification is internally consistent with the current V2 contract and requires no production schema change for the first derived domain layer.
