# Analytics V2 — Product and UX Information Architecture

Status: ready for UX implementation. This document specifies presentation and progressive disclosure only. It does not change measurement definitions, instrumentation, schema, thresholds, or production behavior.

## 1. Executive product principle

Analytics V2 is a decision aid for a Bulgarian business owner, not a smaller Google Analytics and not a BI export.

Its invariant hierarchy is:

> **Извод → доказателства → подробности и диагностика**

The default screen answers “Какво трябва да знам?”. It does not ask the user to interpret a wall of metrics. Every material conclusion should answer, when the evidence permits:

1. Какво се случва?
2. Колко голяма е промяната или разликата?
3. С какво я сравняваме?
4. Колко надежден е изводът?
5. Какво може да означава, without claiming causality?
6. Какво си струва да проверим or observe next?

The product speaks Bulgarian by default. Technical vocabulary, raw identifiers, implementation labels, denominators, and integrity detail are available only where they help validate a conclusion.

Hard semantic constraints:

- outbound is “преминаване към сайта на бранда”, never purchase, conversion, or sale;
- a consenting anonymous browser is not an identified person;
- observed Bulgaritam behavior is not representative of all Bulgarian consumers;
- sparse evidence produces an honest empty state, not a weak recommendation;
- comparisons use real eligible samples and defensible peers only;
- direct and influenced attribution remain distinct;
- product identity remains `product + brand`, even when the UI shows only a friendly product name.

## 2. Current UI diagnosis

The current V2 proves the full data path, but its information architecture exposes the derived model almost one-to-one:

- eight analytical sections and a diagnostic panel are expanded on one page;
- five sections default to wide tables with up to thirteen columns;
- Products and Brands behave like analyst exports rather than decision tools;
- Search contains useful information but requires scanning several tables;
- Acquisition starts with UTM/referrer dimensions rather than the business question;
- raw surface labels and event contexts can leak into presentation;
- the journey is visually a linear funnel although page loads and outbound actions may originate outside list selection;
- insight magnitude and business meaning do not dominate the card;
- caveats compete visually with the conclusion;
- V1 repeats many sections directly below V2 and makes the page substantially longer;
- narrow screens inherit horizontal scrolling instead of receiving a different reading order.

This is not primarily a styling issue. Overview, exploration, and diagnostic material need separate destinations and different default densities.

## 3. Final information architecture

Use one Analytics destination with three stable top-level modes:

| Level | Bulgarian label | Question | Default density |
|---|---|---|---|
| A | **Преглед** | Какво трябва да знам? | Conclusions and 4–6 supporting indicators |
| B | **Разглеждане** | Искам да разбера повече | One analytical area at a time |
| C | **Диагностика** | Искам да проверя данните | Quality, definitions, detailed tables, V1 |

The selected date range is global and persists across all three modes. Comparison and lookback status appear once near the date control, not repeatedly in each section.

Within **Разглеждане**, use a secondary navigation:

1. Търсене
2. Откриване
3. Продукти
4. Брандове
5. Връщащ се интерес
6. Източници на посещения

Only one area is rendered as the primary reading surface at a time. Direct links preserve `period`, subsection, and optional entity/query filters. Opening detail should not reset the selected period.

Entity drill-downs are third-level routes or panels:

- product detail: `/analytics/?view=explore&area=products&product=<composite-key>`;
- brand detail: `/analytics/?view=explore&area=brands&brand=<brand-key>`;
- search detail: `/analytics/?view=explore&area=search&query=<normalized-key>`;
- surface detail: `/analytics/?view=explore&area=discovery&surface=<presentation-key>`.

The URL examples describe state, not a required routing technology. Server-side rendering and the existing bounded repository load remain appropriate.

## 4. Overview specification — „Какво трябва да знам?“

### Immediate content

1. **Insight feed** — maximum five eligible insights, ordered by decision relevance, then confidence and magnitude. Never fill empty slots with weak insights.
2. **Discovery pulse** — at most four indicators:
   - разпознати посетители;
   - реални показвания на продукти;
   - отваряния на продукти;
   - преминавания към сайтове на брандове.
3. **Journey summary** — two related groups, not a conventional funnel.
4. **Demand and supply watch** — up to three search opportunities/problems with eligible evidence.
5. **Reliability notice** — only when comparison, lookback, or discovery integrity materially limits interpretation.

### Insight card anatomy

The visible card order is:

1. Bulgarian conclusion, one or two lines;
2. prominent magnitude: e.g. `+33,4%`;
3. plain comparison: `спрямо предходните 7 дни`;
4. one evidence sentence with natural units;
5. confidence label;
6. `Защо го виждам?` disclosure;
7. `Разгледай` link to the appropriate Explore area.

Insight ordering must be deterministic and testable. First rank material data-quality warnings that invalidate interpretation, then eligible demand/supply gaps, then eligible product or brand opportunities, then material period changes. Within one family rank confidence, real sample, and absolute magnitude. Do not compare unlike percentages merely to create one global “importance” score.

Example:

> **Продуктите на началната страница са били показвани по-често.**
> **+33,4%** спрямо предходните 7 дни
> 403 реални показвания сега, при 302 преди.
> Средна увереност
> Промяната съвпада с различна активност в периода; проверете посещенията и съдържанието преди решение.

Do not headline raw internal IDs, sample arrays, cohort definitions, or generic messages such as “metric changed”.

### Overview empty state

If no insight is eligible:

> **Все още няма достатъчно данни за надеждни автоматични изводи за този период.**
> Можете да разгледате търсенията, продуктите и източниците без да ги приемате като доказана тенденция.

The discovery pulse may still appear as descriptive activity. It must not use arrows or colors that imply meaningful change when comparison evidence is insufficient.

In low-data periods Overview must still answer something useful without manufacturing conclusions. Show one compact factual sentence (`За периода са отчетени {visitors} разпознати посетители и {exposures} реални показвания`) plus the most useful next destination (`Разгледайте какво е търсено` or `Вижте откъде са дошли посещенията`) when that area contains data. Hide empty indicator cards rather than filling the page with zeros. If an observed zero is based on complete data, label it as activity, not performance.

## 5. Explore specification — „Искам да разбера повече“

Each Explore area follows one consistent pattern:

1. one-sentence business question;
2. 2–4 summary facts;
3. eligible conclusions/opportunities;
4. compact list with 3–5 columns maximum;
5. row/card drill-down;
6. a quiet link to definitions or diagnostic detail.

Explore must not render all areas simultaneously. Desktop uses tabs or segmented navigation. Mobile uses a select/menu plus a page title. Tables are reserved for actual comparison across entities; event sequences and explanations use cards or timelines.

## 6. Diagnostics specification — „Искам да проверя данните“

Diagnostics contains three collapsed groups:

### A. Надеждност на данните

- events loaded for selected/comparison/lookback windows;
- complete and incomplete discovery states;
- discovery members and integrity diagnostics;
- legacy undifferentiated views;
- events missing visitor identity;
- comparison and lookback availability;
- explanation of excluded incomplete states.

### B. Подробни данни

- full product, brand, search, surface, acquisition, page, and session tables;
- direct versus influenced attribution fields;
- opportunity-link method and missing-link counts;
- technical UTM/referrer breakdown;
- exact cohort definition, size, sample, position band, and fallback level;
- export-like wide tables, only here.

### C. Analytics V1 — временно

V1 remains available in one collapsed panel labelled:

> **Analytics V1 — стар диагностичен изглед**
> Запазен временно за сравнение. Метриките му не трябва да се използват като заместител на V2 изводите.

Opening V1 is an explicit action. It is never fully expanded below V2 by default. Its existing brand/product/category filters remain inside the V1 panel so they do not appear to filter V2.

## 7. Journey presentation specification

Do not use one arrow-connected six-stage funnel. Present two related blocks plus a source note.

### Откриване в списъци

| Step | Primary wording | Supporting evidence |
|---|---|---|
| Available | Възможности продукт да бъде открит | canonical opportunities only |
| Seen | Реални показвания | qualified visibility; show eligible-based rate only when linkable |
| Opened | Отваряния от списъци | selection clicks; show exposure-based rate only when linkable |

Visual form: three compact steps or a horizontal relationship on desktop, stacked on mobile. Arrows are permitted because this block uses compatible opportunity units, but the displayed rate must state its base in ordinary language: `5 от 100 реални показвания са довели до отваряне`.

### Интерес след посещение

| Signal | Primary wording | Supporting evidence |
|---|---|---|
| Page visit | Прегледи на продуктови страници | includes direct, organic, internal, and list-origin visits |
| Consideration | Сигнали за интерес | save/add/share remain inspectable separately |
| Outbound | Преминавания към сайтове на брандове | intent only |

Visual form: three parallel signal cards, not sequential funnel steps by default. When a page visit is actually linked to a list selection, a secondary sentence may show that transition. Otherwise say `Няма достатъчно свързани действия за надежден процент`.

Persistent explanation, visually quiet:

> Някои продуктови страници и преминавания към бранд започват от директни, органични или други посещения. Затова тези числа не са задължително част от отварянията в списъци.

## 8. Search specification

Search is the strongest decision-oriented Explore area.

### Search landing

Immediately show:

- `{N} търсения от {M} разпознати браузъра`;
- `X без резултат` or a positive `Няма търсения без резултат` only with adequate observation;
- number of queries with limited choice;
- number of queries that led to product opening or outbound intent.

Then show four prioritized groups as cards/lists:

1. **Най-търсени** — търсене, честота, обичаен брой предложения, one later interest signal.
2. **Без резултат** — търсене, брой повторения, latest relevant context.
3. **Малък избор** — търсене, наблюдаван брой предложения, sample caveat.
4. **Има търсене, но слаб интерес към резултатите** — only when real display and comparable-product eligibility support it.

The default list has at most four columns: търсене, брой търсения, наличен избор, наблюдавана реакция. “Наблюдавана реакция” is a short phrase such as `3 отваряния` or `няма измерено отваряне`, not a cluster of rates. Do not expose “query”, “supply”, or “median” in the primary wording. Where a robust central value is needed, say `обичаен брой предложения`; the exact median and distribution belong in detail or Diagnostics.

### Query drill-down

- търсения сега и през сравнявания период;
- разпределение на броя предложения, не само една средна стойност;
- реални показвания, отваряния, сигнали за интерес и преминавания към бранд;
- session-scoped reformulation sequence;
- filters/category refinements;
- directly attributed products and brands;
- непосредствен източник versus earlier context that may have influenced the journey, explained in Bulgarian;
- размер на наблюденията, увереност и exact measurement note.

Do not create a search score. Do not equate reformulation with dissatisfaction without supporting evidence.

## 9. Discovery-surface presentation taxonomy

Use one reusable mapping in product presentation. Unknown raw values fall into Diagnostics until intentionally classified; never mechanically replace underscores and show them as product labels.

### Primary discovery groups

| Raw value | Primary Bulgarian label | Group | Eligible denominator? |
|---|---|---|---|
| `homepage_default` | Начална страница | Начална страница | Yes |
| `search_results` | Търсене | Търсене | Yes |
| `category` | Категории | Категории и продуктови групи | Yes |
| `subcategory` | Подкатегории | Категории и продуктови групи | Yes |
| `product_type` | Типове продукти | Категории и продуктови групи | Yes |
| `gift_discovery` | Откриване на подаръци | Подаръци | Yes |
| `seo_landing_page` | Тематични и SEO страници | Тематични страници | Yes when a complete state exists |
| `brand_directory` | Каталог с брандове | Брандове | Yes, for brand members |
| `brand_directory_search` | Търсене на бранд | Брандове | Yes, for brand members |
| `brand_page_products` | Продукти в профил на бранд | Страници на брандове | No |
| `related_products` | Свързани продукти | Продуктови препоръки | No |
| `more_from_brand` | Още от този бранд | Продуктови препоръки | No |
| `blog_recommendations` | Препоръки в статии | Съдържание и препоръки | No |
| `saved_products` | Запазени продукти | Лична колекция | No |
| `named_collection` | Колекции | Колекции | No |
| `shared_collection` | Споделени колекции | Колекции | No |

### Contexts that are not discovery surfaces

| Raw/context value | Presentation rule |
|---|---|
| `product_page` | Group under “Продуктова страница” as visit/action origin, not a discovery surface |
| `brand_page` | Group under “Страница на бранд” as visit/action origin, not a discovery surface |
| `save_modal` | Show only in action diagnostics; never as a discovery surface |
| individual `/p/.../` paths | Resolve to the relevant product detail or group as “Продуктови страници”; never make each path a top-level surface |
| other URL paths | Classify by page type or presentation taxonomy; retain exact path only in drill-down/Diagnostics |

The primary surface list shows the grouped Bulgarian label. Raw value and exact path are available in Diagnostics.

## 10. Product intelligence UX

### Product landing

Default content:

- count of products with measurable exposure;
- count with enough evidence for comparison;
- up to five eligible notable-product conclusions;
- compact list: **Продукт · Бранд · Реални показвания · Наблюдавана реакция · Основен начин на откриване**.

“Наблюдавана реакция” is the most decision-useful eligible fact, for example:

- `12,4% са довели до отваряне`;
- `4 преминавания към сайта на бранда`;
- `все още няма достатъчно данни за сравнение`.

Do not default-sort as “best products”. Default order is `eligible insight relevance`, then evidence volume, with a visible sort label. Raw views alone never imply performance.

### Product drill-down

1. friendly product and brand identity;
2. eligible conclusions/classifications from the engine;
3. discovery distribution: where shown, qualified exposure, median/IQR position;
4. observed response: opening, page visit, consideration, outbound;
5. returning interest;
6. query/demand context;
7. related/more-from-brand origin and downstream exploration when derived;
8. comparison with “сходни продукти”, including cohort definition and size behind disclosure;
9. technical attribution/opportunity detail in Diagnostics.

Future labels — “висок интерес”, “скрит потенциал”, “видимост без достатъчен интерес”, “води към сайта на бранда”, “повторен интерес”, “вход към разглеждане”, “свързан интерес” — appear only when a deterministic eligible rule supports them. No label is a neutral state, not a negative verdict.

Composite identity is never dropped from routing, aggregation, export, or drill-down even if IDs are hidden visually.

## 11. Brand intelligence UX foundation

### Current internal brand landing

Default list: **Бранд · Видимост на продуктите · Отваряния · Преминавания към сайта · Сигнал за по-широко разглеждане**. Avoid ordinal “top/best brand” framing.

Separate two evidence families:

- **Профил на бранда**: brand impression, brand selection, brand page load, brand outbound;
- **Продуктите на бранда**: product exposure, selection, consideration, outbound, repeat interest.

### Brand drill-down foundation

The page should eventually answer in this order:

1. **Какво трябва да знае брандът?** Eligible conclusions only.
2. **Видимост** — real product/brand exposure and where it occurs.
3. **Внимание** — products opened relative to defensible opportunities.
4. **Сигнали за интерес** — saves/adds/shares, separately inspectable.
5. **Преминаване към сайта на бранда** — observed transition, never purchase.
6. **Повторен интерес** — behavior across separate visits in the same anonymous browser.
7. **Разглеждане на портфолиото** — multiple products from the brand.
8. **Контекст на търсенето** — queries, filters, categories, gifts, and choice sets in which the brand appears.
9. **Сходни продукти/брандове** — privacy-safe, opportunity-adjusted comparison only.
10. **Какво да се провери** — evidence-backed questions, not prescriptive claims.

The information architecture supports future Exposure → Attention → Consideration → Intent → Repeat interest → Demand fit, but does not pretend these are one nested funnel.

No naive brand leaderboard is allowed. Brand comparison must control for surface, taxonomy/product type, position, and other supported context, with real cohort size exposed behind disclosure.

## 12. Returning-interest UX

Lead with a sentence, not four isolated counters:

> **2 от 56 разпознати браузъра са се върнали след по-ранно посещение в наблюдавания период.**

Then show two separate supporting facts:

- `1 браузър е проявил повторен интерес към същия продукт в друга сесия.`
- `2 браузъра са проявили повторен интерес към същия бранд в друга сесия.`

If zero or sparse, say:

> Все още няма достатъчно наблюдения между отделни посещения, за да оценим повторния интерес.

Permanent quiet explanation:

> Разпознаваме анонимен браузър, не идентифициран човек. Данните не свързват различни устройства. Повторенията в една сесия не се броят като връщане.

## 13. Acquisition UX — „Откъде идват хората и какво правят след това?“

### Human channel layer

Map technical values into understandable first-level channels:

- Директни посещения
- Търсачки
- Социални мрежи
- Имейл
- Други сайтове
- Кампании
- Неопределен източник

The mapping is deterministic, mutually exclusive, and documented. Explicit campaign/UTM evidence wins over referrer inference; known search-engine referrers map to “Търсачки”, known social referrers to “Социални мрежи”, email medium to “Имейл”, external referrers to “Други сайтове”, and absence of campaign and external referrer to “Директни посещения”. Unknown values remain “Неопределен източник”; they are never guessed from page behavior.

Default list: **Източник · Посетители · Разглеждали продукти · Какво са направили**. The last cell summarizes product opening, interest signals, and transitions to brand sites in one readable line.

An acquisition detail shows:

- visitors and sessions;
- landing-page groups;
- discovery-active sessions;
- qualified exposure, product opening, consideration, outbound;
- observable returning visitors when eligible;
- comparison period;
- UTM source/medium/campaign and exact referrer only under `Технически подробности`.

Do not create one quality score. “More outbound per visitor” is an observed behavior, not proof that a channel is commercially better.

## 14. Bulgarian Intelligence Language Layer

Implement this later as a reusable presentation module, not scattered component dictionaries. It owns labels, grammatical number, formatting, sentence templates, and safe fallbacks.

### A. Metric labels

| Internal meaning | Primary Bulgarian wording |
|---|---|
| visitor | разпознат посетител / разпознат браузър in privacy explanation |
| session | посещение when technical precision is not required |
| eligible opportunity | възможност продуктът да бъде открит |
| qualified impression/exposure | реално показване |
| selection | отваряне на продукт / отваряне от списък |
| product page load | преглед на продуктова страница |
| consideration | сигнал за интерес |
| outbound intent | преминаване към сайта на бранда |
| repeat interest | повторен интерес |
| multi-product exploration | разглеждане на няколко продукта |
| peer cohort | сходни продукти / сходни брандове |
| thin supply | малък избор / ограничено предлагане |

### B. Surface labels

Use the taxonomy in section 9. Unknown labels render as `Друг контекст` in primary UI and retain the raw value only in Diagnostics.

### C. Insight templates

Templates are composed from:

`subject + observed behavior + magnitude + comparison + evidence + uncertainty + investigation`

Examples:

- `Търсенията за „{query}“ са се увеличили с {change} спрямо {period}, но изборът остава малък.`
- `Когато {product} бъде реално показан, хората го отварят по-често от сходни продукти.`
- `{surface} е донесла повече реални показвания: {current} сега при {previous} преди.`
- `{brand} е разглеждан чрез няколко различни продукта, но извадката още е малка за сравнение.`

Never use “хората обичат”, “продава”, “конвертира”, “тренд в България”, or “заради”.

### D. Confidence wording

- Ниска увереност
- Средна увереност
- Висока увереност

Tooltip/disclosure: `Увереността зависи от броя наблюдения, посетители, възможности и наличната база за сравнение.`

### E. Insufficient-data wording

- `Все още няма достатъчно данни за надеждно сравнение.`
- `Няма достатъчно свързани действия за този процент.`
- `Тази група е скрита, защото извадката е твърде малка.`
- `Няма наблюдавана активност за избрания период.` — only when a complete load proves true zero.

### F. Comparison wording

- `спрямо предходните {N} дни`;
- `{current} сега, при {previous} преди`;
- `спрямо типичното ниво за сходни продукти`;
- `няма достатъчно данни от предходния период`.

### G. Caveat wording

Use one short relevant caveat near the conclusion. Put the full methodological note behind disclosure.

- `Наблюдаваното поведение не показва причината за промяната.`
- `Данните са за съгласили се посетители на Bulgaritam.`
- `Преминаването към сайт на бранд не означава покупка.`
- `Разпознаваме браузър, не човек.`

### H. Suggested-investigation wording

Questions, not commands:

- `Проверете дали промяната съвпада с ново съдържание или повече посещения.`
- `Струва си да наблюдавате дали малкият избор се запазва.`
- `Сравнете представянето в сходна позиция и повърхност.`
- `Проверете кои продукти продължават разглеждането към бранда.`

## 15. Progressive-disclosure rules

| Information | Visible immediately | “Виж повече” | Entity drill-down | Diagnostics only |
|---|---:|---:|---:|---:|
| Eligible insight conclusion/magnitude/confidence | Yes |  |  |  |
| Evidence sentence and comparison | Yes |  |  |  |
| Sample and one caveat |  | Yes |  |  |
| Exact cohort definition/fallback/percentile |  |  | Yes | Raw fields |
| Search demand/supply/response summary | Yes in Search |  |  |  |
| Search filters, sequence, attributed entities |  |  | Yes | Raw IDs/events |
| Product/brand notable status | Yes when eligible |  |  |  |
| Full product/brand metrics |  |  | Yes | Wide export table |
| Human acquisition channel | Yes |  |  |  |
| UTM/referrer tuple |  |  | Yes | Exact raw tuple |
| Data-quality warning affecting conclusions | Yes |  |  |  |
| Complete integrity diagnostics |  |  |  | Yes |
| Sessions/raw journeys |  |  |  | Yes |
| Analytics V1 |  |  |  | Yes, collapsed |

No primary table may require horizontal scrolling at the intended desktop width. If more than five columns are needed, move fields to drill-down instead of shrinking typography.

## 16. Empty and sparse-data states

Empty states distinguish four meanings:

1. **True zero:** `Няма наблюдавани търсения без резултат за избрания период.`
2. **Insufficient sample:** `Има наблюдения, но все още не са достатъчни за надежден извод.`
3. **Unavailable comparison:** `Няма достатъчно данни от предходния период.`
4. **Unavailable/incomplete tracking:** `Част от данните не могат да участват в изчислението. Вижте „Диагностика“.`

Section-specific copy:

- Insights: `Все още няма достатъчно данни за надеждни автоматични изводи.`
- Cohorts: `Няма достатъчно сходни продукти с надеждна извадка.`
- Search: `Няма измерено търсене за избрания период.`
- Repeat interest: `Все още няма достатъчно наблюдения между различни посещения.`
- Acquisition: `Няма източник с достатъчно посетители за надеждно сравнение.`

Never replace “insufficient” with `0`, and never treat missing catalogue data as absence of a product attribute.

## 17. Mobile and narrow-screen behavior

- Top-level mode becomes a three-item segmented control or compact menu.
- Explore subsections become a labelled select/menu; only one subsection is present at a time.
- Insight card order remains conclusion → magnitude → comparison → confidence → disclosure.
- Journey groups stack vertically and remain visibly separate.
- Product, brand, search, and acquisition rows become summary cards with 2–3 facts; tapping expands or navigates to detail.
- No primary horizontal table scrolling. Diagnostics tables may scroll and must be labelled `Подробни данни`.
- Date presets become horizontally scrollable controls; the analytical content itself does not.
- Sticky controls must not consume excessive viewport height.
- Caveats collapse behind `Как е измерено?`, except a material reliability warning.

## 18. What remains diagnostics-only

- raw event names and payload fields;
- `event_id`, storage ID, session/journey IDs, state/search IDs;
- raw `source_surface`, `source_context`, `list_context`;
- exact paths and individual product-page paths;
- `source_discovery_state_id`, `last_discovery_state_id`, direct/influenced attribution mechanics;
- sequence number and timestamp tie-breaking;
- opportunity-link method (`explicit`, `session_sequence`, missing);
- event/member counts by storage page;
- incomplete-state codes and affected IDs;
- legacy undifferentiated events;
- identity-quality/fallback flags;
- exact cohort definition, fallback level, cohort size, quartiles, percentile;
- raw UTM/referrer tuples;
- wide V2 tables and all V1 reports/session timelines.

## 19. Future compatibility

### Platform Intelligence

The Overview/Explore/Diagnostics separation directly supports internal decisions. No current data decision blocks it. The language layer and entity drill-down contracts should be shared rather than duplicated in future products.

### Brand Intelligence

The brand drill-down foundation can power a future authenticated own-brand product. Current direct brand facts, composite products, demand context, attribution, repeat interest, and portfolio exploration are sufficient inputs. Before external release, add brand-scoped insight rules, privacy/minimum-sample policy, permissions, and a stable catalogue join. Do not expose competitor identities or tiny peer groups by default.

### Market Intelligence

Search, canonical supply, filters, category/gift context, price constraints, and catalogue attributes can support aggregate market reports. Required future work includes distribution-based thresholds, catalogue completeness diagnostics, seasonality baselines, privacy rules, and report-specific aggregation. Exact Google organic queries require Search Console. Purchase, willingness-to-pay, and market-share claims require new external data.

### Choice sets and behavioural competitors

Already captured:

- complete ordered products/brands in each canonical state;
- stable opportunity, visitor, session, entity, and position identity;
- qualified impressions, selections, downstream actions, and direct state attribution;
- product composite and brand identities.

Derivable later:

- co-return matrices;
- co-exposure matrices;
- same-state selection outcomes;
- brand-level choice sets;
- head-to-head opportunity counts stratified by surface/position/context.

Still required before productization:

- explicit derived choice-set and head-to-head fact models;
- comparable visibility/position rules;
- repeated-opportunity minimum samples;
- tie/no-selection treatment;
- privacy-safe suppression and wording;
- tests against product-ID collisions and incomplete states.

No new instrumentation is required for canonical choice-set analysis. Non-canonical surfaces cannot support complete choice sets unless they later capture their full eligible membership.

## 20. Current V2 element mapping

| Current V2 element | Decision | Destination / new treatment |
|---|---|---|
| Date presets/custom range | KEEP | Global header across Overview/Explore/Diagnostics |
| Comparison status pill | CHANGE | One plain period sentence/status near date control |
| “Какво се случва” insight cards | KEEP + CHANGE | Overview; conclusion and magnitude visually first, details disclosed |
| Confidence calibration note | MOVE | Method disclosure in Diagnostics; short confidence tooltip globally |
| Six-stage “Пътят до интерес” | CHANGE | Overview journey summary split into “Откриване” and “Интерес след посещение” |
| Funnel denominator caveat | CHANGE | One plain-language explanation; technical bases in Diagnostics |
| Search summary KPIs | KEEP + REDUCE | Explore → Търсене; maximum four immediate summary facts |
| Top search table | CHANGE | Compact four-column list; query drill-down |
| Zero-result table | KEEP + CHANGE | Prioritized Search opportunity list |
| Thin-supply table | KEEP + CHANGE | Prioritized Search opportunity list, only eligible classifications |
| High-demand weak-response table | KEEP + CHANGE | Search opportunity list, only when sample/cohort supports it |
| Surface performance table | CHANGE | Explore → Откриване; grouped taxonomy, compact cards/list |
| Raw surface labels | HIDE | Diagnostics; use Bulgarian presentation taxonomy |
| Product table with 13 columns | CHANGE | Explore → Продукти compact list; full table Diagnostics; product drill-down |
| Brand table with 10 columns | CHANGE | Explore → Брандове compact list; full table Diagnostics; brand drill-down |
| Returning-interest four cards | CHANGE | Explore → Връщащ се интерес; one human sentence plus two facts |
| Anonymous-browser caveat | KEEP + DE-EMPHASIZE | Permanent quiet explanation in Returning detail |
| Acquisition technical table | CHANGE | Explore → Източници; human channels and behavior summary |
| UTM/medium/campaign/referrer columns | MOVE | Acquisition drill-down and Diagnostics |
| Data-quality details | KEEP + MOVE | Diagnostics → Надеждност на данните; warning only in Overview when material |
| Existing V1 metric grid | MOVE | Diagnostics → Analytics V1 collapsed |
| V1 search/filter/product/brand/page tables | MOVE | Diagnostics → Analytics V1 collapsed |
| V1 funnel/context/session/acquisition | MOVE | Diagnostics → Analytics V1 collapsed |
| V1 device exclusion control | KEEP | Diagnostics/V1 controls or global admin tracking control, clearly separated |
| Existing global brand/product/category filters | MOVE | Inside V1; future V2 filtering belongs within relevant Explore area |

## 21. DATA/DERIVATION GAP CHECK

Legend:

- 🟢 already supported in the current derived/repository/insight foundation;
- 🟡 derivable from already captured data but not yet productized;
- 🟠 requires additional derived logic, eligibility policy, or robust catalogue joining;
- 🔴 requires new instrumentation or an external data source.

| Capability | Status | Exact gap / constraint |
|---|---|---|
| Platform visitors, sessions, current/comparison windows | 🟢 | Browser-scoped and consent-limited |
| Returning anonymous visitors with bounded lookback | 🟢 | Left-censored beyond the configured lookback |
| Cross-session product/brand repeat interest | 🟢 | Current facts exist; UX needs sentence rendering |
| Correct product opportunity/exposure/selection facts | 🟢 | Canonical surfaces only for eligible denominators |
| Direct product/brand page, consideration, outbound facts | 🟢 | Outbound is intent, not purchase |
| Current per-product insight rules | 🟢 | Hidden-winner/underperformer/outbound rules exist and suppress sparse evidence |
| Rich per-product drill-down | 🟡 | Facts exist; demand/surface/position panels need productization |
| Full product portfolio classifications | 🟠 | Hero, gateway, cross-sell, traffic/intent driver rules are specified but not all derived |
| Current brand fact summary | 🟢 | Direct and product-derived facts exist |
| Per-brand deterministic insights | 🟠 | Requires brand-specific cohorts, rules, confidence eligibility, and tests |
| Brand portfolio breadth/multi-product exploration | 🟢 | Derived multi-product facts exist |
| Brand discovery gateway classification | 🟠 | Requires ordered downstream exploration logic and eligibility rules |
| Implemented product peer comparison | 🟢 | Current leave-one-out cohorts control for product type/taxonomy, surface and position band through explicit fallback levels; only implemented eligible rules may use them |
| Broader context-adjusted product comparison | 🟠 | Price, device, visitor status and acquisition are not present in the current cohort builder; adding them requires derived logic, fallback policy and eligibility tests |
| Opportunity-adjusted brand peer comparison | 🟠 | Brand cohort definition/aggregation not implemented |
| Search demand, supply, zero results | 🟢 | Current session-scoped episodes and canonical states support them |
| Search reformulation candidate | 🟢 | Deterministic sequence exists; semantic intent equivalence is not inferred |
| Search abandonment | 🟠 | Requires explicit inactivity/episode boundary logic and cautious wording |
| Search → product/brand direct demand context | 🟡 | Direct IDs and states exist; entity-centric aggregations/drill-downs are not productized |
| Filter/category/gift demand context | 🟡 | Captured in canonical states; transition/detail view needs derived presentation |
| Co-return in one canonical result state | 🟡 | Direct state-member join is available |
| Qualified co-exposure | 🟠 | Requires pairwise derived facts, deduplication, and comparable visibility rules |
| Choice sets | 🟠 | Requires explicit choice-set model, selection/no-selection outcomes, and eligibility |
| Behavioural competitors | 🟠 | Requires repeated qualified head-to-head evidence and privacy-safe thresholds |
| Non-canonical complete choice sets | 🔴 | Full eligible membership is not captured for these surfaces |
| Demand share within Bulgaritam search | 🟠 | Requires defined universe, normalization, windows, and denominator policy |
| General market demand share | 🔴 | Requires representative external market/search data |
| Whitespace: demand with zero/thin Bulgaritam supply | 🟡 | Inputs exist; robust distribution-based classification needs productization |
| Whitespace as Bulgarian market opportunity | 🔴 | Requires external representative demand/supply data |
| Price-filter demand | 🟡 | Captured in discovery `active_filters`, but the current V2 repository projection and derived domain do not load/materialize it yet |
| Attention/intent by catalogue price band | 🟠 | Requires reliable catalogue join, bands, completeness diagnostics, and cohorts |
| Willingness-to-pay or optimal price | 🔴 | No purchase/experiment/merchant data |
| Material/color/audience/gift/attribute demand | 🟡 | Selected filters/context captured; presentation aggregations not productized |
| Attribute-based product attention/intent | 🟠 | Requires catalogue join and explicit unknown-value handling |
| Seasonality | 🟠 | Requires sufficient longitudinal history, comparable calendar baselines, and rules |
| Anomaly/friction insight families | 🟠 | Types exist in the insight contract, but no current deterministic rules implement them; UX must not imply availability |
| Exact Google organic query | 🔴 | Requires Search Console integration |
| Search Console impressions/clicks/position | 🔴 | External data source not integrated |
| Purchase conversion/revenue | 🔴 | Requires merchant-side conversion data |
| Cross-device person journey | 🔴 | Requires authenticated identity/linkage; must not be inferred |

The existing canonical discovery architecture preserves enough information for future co-exposure and choice-set work. The gap is derived modeling and eligibility, not current canonical instrumentation. Price/attribute intelligence needs a dependable catalogue context join. Search Console, purchase, representative market-share, and cross-device claims remain explicitly unavailable.

Adversarial interpretation rule: “captured” does not mean “available in the current UI pipeline”. `active_filters` and some gift/attribute context exist in storage but are not all projected into the current `DiscoveryStateRow` repository read or derived model. UX phases may name those areas only after a separately reviewed repository/derivation extension; they must not fabricate them from event fallbacks. Likewise, the current insight engine implements search trend/supply, limited product peer, surface change, acquisition-quality and repeat-interest rules. It does not yet implement generic anomaly/friction, brand insight, gateway, cross-sell, seasonality, or market-share conclusions.

## 22. Implementation plan in small safe phases

### Phase UX-1 — Navigation and language foundation

- introduce Overview / Explore / Diagnostics state;
- centralize Bulgarian metric, surface, comparison, confidence, caveat, and empty-state language;
- classify unknown surface/context values safely;
- keep all existing calculations unchanged;
- add presentation-contract tests.

Acceptance: no raw surface label or English analytical term appears in primary UI; V1 remains reachable and unchanged inside Diagnostics.

Exact allowed implementation scope for this first phase:

- `admin-app/src/pages/analytics.astro` — presentation composition and mode state only;
- `admin-app/src/components/AnalyticsV2.astro` — split/recompose the current presentation;
- new components under `admin-app/src/components/analytics-v2/` for the navigation shell and shared presentation primitives;
- a new `admin-app/src/lib/analytics-v2-language.ts` for deterministic labels/templates;
- `admin-app/src/lib/analytics-v2.ts` only where necessary to expose a presentation-ready value without changing metric semantics;
- new or updated Analytics V2 presentation tests under `admin-app/tests/`;
- this UX specification or UI wiring documentation if implementation behavior needs clarification.

Explicitly forbidden in Phase UX-1:

- `admin-app/src/lib/analytics-derived.ts`;
- `admin-app/src/lib/analytics-insights.ts`;
- `admin-app/src/lib/analytics-v2-loader.ts`;
- `admin-app/src/lib/supabase-analytics.ts`;
- ingestion/browser tracking code, public-site components, migrations, Supabase schema/data, thresholds, event contracts, attribution, identity, or denominator rules;
- brand reports, market reports, choice-set derivations, Search Console, deployment, or deletion of V1.

If Phase UX-1 reveals that a desired label cannot be produced without changing a derived fact, display the existing safe fact or suppress it and defer the derivation. Do not silently widen Phase UX-1.

### Phase UX-2 — Overview and journey correction

- rebuild insight-card hierarchy;
- limit eligible insight feed to five;
- add restrained discovery pulse;
- split journey into discovery steps and post-visit signals;
- add material reliability notice logic.

Acceptance: no conventional six-stage funnel; magnitude, base, confidence, and next question are understandable without opening Diagnostics.

### Phase UX-3 — Search and discovery Explore areas

- create Search summary, prioritized opportunity groups, and query drill-down;
- group discovery surfaces using the presentation taxonomy;
- move exact paths/raw labels to Diagnostics;
- preserve canonical versus non-canonical denominator rules.

Acceptance: no primary table exceeds five columns or requires horizontal scrolling.

### Phase UX-4 — Product and brand intelligence

- replace wide default tables with compact entity lists;
- add product and brand drill-downs;
- expose only currently eligible engine classifications;
- keep exact cohort evidence behind disclosure;
- do not add unimplemented portfolio/brand labels.

This phase remains presentation-only for existing facts and existing eligible product insights. Brand-specific conclusions, new gateway/cross-sell classifications, broader peer controls, and behavioural-competition logic require separately reviewed derived-product phases and must not be smuggled into Phase UX-4.

Acceptance: composite identity is preserved and no naive ranking is introduced.

### Phase UX-5 — Returning interest, acquisition, and diagnostics

- render returning facts as human sentences;
- add human acquisition channels and downstream summaries;
- move UTM/referrer detail, wide V2 tables, sessions, and V1 into Diagnostics;
- distinguish true zero, sparse sample, missing comparison, and tracking incompleteness.

Acceptance: primary UI is decision-oriented; diagnostic depth remains available without dominating it.

### Phase UX-6 — Local validation and calibrated release review

- run unit/presentation/accessibility tests and admin build;
- conduct authenticated desktop and narrow-screen visual review;
- run read-only real-data validation;
- verify every insight drill-down against underlying evidence;
- review load time before considering caching or schema work;
- do not deploy until explicitly approved.

### Later derived-product phases — not part of this UX implementation

- brand-specific insight/cohort engine;
- product portfolio gateway/cross-sell classifications;
- choice-set/co-exposure/head-to-head facts;
- catalogue-enriched price/attribute intelligence;
- longitudinal seasonality;
- external Search Console or merchant conversion sources only under separately approved scopes.

## Review summary

The current data and correctness foundation is sufficient to implement the final three-level Analytics V2 experience. No product/data decision blocks the Overview/Explore/Diagnostics restructuring, Bulgarian language layer, journey correction, Search experience, compact product/brand views, or diagnostic containment of V1.

Future brand insights, behavioural competition, enriched attribute/price analysis, and seasonality require additional derived logic and eligibility policy, but they do not block the internal V2 UX. Exact Google queries, purchases, cross-device identity, and representative market claims require new sources and must remain unavailable until separately approved.

## READY FOR UX IMPLEMENTATION

## Visual-review corrections after Phase UX-1

The authenticated local review identified temporary page-level overflow in wide Explore tables. Until their later information architecture redesign, each table scrolls inside its own V2 section and the Analytics page itself must remain within the viewport. Typography and columns are not reduced merely to force a fit.

The global date controls include **Последен пълен месец** and **Последно пълно тримесечие**. These select complete Sofia calendar periods and compare them with the preceding complete calendar month or quarter. Rolling and custom periods retain their immediately preceding equal-duration comparison. Primary copy shows the exact selected and comparison dates.

An unclassified acquisition group is never presented without explanation. Using the already loaded source, medium, campaign and referrer fields, the UI distinguishes missing source information from unrecognized values where possible; raw values remain diagnostic detail. If those fields cannot support a reliable distinction, the UI states that limitation rather than inventing attribution.

The admin exclusion control uses the `bulgaritam_analytics_excluded=1` cookie already checked by first-party tracking, GTM and consent initialization. On `admin.bulgaritam.bg` it writes a secure `.bulgaritam.bg` domain cookie, so the public site can read it; on local hosts it writes a host-only cookie because browsers reject a `.bulgaritam.bg` cookie from `127.0.0.1`. Exclusion affects future activity only, preserves historical data, survives reload, and is reversible. Cross-subdomain production behavior still requires verification after an explicitly approved deployment.

Future Explore work must answer business questions including: **Кои категории привличат интерес?**, **Как хората стесняват избора си?**, **Какво търсят за подарък?**, and **Какво запазват за по-късно?** This covers categories, subcategories/product types, filters, recipient, occasion, price, supported materials/attributes, saves, collections and gift discovery. Each future implementation must label whether its answer is a captured event, derived intelligence, or catalogue-enriched analysis.

Current acquisition data may identify Google organic traffic when the existing fields support that classification. Exact Google search-query intelligence requires Google Search Console. Its query data is aggregate and must not be attributed one-to-one to an anonymous visitor or session. A future integration may connect query/page/date-level demand with landing-page and downstream Bulgaritam behavior only where that relationship is methodologically defensible.

## Explore Intelligence Map

This map is the product and data contract for the eventual `Разглеждане` experience. It does not authorize implementation. Capability status always describes the complete path from capture to presentation, not merely the existence of a database field:

- 🟢 **available now** — loaded, normalized, derived and already presentation-ready in the V2 pipeline;
- 🟡 **captured / straightforward derivation** — existing storage is sufficient, but projection, normalization or a bounded aggregation is still missing;
- 🟠 **meaningful derived work or catalogue join required** — tracking is broadly sufficient, but methodology, eligibility, attribution or enrichment must be designed and tested;
- 🔴 **new instrumentation or data source required** — current data cannot support the claim reliably.

### 1. Final recommended Explore navigation

Use seven primary areas. Gift behavior is a drill-down within `Интерес и избор`, not a tenth top-level destination; products and brands remain distinct because their identities, decisions and future report paths differ.

| Primary area | Question answered | Summary content | Main drill-downs | Replaces current V2 section | Can later absorb |
|---|---|---|---|---|---|
| **Търсене** | Какво търсят хората в Българитъм и намират ли достатъчен избор? | Search volume, visitors, zero result, limited choice, measured reaction | Query, result availability, reformulation sequence, directly linked products/brands | `Търсене` | Aggregate Search Console demand, clearly separated |
| **Интерес и избор** | Кои категории привличат интерес и как хората стесняват избора си? | Explicit taxonomy choices, filter use, sort use, gift-discovery activity | Category/type, filter/facet, gift recipient/occasion, combinations | No adequate V2 section; selected V1 filter/context tables | Catalogue-enriched attribute, price and supply analysis |
| **Продукти** | Кои продукти се виждат, привличат внимание и водят към сайтовете на брандовете? | Visibility, openings, page visits, interest signals, outbound intent | Composite product identity, contexts, search paths, repeat interest, eligible peer evidence | `Продукти` | Strong-reaction/limited-visibility classifications and catalogue enrichment |
| **Брандове** | Кои брандове привличат внимание и как хората стигат до тях? | Brand and product visibility, openings, page visits, outbound intent, multi-product exploration | Brand, products, searches, contexts, repeat interest | `Брандове` | Per-brand intelligence and defensible peer comparisons |
| **Места на откриване** | Къде хората срещат и отварят продуктите? | Visitors, qualified displays, openings and outbound intent by human context group | Surface group, raw context and opportunity linkage in Diagnostics | `Откриване на продукти` surface table | New instrumented surfaces and influenced-versus-direct paths |
| **Запазване и връщане** | Какво се запазва за по-късно и към какво хората се връщат? | Saves, collection activity and anonymous repeat interest | Product, brand-through-product, privacy-safe collection activity, return interval | `Връщащ се интерес`; no current V2 saves section | Saved-item return and later-action analysis after methodology review |
| **Източници** | Откъде идват посетителите и какво правят след това? | Human acquisition channels, visits, discovery activity and downstream observed actions | Channel, campaign/referrer diagnostics, landing page, returning activity | `Откъде идват посетителите` | Aggregate Search Console query/page/date layer |

Do not add a separate top-level `Подаръци`, `Филтри`, `Категории`, `Повторен интерес` or `Google търсения` tab. These are coherent drill-downs or future layers within the seven-area model.

### 2. Data capability matrix

| Desired capability | Status | Capture | Load / normalize | Derived / presentation readiness | Constraint |
|---|---:|---|---|---|---|
| Internal search terms and frequency | 🟢 | `search`, canonical query/search ID | Loaded and normalized into search episodes | Current V2 search rows and totals | Consenting anonymous browsers only |
| Search result availability, zero and limited choice | 🟢 | Canonical `result_count` and result members | Loaded and integrity-checked | Episode result count, median supply and eligible search insights | “Limited” threshold is provisional |
| Search reformulation | 🟢 | Ordered search states per session | Normalized into episodes | `reformulationCandidate` exists | Candidate, not dissatisfaction |
| Search downstream product interest/outbound | 🟢 | Explicit search/state context on actions | Opportunity/search linkage exists | Episode exposure, opening, consideration and outbound totals | Direct linkage only; do not promote older context to direct source |
| Exact Google organic queries | 🔴 | Not available in referrer/UTM data | No Search Console source | Not derivable | Requires aggregate Search Console import |
| Explicit category/subcategory/product-type selections | 🟡 | Dedicated selection events and fields | Events are loaded; no V2 taxonomy aggregation | Straightforward visitor/count summaries still needed | Must remain distinct from passive exposure |
| Canonical taxonomy result availability | 🟢 | Category/subcategory/type on canonical state plus members | These taxonomy fields and members are loaded | Complete state/member counts are available | No catalogue-wide supply denominator yet |
| Qualified exposure/opening by category or type | 🟠 | Event/state/product identity generally sufficient | Taxonomy completeness varies by event and needs state or catalogue resolution | Requires a governed join and unknown coverage diagnostics | Do not use partial event labels as complete taxonomy |
| Demand versus total catalogue supply | 🟠 | Demand and catalogue data exist separately | Catalogue is not part of V2 analytics loading | Requires time-aware catalogue join and denominator policy | Current catalogue is not necessarily historical catalogue state |
| Filter selection frequency | 🟡 | Filter/taxonomy events and canonical `active_filters` | Events load; canonical `active_filters` is stored but omitted from V2 repository projection | Bounded normalization and aggregation required | Arrays on ordinary events are not uniformly preserved; canonical state is preferred |
| Unique visitors using a filter | 🟡 | Journey/session identity exists | Available with event projection | Straightforward distinct aggregation | Anonymous browser, not person |
| Filter combinations | 🟠 | Canonical `active_filters` captures structured state | Not selected or normalized by V2 | Requires combination normalization, revision/state rules and minimum samples | Comma-joined event fallbacks are not a reliable universal structure |
| Result count before/after filtering | 🟠 | Some surfaces emit before/after; canonical states preserve after-state result count | Coverage is inconsistent | Requires surface coverage audit and state sequencing | Cannot claim universal effect with partial `results_before` capture |
| Opening/outbound after filtering | 🟠 | State IDs and downstream actions often exist | Linkage primitives exist | Requires direct state-sequence attribution rules | Association, not causal filter impact |
| Abandonment after filtering | 🟠 | Session sequences exist | Loaded | Requires inactivity window, eligible endpoint and censoring policy | Absence of another event is not automatically abandonment |
| Repeated refinement | 🟠 | Ordered filter/state events exist | Partly loaded | Requires deterministic revision grouping and definition | Must distinguish remove/clear/change from a new journey |
| Sort use and selected sort | 🟡 | `change_sort`, canonical `sort_value` | Event values load; canonical sort is loaded | Summary aggregation is missing | Downstream “effect” requires stronger sequencing |
| Gift-discovery opening | 🟡 | `open_gift_discovery` exists | Event loads | Counts/visitors not in current V2 model | Opening is interest in the tool, not gift demand for an attribute |
| Gift recipient and occasion demand | 🟡 | Dedicated events and canonical gift fields | Event fields load; canonical gift fields are stored but omitted from repository selection | Normalized counts/visitors required | Multi-value strings need deterministic parsing |
| Recipient × occasion combinations | 🟠 | Canonical state can preserve both | Not currently projected/normalized | Combination eligibility and sample rules required | Never infer missing half of a combination |
| Gift price preference | 🟡 | Gift budget event and canonical price bounds | Event metadata loads; canonical price fields are not projected | Normalized price-band aggregation required | Selection is expressed preference, not willingness to pay |
| Gift materials/attributes/audience | 🟠 | Some structured filters are captured in canonical `active_filters`; catalogue has richer facets | Not projected or joined | Requires normalized facets and catalogue coverage rules | Event arrays are not uniformly retained by primitive-only event sanitization |
| Gift result availability and zero/limited choice | 🟡 | Gift canonical state plus `result_count` | Fields need projection | Straightforward state aggregation after normalization | Only complete canonical states qualify |
| Gift downstream product/brand interest | 🟠 | State/source linkage exists | Core linkage exists, gift dimensions do not | Requires gift-state projection and direct attribution aggregation | No population-level preference claim |
| Product saves | 🟡 | `save_product` with product+brand identity is captured | Loaded and currently folded into consideration facts | Separate save-specific product aggregation is missing | Current “consideration” also includes add/share |
| Saved-product brand interest | 🟡 | Saved product carries brand identity | Loaded | Grouping saves by brand is straightforward | This is interest through saved products, not `save_brand` |
| Direct brand saves | 🔴 | `save_brand` is allowlisted but no active producer was found | No dependable event population | Not supportable | Requires verified instrumentation before productization |
| Saves after exposure/page visit | 🟢 | Save events and product context | Existing derived linker associates consideration with prior selection/page view when defensible | Linkable consideration facts exist | Separate saves from add/share before calling the result “saves” |
| Collection creation/view/share/add/remove counts | 🟡 | Events and privacy-safe `collection_id` are captured | Loaded as events; no V2 collection domain | Straightforward event/visitor aggregation | Never load or display collection names |
| Products within collection activity | 🟡 | Add/save events usually carry product identity; removal may have slug-only legacy identity | Loaded | Requires identity-quality reporting | Removal cannot always be joined to composite product+brand safely |
| Saved item later viewed or sent outbound | 🟠 | Journey, session, product and collection IDs broadly exist | Events load | Requires ordering, lookback, direct/influenced attribution and censoring policy | Do not imply the save caused the later action |
| Anonymous returning visitors | 🟢 | Journey ID and lookback events | Derived with cross-session rules | Current V2 summary exists | Browser-scoped, not a known person |
| Repeat product and brand interest | 🟢 | Product/brand identity across sessions | Derived and deduplicated | Aggregate and underlying facts exist | Product identity remains product + brand |
| Repeat interest by product/brand | 🟡 | Underlying repeat facts identify entity | Loaded and derived | Presentation aggregation/drill-down is missing | Apply sample/privacy thresholds |
| Time to return | 🟠 | Prior/current timestamps exist in repeat facts | Available | Requires distribution, censoring and reporting policy | Avoid naive averages and incomplete-window bias |
| Acquisition channel and downstream behavior | 🟢 | Acquisition, UTM, referrer and landing fields | Loaded and grouped | Human channel labels plus exposure/opening/consideration/outbound/returning summaries exist | Observational; small groups suppressed |
| Landing-page behavior by acquisition source | 🟡 | Landing page and acquisition fields are loaded | Present on events | Bounded source × landing aggregation is missing | Define session-level landing once, avoid event multiplication |
| Unknown acquisition reasons | 🟢 | Raw source/medium/referrer fields | Loaded | Missing versus unrecognized explanation exists where fields permit | Some legacy data remains inherently indeterminate |
| Discovery context visitors/displays/openings/outbound | 🟢 | Source surface and canonical state context | Loaded and derived | Current surface rows exist | Eligibility only for complete canonical states |
| Eligible opportunity/member counts | 🟢 | Canonical states/results | Integrity-checked and derived | Available | Diagnostic/drill-down detail, not primary headline |
| Non-canonical eligible denominator | 🔴 | Full choice set is not captured | Not available | Must remain “not applicable” | Do not manufacture denominator from impressions |
| Product visibility/opening/page/interest/outbound facts | 🟢 | Product events plus explicit source context | Loaded, linked and derived | Current product rows exist | Direct page visits need not follow list openings |
| Product reaction versus eligible peers | 🟢 | Product opportunity/exposure facts and taxonomy context | Derived cohort fallbacks exist | Eligible hidden-winner/underperformer insights exist | Only when cohort/sample gates pass |
| Product change over time | 🟠 | Current/previous facts exist | Both windows loaded | No governed product trend family exists | Do not compare sparse raw ranks |
| Brand visibility, openings, pages and outbound | 🟢 | Brand and product events carry brand identity | Loaded and derived | Current brand rows exist | Brand impression and product exposure are different facts |
| Multi-product exploration within a brand | 🟢 | Same-session product attention with brand identity | Derived | Brand-level count exists | It is exploration, not purchase consideration certainty |
| Searches and paths leading to a brand | 🟡 | Search/state and brand/product identity exist | V1 has explicit search aggregation; V2 facts retain context | V2 brand drill-down aggregation is missing | Preserve direct versus influenced context |
| Brand peer comparison and demand opportunities | 🟠 | Core brand/product facts exist | No brand cohort/insight engine | Requires eligibility and comparable-brand policy | Must not rank incomparable catalogue mixes |

### 3. Internal search intelligence

`Търсене` is the first Explore area because it has the most complete decision path today. Its landing view should show search volume and visitors, zero-result and limited-choice counts, then compact groups for frequent queries, no results, limited choice and measured reaction. Query detail may show the observed result-count distribution, reformulation sequence, qualified displays, openings, consideration and outbound actions linked by the same search/state context.

Keep these distinctions explicit:

- a search term is Bulgaritam internal demand, not Bulgarian market demand;
- a reformulation is a sequence candidate, not proof of dissatisfaction;
- a returned result is not a qualified display;
- an older search context may be influential but is not the immediate source of a later click;
- current search insight thresholds remain unchanged.

### 4. Category and product-type intelligence

Primary UX should distinguish two questions:

1. **Какво избират изрично?** — selection events for category, subcategory and product type (🟡).
2. **Какво реално виждат и отварят?** — qualified exposure and actions for products belonging to that taxonomy (🟠 until taxonomy is resolved consistently from canonical state or a governed catalogue join).

Canonical state category/type and result membership can describe available results for complete states. It must not be mixed with total catalogue supply or treated as passive category exposure without verifying the surface and state. A future demand-versus-supply view needs a defined, time-aware catalogue denominator and explicit unknown taxonomy coverage.

### 5. Filter intelligence

The current instrumentation captures dedicated taxonomy selections, `apply_filter`, `remove_filter`, `clear_filters`, `change_sort`, primitive filter names/values and structured canonical `active_filters`. The key pipeline gap is that V2 repository state loading omits `active_filters`, price bounds and gift fields. Ordinary event sanitization also retains primitive values only, so array-valued materials/colors/attributes are not uniformly dependable outside canonical snapshots.

The first filter release may safely show normalized selection counts and unique anonymous visitors. Combination paths, result change, downstream actions, repeated refinement and abandonment require a separately reviewed state-sequence model. For every “after filtering” statement, show the observation window and direct linkage; never say the filter caused the behavior.

### 6. Gift intelligence

Gift intelligence belongs under `Интерес и избор`, with an obvious question-led entry: **Какво търсят за подарък?** Recipient, occasion, gift budget, canonical result availability and tool opening are captured. Before presentation, repository projection must include the stored gift/price/filter state and normalization must handle multi-value fields.

Safe first facts are explicit recipient/occasion selections, gift-discovery use and complete-state result availability. Recipient × occasion, attribute combinations and downstream interest need eligibility and sequence work. Price selection means a selected range, never willingness to pay. Nothing here represents all Bulgarian consumers.

### 7. Saves and collections intelligence

`save_product`, `add_to_collection`, removal, collection creation/view/share and privacy-safe collection IDs are captured. Current V2 folds save/add/share into the broader consideration stage; it does not expose save-specific or collection aggregates. A first release can separate event types and count actions/visitors without collection names.

Safe questions include:

- кои продукти са запазвани;
- кои брандове получават интерес чрез запазени продукти;
- колко има създадени, разгледани и споделени колекции;
- кои продукти са добавяни, subject to identity-quality diagnostics.

Later views may describe a later view or outbound action after a save, but only as an observed sequence with direct/influenced attribution and lookback rules. `save_brand` must not be shown: it is accepted by ingestion, but no dependable live producer was found. Collection names and individual collection profiles remain prohibited.

### 8. Discovery-context intelligence

Group raw surfaces into business-readable contexts: Начална страница; Търсене; Категории и продуктови групи; Подаръци; Тематични страници; Брандове; Продуктови препоръки; Запазени продукти и колекции; Друг контекст. Unknown raw values stay in Diagnostics until classified.

Primary context comparison may show visitors, qualified product displays, product openings, outbound intent and at most one clearly based rate. Canonical eligible opportunities are useful in drill-down when state integrity is complete. Raw state/member counts, IDs, linkage method and integrity failures belong in Diagnostics. Non-canonical contexts may show observed activity but never a fabricated eligible denominator.

### 9. Acquisition intelligence

`Източници` starts with human channels: Direct, Google organic, other search, social, email, campaigns, external referrals and unknown. It may show visitors, discovery-active sessions, qualified displays, openings, consideration, outbound intent and returning visitors using the current observational grouping.

Campaign, raw source/medium/referrer and legacy values are drill-down or Diagnostics detail. Unknown traffic must retain the current missing-versus-unrecognized explanation. Landing-page analysis is a straightforward next aggregation, but it must choose one session landing and avoid multiplying visits by event count. Source differences are behavioral observations, not proof that a channel caused the outcome.

### 10. Search Console future layer

Google referrer or `utm_*` data can support a Google-organic channel classification; it cannot reveal exact organic queries. Exact query intelligence requires a new Search Console data source at aggregate grain:

`query × landing page × date × device`, where available.

The future UI must keep Search Console demand separate from internal search. It may align aggregate query/page/date impressions, clicks, click-through rate and position with first-party landing-page downstream summaries for comparable date/page groups. This is ecological/aggregate comparison, not deterministic query-to-browser or query-to-session attribution. Thresholding and suppression may be required for privacy and unstable low-volume rows.

### 11. Product intelligence structure

**Summary → compact product list → product drill-down → diagnostic detail**

- Summary: products with qualified visibility, openings, page visits, consideration, outbound and repeat-interest coverage.
- Compact list: product, brand, qualified displays, observed reaction and one later-intent signal; no giant default table.
- Drill-down: composite `product + brand` identity, contexts, position, searches, exposure/opening/page/consideration/outbound sequence, repeat interest and eligible peer insight.
- Diagnostics: raw identity quality, state/opportunity links, denominators, cohort definition/fallback/sample and legacy events.

Current product stage facts and eligible peer classifications are 🟢. Product-specific repeat aggregation is 🟡. Period trends, catalogue price/attribute analysis, gateway/cross-sell roles and broader portfolio classifications are 🟠. Purchases and revenue remain unavailable.

### 12. Brand intelligence structure

**Summary → compact brand list → brand drill-down → diagnostic detail**

- Summary: brands with observed visibility, product attention, brand-page activity, repeat interest and outbound intent.
- Compact list: brand, product visibility, product/brand openings and outbound actions.
- Drill-down: strongest observed products, direct searches and contexts leading to the brand, multi-product exploration, repeat interest and brand-site transitions.
- Diagnostics: identity quality, raw paths/source fields, direct versus influenced attribution and sample coverage.

Current brand facts and multi-product exploration are 🟢; query/context drill-down aggregation is 🟡; defensible similar-brand comparison, brand insights and demand opportunities are 🟠. The architecture deliberately preserves brand identity and nested product identity so it can become the internal foundation for future per-brand reports without exposing those reports now.

### 13. Repeat-interest structure

The primary question is **Към какво хората се връщат?** Show returning visitors, products revisited and brands revisited across separate sessions. Product/brand lists are secondary drill-downs. Saved-item return and time-to-return need additional derived policy before display.

Primary copy should use `посетители` and `посетители с повторен интерес`. A nearby methodological disclosure must state that visitors are recognized anonymously by browser and that one person using multiple devices or browsers may be counted more than once. Never use “cross-session” in primary copy.

### 14. What remains Diagnostics-only

- raw event names, event IDs and payloads;
- discovery state/result IDs, member counts and integrity diagnostics;
- direct versus session-sequence link method and missing-link counts;
- raw source, medium, campaign, referrer and legacy values;
- exact cohort definition, fallback level, sample gates and position bands;
- identity quality and ambiguous/legacy product or brand keys;
- incomplete canonical states and non-canonical denominator limitations;
- session timelines and wide export-like tables;
- V1 reports during the transition.

### 15. What must not be shown yet

- exact Google organic queries or one-to-one Google-query attribution;
- direct brand-save intelligence;
- complete filter before/after impact across all surfaces;
- causal filter, campaign, save or collection effects;
- abandonment without a reviewed inactivity/censoring definition;
- total-market demand, market share or population preference;
- purchase, revenue, conversion or willingness-to-pay claims;
- non-canonical opportunity rates;
- brand rankings across incomparable catalogue mixes;
- behavioural competitors, gateway/cross-sell roles or brand opportunity labels without eligible derived logic;
- collection names, personal profiles or cross-device person identity.

### 16. Recommended implementation phases

Each phase is independently testable, locally visually reviewable and requires explicit approval before the next.

1. **Explore foundation** — replace the current secondary navigation with the seven-area map, shared question/summary/list/drill-down shell, URL persistence, responsive containment and Diagnostics links. No new derivation.
2. **Search and demand** — productize current search episodes and insights into compact groups and query drill-downs; keep Google demand absent but visibly distinguished as future external data.
3. **Interest, taxonomy, filters and gifts — data foundation** — add the missing canonical state projection for price, gift fields and `active_filters`; normalize selections and publish coverage diagnostics before UI conclusions.
4. **Interest, taxonomy, filters and gifts — experience** — build explicit-selection summaries and conservative gift/filter drill-downs; defer sequence-based claims that fail eligibility.
5. **Products** — compact list and product drill-down using current composite identity and stage facts; preserve cohort evidence in Diagnostics.
6. **Brands** — compact list and brand drill-down using current facts, products, direct paths and repeat evidence; no new brand insight family without separate derived review.
7. **Saves and repeat interest** — separate save/collection events from consideration, add privacy-safe aggregates, entity repeat drill-downs and only then design saved-to-later-action sequences.
8. **Acquisition and landing pages** — compact human channels, landing-page summaries and unknown-source treatment; raw dimensions remain diagnostic.
9. **Search Console layer** — separately approved external aggregate ingestion, reconciliation, privacy policy and query/page/date/device UI. It must never be silently joined to anonymous sessions.

### 17. Recorded Overview polish for a later implementation

Do not implement these changes as part of this audit:

- replace primary `разпознати анонимни браузъри` with `посетители`;
- replace `браузъри с повторен интерес` with `посетители с повторен интерес`;
- add a secondary explanation that visitor identity is anonymous-browser scoped and one person on multiple browsers/devices may be counted more than once;
- remove the redundant `Има данни за двата периода` badge from Overview;
- make the large insight percentage slightly more compact.

### 18. Final audit conclusion

The current V2 foundation already supports a strong Search experience, product and brand behavior stages, canonical versus non-canonical discovery context, acquisition summaries, qualified peer-based product insights and anonymous repeat interest. The most valuable captured-but-unused intelligence is structured canonical filter/gift/price state, explicit taxonomy selections, save/collection events and entity-level repeat facts.

The genuine gaps are exact Google queries, reliable direct brand saves, non-canonical choice sets, purchases/revenue, person-level cross-device identity and any claim requiring representative market data. Several desirable views need derived policy rather than tracking: filter sequences and abandonment, catalogue-aware taxonomy/attribute analysis, saved-to-later-action paths, time-to-return, brand cohorts and opportunity classifications.

The seven-area Explore architecture is compatible with future per-brand intelligence: brand identity, composite product identity, paths and repeat facts have explicit homes. It is also compatible with later market intelligence because external demand is isolated as an aggregate Search Console layer instead of being confused with first-party session behavior.

## 23. Interest & Choice Derivation Contract

Status: approved design boundary for a future EXPLORE-3B implementation. This contract does not add UI, schema, tracking, scores, or production behavior.

### Product question and semantic boundary

The area answers:

> **Към какво се насочват посетителите и как стесняват избора си?**

An explicit click, filter application/removal, clearing action, gift choice, or sort change is a **choice action**. A canonical snapshot is an **available-choice state**. A qualified impression, opening, save, or outbound action is a separate downstream behavior. These units must never be collapsed into one generic measure of “interest”. Catalogue membership and passive exposure do not prove that a visitor chose a taxonomy or facet.

The recognized visitor is a consenting anonymous browser identified by `anonymous_journey_id`, not a known person. A session is `anonymous_session_id`. The default taxonomy/filter ranking unit is **choice actions**; every row also shows distinct anonymous visitors when available. Sessions are diagnostic/context units. Result states and result members are never added to action or visitor counts.

### Audited capture contract

| Producer / event | What is actually emitted | Important limitation |
|---|---|---|
| Homepage `select_category` | controlled category key, Bulgarian selected label, `filter_name=category`, source context | ordinary category chips emit before the resulting state is committed; shortcut paths commit before emitting |
| Homepage / brand directory `select_subcategory` | category, controlled subcategory key/label, filter name/value | producer order differs: homepage emits before commit; brand directory commits first |
| Homepage / brand directory `select_product_type` | selected/filter value and surrounding category/subcategory where present | toggling a type off still uses the selection event; the chosen value is reliable, but action direction needs the event/state context |
| Homepage / brand directory / SEO `apply_filter` | primitive filter name/value, action, surface; homepage may include comma-joined constraints and price band; SEO includes `results_before/after` | event sanitization intentionally drops array-valued metadata, so homepage `materials`, `colors`, and `attributes` arrays are not a dependable event source; SEO removal is represented as `apply_filter` with `filter_action=remove` |
| Homepage `remove_filter` | removed chip identity in filter name/value, `filter_action=remove` | emitted before the resulting state; not observed in the audited production sample |
| Homepage / brand directory `clear_filters` | clear action and scope in `filter_name` where supplied | emitted before or around the state update depending producer; not observed in the audited sample |
| Homepage / brand directory `change_sort` | selected sort value and context | canonical sort exists, but the action does not explicitly carry a resulting-state ID |
| Homepage / brand directory gift events | recipient/occasion in selected/filter value; homepage gift budget is an `apply_filter`; tool opening is `open_gift_discovery` | promoted `gift_recipient/gift_occasion` columns are not populated consistently by choice events; canonical gift states are the structured source |
| Homepage `surprise_me` | selected product/brand identity and shortcut context | it is a random-navigation action, not a filter, taxonomy choice, or preference; no event appeared in the audited sample |
| Canonical state producers | taxonomy, sort, price bounds, recipient, occasion, structured `active_filters`, exact result count, ordered product/brand members | state timestamps have no event sequence number or explicit `caused_by_event_id`; a state can also be committed by initial render, search, or non-choice re-render |

Ingestion acceptance is not evidence of browser population. Production producers and tests show that primitive values survive event sanitization; arrays on ordinary events do not. Canonical `active_filters` retains arrays/objects and is the authoritative structured state source.

### Complete data path and capability matrix

Status meanings: 🟢 usable from the current loaded V2 domain; 🟡 captured and available through a bounded projection/normalization extension; 🟠 needs reviewed methodology, a catalogue join, or explicit eligibility; 🔴 needs a new source or future instrumentation.

| Dimension / question | Captured and stored | Current V2 load / normalization | Status and implementation rule |
|---|---|---|---|
| Category selection | dedicated event; category key plus selected/filter value | event is loaded; no choice aggregation | 🟡 count explicit actions and distinct visitors only |
| Subcategory selection | dedicated event with category and subcategory | event is loaded; no choice aggregation | 🟡 same unit and rule |
| Product-type selection | dedicated event; selected/filter value is most reliable | event is loaded; no choice aggregation | 🟡 normalize from selected/filter value; do not rely only on promoted `product_type` |
| Filter name/type and primitive value | filter events and metadata | event metadata is loaded | 🟡 normalize producer aliases and action direction with coverage diagnostics |
| Materials, colors, attributes | structured in canonical homepage/SEO states; sometimes comma-joined in event `filter_value` | `active_filters` is omitted from repository projection | 🟡 for explicit canonical facets after projection; event arrays alone are not eligible |
| Audience and other structured facets | some SEO canonical states retain controlled facets; search intent may emit a primitive audience | omitted from V2 state projection; historical surfaces vary | 🟠 require a facet registry, source coverage, and explicit-choice rule; inferred search intent is not a filter click |
| Filter removal | `remove_filter`, or SEO `apply_filter` with `filter_action=remove` | events load | 🟡 normalize by action, not event name alone |
| Filter clearing | `clear_filters` with a scope where present | events load | 🟡 count actions/visitors; reconstructing every removed value is not supported |
| Sort | `change_sort` and canonical `sort_value` | both event value and canonical sort are loaded | 🟡 action/visitor summary; no performance-effect claim |
| Gift tool opening / surprise | dedicated events | events load | 🟡 descriptive action and visitor counts only |
| Gift recipient / occasion | dedicated choice values and canonical columns | event fields load; canonical columns are omitted | 🟡 normalize dedicated values and project canonical fields |
| Gift price | homepage gift-budget event, `price_range`, canonical exact EUR bounds | event metadata loads; state price columns are omitted | 🟡 selected bands/bounds only; never willingness to pay |
| Other gift attributes | `attribute:*` entries in canonical `active_filters`; SEO may contain structured facets | omitted | 🟡 when explicitly selected and recognized by the facet registry; otherwise 🟠 |
| General price filtering | event band plus canonical EUR bounds | event metadata loads; state bounds omitted | 🟡 selected band counts and complete-state availability after projection |
| Result count after a state | canonical `result_count` plus ordered members | result count/members are loaded and integrity checked | 🟢 as a state fact; 🟠 as the result *of a specific action* without an eligible link |
| Result count before/after one action | SEO emits both; other producers generally do not | metadata loads but no transition model | 🟠 surface-qualified only; never universal |
| Action → resulting canonical state | proximity and sometimes contextual state IDs exist | no explicit resulting-state linker | 🟠 producer order is inconsistent; do not infer universally from nearest timestamp |
| State → qualified exposure/opening/outbound | downstream events may carry `source_discovery_state_id`, position, surface and search | existing product/brand facts validate explicit source state | 🟢 for directly attributed state outcomes; 🟠 when assigning the state to the preceding choice action |
| Catalogue product prices/attributes and shown-product distributions | catalogue and canonical members exist separately | no time-aware catalogue join in V2 | 🟠 later enriched layer; not EXPLORE-3B |
| Purchase, revenue, demographic identity | not captured | unavailable | 🔴 out of scope |

### Units and minimum composable model

#### `ChoiceActionFact`

- **Identity:** `event_id`; legacy fallback `legacy:{storage id}:{occurred_at}`. Deduplicate exactly once.
- **Unit:** one accepted explicit action, never a visitor or result state.
- **Sources:** the audited taxonomy/filter/sort/gift events. `open_gift_discovery` and `surprise_me` remain distinct action kinds.
- **Required fields:** event kind, normalized action (`add`, `remove`, `clear`, `sort`, `open`, `random_open`), normalized dimension, normalized value when applicable, timestamp, session, visitor, surface/source context.
- **Ordering:** within a session by `occurred_at`, then `sequence_number`, then storage ID. Ordering proves chronology only.
- **Deduplication:** by identity; aggregations separately count actions, distinct visitors, and optionally sessions.
- **Missing data:** retain the action under `unknown_value` only in Diagnostics; exclude it from value rankings while reporting coverage.
- **Historical compatibility:** dedicated events remain eligible; producer/version is retained so aliases can be normalized without rewriting raw data.
- **Privacy:** no raw visitor/session IDs in presentation.

#### `ChoiceStateFact`

- **Identity/unit:** one complete `discovery_state_id` and its exact ordered membership.
- **Sources:** `analytics_discovery_states` plus `analytics_discovery_results` after existing integrity validation.
- **Required fields:** visitor/session, timestamp, surface/path family, taxonomy, sort, price bounds, gift dimensions, normalized active facets, result count, complete/incomplete flag.
- **Ordering:** state timestamp, then stable state ID. There is no state sequence number.
- **Deduplication:** one state ID; one member per composite state/entity/product/brand identity and position.
- **Missing data:** null means “not recorded/active”, not “visitor rejected this value”. Incomplete states never supply availability or member denominators.
- **Historical compatibility:** states exist only after canonical tracking rollout; pre-rollout events may supply action facts but never fabricated state facts.
- **Privacy:** aggregate only; members are product/brand catalogue identities, not visitor profiles.

#### `ChoiceTransitionFact` (strictly eligible subset)

- **Identity/unit:** `from_state_id → to_state_id` within one session and one compatible surface/page family, with exactly one qualifying explicit action between them.
- **Eligibility:** both states complete; chronological order unambiguous; no intervening search, navigation, unrelated choice, session boundary, or conflicting re-render; the changed dimension/value must match the action. A configurable short adjacency window is a safety cap, never sufficient evidence by itself.
- **Values:** before/after result counts, signed/absolute change, neutral direction `narrowed`, `broadened`, or `unchanged`.
- **Missing/ambiguous behavior:** suppress the transition and report it as unlinked. Never choose the nearest state merely to improve coverage.
- **Historical compatibility:** current coverage is partial and producer-dependent; first EXPLORE-3B may implement diagnostics/tests but must not headline transition conclusions until eligibility is demonstrated.

#### `ChoiceOutcomeFact`

- **Identity/unit:** one downstream event with an explicit, existing `source_discovery_state_id`; product identity remains `product + brand`.
- **Attribution:** Level 6 direct state attribution only. `last_discovery_state_id`, older search context, or later same-session chronology is not a direct source.
- **Presentation rule:** may say an opening/outbound followed **from that state**. It may not say the preceding filter caused the action unless the state is also linked to that action by an eligible `ChoiceTransitionFact`.
- **Deduplication/missing behavior/privacy:** event identity deduplication; missing source link means excluded from direct outcomes; aggregate only.

Specialized taxonomy, filter, gift, and sort rows should be deterministic aggregations over these four facts, not separate incompatible domains or opaque scores.

### Taxonomy, filter, gift, price, and availability rules

**Taxonomy.** Present explicit action count and distinct visitors. Example: `„Облекло“ е избрано 4 пъти от 3 посетители.` Only add `След избора са били налични…` for eligible linked state facts. Canonical taxonomy on an SEO landing or passive result state is not itself an explicit selection.

**Filters.** Preserve selected values, removals, and clear actions separately. `clear_filters` counts one clear action; it does not manufacture one removal per previously active facet. Structured canonical values take precedence over lossy comma-joined event values. A smaller result set means `изборът е стеснен`, not `възникнало е затруднение`; a larger set means `изборът е разширен`, not success.

**Gift discovery.** Say `В {N} избора за подарък е посочено „За жена“`, never `Жените предпочитат…`. Recipient, occasion, price, and explicit attribute combinations qualify only when every component is present in the same complete state or explicitly selected in the same eligible episode. Opening the gift tool is use of the tool, not a recipient/occasion choice.

**Price.** Keep four concepts separate: exact selected bounds; deterministic selected bands; catalogue prices; prices of shown/opened/saved/outbound products. EXPLORE-3B may use only the first two. `0–25`, `25–50`, `50–100`, and `100+` normalize to canonical EUR bounds; `all` means no selected band and is not a price preference. No willingness-to-pay, sensitivity, ideal-price, or purchase-intent language is allowed.

**Attributes.** Only an explicitly selected canonical facet belongs in the behavioral layer. Catalogue product material/color/audience is passive metadata and requires a later time-aware join. Unknown or free-form historical aliases stay diagnostic until mapped by a reviewed facet registry.

**Availability.** Use complete canonical states only. Show count, median and range only with an explicit base, e.g. `При 4 измерени избора за подарък са останали между 1 и 13 резултата.` Zero and limited choice are factual availability observations. “Limited” needs an explicitly disclosed product rule; it is not automatically friction.

### Episode and sequence rules

A future `FilterEpisode` is a view over eligible `ChoiceActionFact` and `ChoiceTransitionFact` rows, not a new source of truth. It starts with an explicit choice action in a session/surface family and ends on navigation to an incompatible page/surface, a new search identity, session end, or an ambiguity/intervening unrelated action. A timeout may cap an episode but cannot join otherwise unrelated actions.

Sequences such as `Категория → Материал → Цена` or `За жена → Рожден ден → 0–25 евро` are currently 🟠. Event ordering exists, but canonical state commits occur before the event on some producers and after it on others; initial render/search/re-render can also create states; states have no sequence number or `caused_by_event_id`. The production dry run found both before- and after-event state proximity and substantial unlinked coverage. EXPLORE-3B must suppress sequences unless the strict transition eligibility rule passes. A future instrumentation improvement—an explicit `resulting_discovery_state_id` or one uniform atomic commit/action contract—is genuinely required for comprehensive sequence and before/after coverage, but is not part of EXPLORE-3B unless separately approved.

### Downstream attribution rules

1. **Direct:** a qualified impression/opening/save/outbound event explicitly references an existing source state. This may be aggregated by that state's taxonomy/facets.
2. **Direct choice relationship:** additionally requires an eligible action → resulting-state transition. Only then may wording say `след този избор`.
3. **Later in the same session:** chronological association only; keep separate and do not include in direct totals.
4. **Influenced/last context:** `last_discovery_state_id` is explanatory context only and never replaces immediate `source_discovery_state_id`.

Do not claim `filter caused opening`. At most state the observed chain: `Филтърът е приложен; след него е записано състояние с 5 резултата; от това състояние е отворен продукт`, and only when every link is eligible.

### Eventual user questions

The first area should answer no more than these seven questions:

1. Кои категории, подкатегории и типове продукти избират посетителите?
2. Кои филтри използват и какви стойности посочват?
3. Кои филтри премахват или изчистват?
4. За кого, по какъв повод и в какъв ценови диапазон търсят подаръци?
5. Кои комбинации от изрични избори се срещат в достатъчно пълни данни?
6. След кои надеждно свързани избори остават малко или никакви резултати?
7. Какви директно свързани действия следват от измерените състояния, когато връзката е доказуема?

Questions 5–7 disappear when eligibility or sample is insufficient; they are not filled with inferred answers.

### Low-data behavior and Bulgarian vocabulary

Factual orientation is allowed from the first valid observation: `През периода 6 посетители са използвали филтри.`; `„За жена“ е избрано 2 пъти.`; `Има 4 пълни състояния за избор на подарък.` Show both actions and visitors and disclose missing coverage.

Automated interpretation requires a separately reviewed rule, comparison population, minimum sample, and stability check. Until those exist, do not say `Материалът е най-важният критерий`, `интересът расте`, or `това е проблем`. Small samples display descriptive rows without ranking superlatives, trend arrows, or recommendations.

Preferred vocabulary:

| Meaning | Use | Avoid |
|---|---|---|
| explicit action | `избрано`, `посочено`, `използван филтър` | `предпочитано`, `търсено от пазара` |
| anonymous identity | `посетител` plus nearby browser-scope explanation | `човек`, `клиент`, demographic group |
| result reduction | `изборът е стеснен`, `остават {N} резултата` | `фрикция`, `неуспех` |
| result increase | `изборът е разширен` | `подобрение`, `успех` |
| downstream action | `по-късно в същото посещение` or `директно от това състояние` | `заради филтъра`, `доведе до покупка` |
| price | `избран ценови диапазон` | `готовност за плащане`, `ценова чувствителност` |

### Forbidden claims

The first implementation must not claim preference, popularity, market demand or demand growth; causal effect of a filter/sort/gift choice; conversion, purchase, revenue, sale, or willingness to pay; demographic preference; friction or abandonment without a reviewed definition; market-wide or representative Bulgarian-consumer behavior; passive catalogue exposure as choice; product attribute demand from catalogue metadata; or that a later same-session action was directly caused by an earlier choice.

### Read-only production dry run — 14 September 2026

The audit used the configured Supabase source read-only. Event history spans `2026-08-15 14:26 UTC` to `2026-09-14 16:49 UTC`; canonical state history begins only at `2026-09-12 16:16 UTC`. Therefore the 30-day and historical choice-event totals are nearly identical, while canonical coverage cannot be projected backward over migrated pre-canonical history.

| Window | All events | Relevant choice events | Distinct visitors | Sessions | Event breakdown |
|---|---:|---:|---:|---:|---|
| last 7 days | 2,447 | 33 | 9 | 10 | category 12; subcategory 2; product type 1; filters 8; gift recipient 4; gift occasion 2; gift open 2; sort 2 |
| last 30 days | 4,435 | 40 | 11 | 13 | category 16; subcategory 4; product type 2; filters 8; gift recipient 4; gift occasion 2; gift open 2; sort 2 |
| full event history | 4,436 | 40 | 11 | 13 | same as 30 days; one older unrelated event |

No `remove_filter`, `clear_filters`, or `surprise_me` event appeared in this sample; their producers and ingestion contracts exist, but real-data presentation must show no measured activity rather than assume completeness.

Historical field completeness for the relevant families:

- all 16 category actions have category, filter name/value, selected value and action; 9 reference a contextual discovery state;
- all 4 subcategory actions have category/subcategory and selected/filter values; 3 reference a contextual state;
- both product-type actions have selected/filter values, while the promoted `product_type` field is absent—normalization must use the explicit selected value;
- all 8 filter actions have primitive filter name/value/action; 4 have a price band; none has reliable array-valued material/color/attribute metadata or universal before/after counts;
- all 4 recipient and 2 occasion actions have selected/filter values, but their promoted gift columns are absent in this sample;
- both sort actions have selected value and contextual state; neither proves a causal effect.

There are 43 canonical states and 7,501 members; all 43 pass result-count integrity. All 43 store structured `active_filters`; 38 store sort, 16 category, 2 subcategory, 1 product type, 3 exact price bounds, 4 recipient, and 2 occasion. Measured state examples include a `0–25 EUR / За жена / Рожден ден / Ръчна изработка` gift state with 1 result and a `25–50 EUR / За двойка` state with 13 results. No canonical state in this short sample has zero results.

Observed explicit choices include `Облекло` 4 times, `Дом и интериор` 4, `Аксесоари` 2, `Козметика` 2; `Домашен текстил` 2; product types `Пижами и домашни комплекти` and `Спално бельо` once each; recipient `За жена` 2, `За бебе` 1, `За двойка` 1; occasion `Рожден ден` 2; budgets `0–25` twice and `25–50` once; `Ръчна изработка` once; and sort `price-asc` twice. These are descriptive smoke-sized observations, not ranked insights.

Action/state proximity demonstrates the linkage limitation: among 40 relevant actions, 8 had a state within five seconds before, 23 within five seconds after, and 14 had no state within five seconds; categories overlap, so proximity counts are not a partition. Only 3 action context IDs matched a nearby prior state and none matched a nearby following state. There are 169 downstream events with an explicit existing source state (163 qualified product impressions, 3 product openings, 2 brand openings, 1 product outbound), proving direct state attribution is feasible; it does not prove which preceding choice produced each state.

### Exact EXPLORE-3B scope

EXPLORE-3B may implement only:

1. project `price_min_eur`, `price_max_eur`, `gift_recipient`, `gift_occasion`, and `active_filters` through `DiscoveryStateRow` and the existing bounded repository;
2. normalize audited taxonomy/filter/gift/sort actions into `ChoiceActionFact`, including SEO remove aliases and explicit coverage diagnostics;
3. normalize complete canonical states into `ChoiceStateFact` with a controlled facet registry, exact result integrity, and historical-coverage flags;
4. aggregate action counts and distinct visitors for taxonomy, primitive/structured filters, sort, gift tool use, recipient, occasion, and selected price bands;
5. show neutral complete-state result availability only where the displayed base is explicit; implement strict transition eligibility as diagnostic/tested infrastructure, and suppress ambiguous before/after statements;
6. aggregate directly sourced downstream events by canonical state while keeping choice linkage, direct attribution, later-same-session association, and influenced context separate;
7. add deterministic tests for deduplication, aliases, multi-value normalization, missing fields, complete/incomplete states, action/state ambiguity, direct attribution, low-data language, and product composite identity;
8. build the bounded `Интерес и избор` presentation for the seven approved user questions, hiding unsupported groups.

EXPLORE-3B must not add tracking/schema, catalogue joins, affinity, demographic inference, opaque scores, causal claims, general sequence claims, automated “most important” insights, or visitor-level timelines. Comprehensive action → result transitions remain a future instrumentation decision requiring separate approval.

## 24. Visitor Affinity & Behavioral Relationships

Status: future feasibility contract only. It deliberately does not expand EXPLORE-3B, whose scope remains explicit taxonomy, filter, gift, sort, and available-choice behavior.

### Evidence hierarchy

1. **Same visitor:** A and B occurred for the same consenting anonymous browser in the selected period.
2. **Same session:** A and B occurred in the same visit.
3. **Ordered same session:** A occurred before B by timestamp, sequence, then stable ID. Chronology is not causality.
4. **Same discovery opportunity:** A and B were eligible members of one complete canonical state.
5. **Qualified co-exposure:** A and B both had qualified impressions explicitly sourced to that state for the visitor/session.
6. **Direct attribution:** the later action explicitly carries the source discovery/search/state and position that link it to the opportunity.

Every relationship records and presents its strongest evidence level. A lower level must never inherit wording from a higher level.

Definitions for future work:

- `разгледал продукт` = `view_product` with `view_stage=selection_click` or `page_load`, reported separately where the distinction matters; an impression alone does not qualify;
- `проявил интерес към бранд` must name its evidence: brand-page/list opening, product opening for that brand, or outbound; these are not silently pooled;
- `разгледал категория` = explicit category selection when discussing choice; product opening within a category is a separately labelled relationship;
- `търсил` = a valid internal `search` episode, not Google/referrer inference;
- `върнал се` = the same anonymous journey ID has qualifying activity in distinct session IDs; this is browser-scoped.

### Feasibility matrix

| Relationship family | Status | Strongest current evidence | Rule |
|---|---:|---:|---|
| Brand A visitor also opened Brand B | 🟡 | Level 1 | bounded visitor/entity aggregation; directional denominator retained |
| Brand A and Brand B in same session | 🟡 | Level 2 | one visitor/session/pair counts once, repeated actions do not inflate it |
| Brand A → later Brand B | 🟡 | Level 3 | ordered chronology only; same timestamp uses sequence then ID |
| Product A ↔ Product B, including same-brand portfolio exploration | 🟡 | Levels 1–3 | composite product identity; opening stages remain explicit |
| Brand ↔ explicit taxonomy choice | 🟡 | Levels 1–3 | explicit selection is distinct from product metadata/exposure |
| Search ↔ Brand association | 🟡 | Levels 1–3 | same visitor/session/ordered facts remain separate |
| Search/state directly leading to Brand/Product | 🟡 | Level 6 primitives exist | new aggregate required; only explicit source IDs qualify |
| Product/brand eligible together | 🟡 | Level 4 | complete canonical states only; non-canonical surfaces excluded |
| Products/brands qualified-seen together | 🟡 | Level 5 | both qualified impressions must reference the same state; dedupe visitor/state/pair |
| One eligible item opened instead of another | 🟠 | Levels 4–6 inputs | needs comparable visibility, no-selection/tie, position and eligibility policy |
| Directional Brand affinity rate | 🟠 | Level 1 available | denominator/sample/privacy/baseline calibration required before insight use |
| Over-index versus platform baseline | 🟠 | Levels 1–6 possible | defensible comparison population, opportunity and acquisition controls required |
| “Behavioural competitors” | 🟠 | no single sufficient level | requires repeated comparable co-exposure/co-consideration and sample stability; overlap alone is insufficient |
| Cross-device/person relationship | 🔴 | unavailable | anonymous journey ID does not identify a person across browsers/devices |

### Future relationship rules and models

Brand affinity is directional. For qualifying definition `Q`, `A → B = unique visitors satisfying Q for A and B / unique visitors satisfying Q for A`. `B → A` has its own denominator. The UI must name `Q` (for example, product openings), period, numerator, denominator, evidence level, and anonymous-browser limitation. Repeated actions by one visitor count once per directional pair and period.

Same-period, same-session, ordered, co-eligible, co-exposed, and directly attributed relationships are distinct columns/facts. `ELIGIBLE TOGETHER ≠ ACTUALLY SEEN TOGETHER ≠ BOTH OPENED ≠ ONE CHOSEN OVER ANOTHER`.

The minimum later structures are:

- `VisitorEntityFact`: visitor, entity type/composite key, qualifying action/stage, session, first/last timestamp, event count; period dedupe is visitor/entity/stage;
- `BehaviorSequenceFact`: visitor/session, from/to entity or action, ordered timestamps/sequences, chronology evidence, optional direct source; directional and one pair per eligible session;
- `CoExposureFact`: visitor/session/state, unordered entity pair, eligible-together flags, qualified-seen flags, positions and surface; complete states only;
- `AffinityFact`: period, directional subject/related entity, qualifying definition, numerator, denominator, rate, evidence level, eligibility/sample/privacy status;
- `VisitorTaxonomyFact`: visitor/session, explicit taxonomy action versus product-taxonomy context, kept as separate evidence types.

Do not create a generic affinity score. Over-index later compares a brand-specific directional rate with an eligible comparison population that excludes the subject cohort where appropriate and controls at least opportunity/context and material acquisition differences. Thresholds must be calibrated from distributions, not chosen arbitrarily in this audit.

### Privacy and external Brand Intelligence

Elena's internal view may use richer aggregate relationship diagnostics. An external brand report must never expose anonymous IDs/timelines, individual behavior, small samples, private collection information, or exact private competitor performance. Named Brand A ↔ Brand B relationships require a separately approved business/privacy policy, sufficient stable unique visitors, repeated observations, and careful competitive disclosure review; anonymized peer groups are the safer default. Anonymous data is not automatically appropriate for external disclosure.

### Real-data feasibility dry run

Across the currently available historical events, privacy-safe aggregation found:

- 1 anonymous visitor and 1 session with openings across multiple brands;
- 2 visitors and 2 sessions with openings across multiple products;
- an ordered same-session `Home of Wool → КИТНА` observation and the reverse direction, one each—feasible chronology, far below insight eligibility;
- 3 visitors/sessions containing both explicit taxonomy choices and brand/product openings;
- 1 visitor/session containing both internal search and brand/product openings; no opened-product event in this sample carried direct `source_search_id`, so these examples remain Level 1–3 associations;
- complete canonical co-eligibility, including `Nutera + Сапунена работилница` in 24 states and `Nutera + Alteya Organics` in 22;
- qualified same-state co-exposure, including `AuraBaby + Crafts of Space` in 2 states and `CYXO + NADNAP` in 2.

These examples prove reconstructability, not publishable affinity, competition, preference, or causality. The sample is too small for external rates or thresholds. Anonymous journey IDs can reset, be blocked, or split one person across devices/browsers, and shared browsers can combine people.

Brand ↔ Brand overlap, Brand ↔ explicit taxonomy, Search ↔ Brand, canonical co-eligibility, qualified co-exposure, and ordered same-session behavior are technically feasible with bounded derived work. Direct Search → Brand evidence is feasible in the contract but absent in this sample. Behavioural competitor and over-index claims require later methodology. No affinity feature, table, tracking, schema, recommendation logic, or UI was implemented.

## 25. Product Intelligence Derivation & Product Design Contract

Status: approved design boundary for EXPLORE-4B. This is an audit of the production contract, not a Product Intelligence UI, tracking/schema change, catalogue join, or affinity model.

### Capabilities and identity

Product identity is always `product_id + brand_id`; `product_id` is not globally unique. `productIdentity()` keys complete identities as `${product_id}::${brand_id}`. Slug fallbacks remain marked `legacy_fallback`; a missing brand becomes `ambiguous`; a missing product identity is excluded. Ambiguous/fallback identities never silently enter peer comparison. No audited Product Intelligence path aggregates by `product_id` alone. Canonical member uniqueness uses state + entity type + product ID + brand ID too.

| Capability | Actual source | Derived readiness | Presentation boundary |
|---|---|---|---|
| Eligible opportunity | product member of a complete canonical state | 🟢 `EligibleProductOpportunity` | `възможност за показване`, never impression |
| Qualified visibility | `product_impression`, existing ≥50% observer | 🟢 `productExposures` | qualified visibility, not attention |
| Discovery opening | `view_product`, `view_stage=selection_click` | 🟢 `productSelections` | direct source must be explicit |
| Product-page load | `view_product`, `view_stage=page_load` | 🟢 `productPageViews` | discovery-linked and landing views separate |
| Legacy view | `view_product` without stage | 🟢 diagnostic | never guess click versus load |
| Save | `save_product` | 🟢 consideration fact | explicit save, not purchase intent |
| Unsave | actual event `remove_saved_product` | 🟡 stored/loaded; not yet projected | separate reversal action |
| Collection | `add_to_collection`, `remove_from_collection` | 🟡 add is consideration; remove needs projection | separate actions; privacy-safe ID only |
| Share | `share_product` | 🟢 consideration fact | separately countable |
| Product outbound | `outbound_product_click` | 🟢 `productOutboundIntents` | `преминаване към сайта`, never sale |
| Brand outbound with product context | `outbound_brand_click` | 🟠 brand-level unless contract explicitly identifies product destination | no silent product credit |
| Repeat product observation | qualifying product event in another session | 🟡 current 90-day lookback | browser-scoped; conservative wording |
| Search/gift/filter context | source state/search plus canonical fields | 🟡 bounded deterministic slicing needed | eligible, seen and opened remain separate |

Human-readable names, brand names, slugs, category, subcategory and product type are 🟢 when present on events. A product URL is 🟡 constructible from a stable slug. Current price, image and availability/status need a read-only catalogue join 🟡; historically accurate versions need time-aware catalogue snapshots 🟠. Analytics contains no reliable image/status history. Labels may fall back to safe slug/ID but never define identity.

### Exact units

| Stage | One fact | Primary deduplication | Context and period |
|---|---|---|---|
| Eligible | one composite product at one position in one complete state | product-opportunity = visitor + product + state + position | state in period; exact surface/position/context |
| Qualified visible | one deduplicated `product_impression` | events, visitors, sessions, explicitly linked opportunities | ≥50% rule unchanged; explicit source when available |
| Opened | one `selection_click` | events, visitors, sessions, opportunities | direct discovery statement needs valid state+position |
| Page viewed | one `page_load` | events, visitors, sessions | explicit/session-sequence discovery link or separate landing |
| Saved | one `save_product` | events, savers, sessions | repeated events retained; visitor rates dedupe |
| Collection | one add or remove | action type, visitors, sessions | no collection name/PII in presentation |
| Outbound | one `outbound_product_click` | events, visitors, sessions | valid product identity; attribution method retained |
| Repeat | one visitor/product/current session with a qualifying prior session | visitor + product + current session | current event in period; prior may be in 90-day lookback |

Raw events deduplicate by `event_id` (with the existing legacy fallback). Visitor means consenting `anonymous_journey_id`; session means `anonymous_session_id`. Events, products, states, opportunities, sessions and visitors must always be labelled and never mixed.

Repeat qualification currently includes `product_impression`, staged `view_product`, `save_product`, `add_to_collection`, `share_product`, and `outbound_product_click`. It requires the same composite product and anonymous journey in different sessions, and deduplicates visitor/product/current-session. Repeated events within one session do not qualify. Because a qualified impression itself qualifies, the first UI must say `повторно измерена видимост или действие`, not imply a deliberate reopening. Anonymous browser identity is neither a person nor cross-device loyalty.

### Opportunity, visibility and contexts

Eligibility exists only for complete canonical states. It proves membership and absolute 1-based position, not viewport entry. Pre-canonical history and non-canonical surfaces cannot receive fabricated denominators. Qualified visibility preserves the producer's `intersectionRatio >= 0.5`; DOM rendering alone does not count. No impression means no recorded qualified visibility, not rejection.

Current position bands are `1–4`, `5–12`, `13–24`, `25+`. Observed surfaces include brand page, brand-page products, category, gift discovery, homepage default, more from brand, named/shared/saved collections, product type, related products, search results, SEO landing and subcategory. Eligibility is available only where a complete state exists; event-only surfaces remain numerator-only.

Search evidence is: eligible for query via state membership; qualified-visible via explicitly sourced impression; opened from query via explicitly sourced selection; later same-session query is contextual only. Gift, taxonomy, price and filter dimensions use the same three layers. `Показван при избор „За жена“` describes a discovery request, never demographic preference or demand.

### Opening, page, saves and outbound

`selection_click` is a card opening; `page_load` is an actual destination load. The current linker can inherit a prior opportunity for the same product/session and records `method=session_sequence`; UI must distinguish that from event-explicit source. Direct/external/organic page loads without a link are landing interest, not Bulgaritam discovery selection.

Product-page visitors may use existing deterministic acquisition groups (`organic`, `direct/unknown`, `social`, `referral`, other existing groups). Acquisition is not discovery source. Exact Google queries remain unavailable without Search Console. Only `outbound_product_click` with valid composite identity is product outbound. A brand-level outbound stays brand-level. Use `преминаване към сайта`, never purchase/conversion.

Save, add-to-collection and share may sit under `Запазване и други сигнали за обмисляне`, but their facts/counts remain distinct. One save-to-board interaction can emit both `save_product` and `add_to_collection`, so they cannot be naively summed. Removes are separate reversals. Ordering could later describe chronology, but cannot prove save caused a later action; EXPLORE-4B excludes save-to-later attribution.

### Reject a classic product funnel; approve bounded rates

`eligible → visible → opened → page → saved → outbound` is not a coherent conversion funnel. Eligible/visibility/selection can share a product-opportunity, while page/save/outbound can be explicit or same-session linked; saves and outbound are parallel rather than mandatory stages. `ProductFunnelRow` is an internal stage summary, not permission to draw a narrowing funnel.

Approved rates are:

| Rate | Numerator / denominator | Rule |
|---|---|---|
| Qualified visibility | explicitly linked impressed opportunities / eligible opportunities | complete states and same context slice |
| Selection among visibility | directly linked selected opportunities with prior qualified visibility / linked impressed opportunities | otherwise show separate counts |
| Visitor selection | distinct selecting visitors with prior visibility / distinct qualified-visible visitors | same product/context; not conversion |
| Outbound among page visitors | distinct linked product-outbound visitors / distinct product-page visitors | suppress incompatible populations |
| Save among page visitors | distinct linked savers / distinct product-page visitors | save and collection remain distinct |
| Repeat observation | returning product browsers / browsers with qualifying product event | 90-day lookback required; impression caveat |

Factual rates require only non-zero compatible denominators. Interpretive comparisons additionally require the gates below. Existing aggregate rates whose numerator is not provably a denominator subset must not be presented.

### Raw versus adjusted performance and peer audit

Raw performance is a labelled set of stage counts, never one score. Adjusted performance compares unique product-opportunity selections per unique product-opportunity exposure. Current cohort fallback remains:

1. same product type + surface + position band;
2. same product type + surface;
3. same subcategory + surface;
4. same category + surface;
5. same product type;
6. suppress.

The focal composite product is excluded. The first level with at least five peer products wins. Baseline is the median peer rate; percentile is the share of peer rates `<=` focal. Quartile helpers exist, but current product insights do not emit IQR. There is no statistical significance test.

Current provisional confidence requires ≥20 focal exposures, ≥20 eligible opportunities, ≥10 exposed visitors and ≥5 peers. `MEDIUM` requires ≥50 exposures/opportunities; `HIGH` requires ≥200 exposures/opportunities and ≥50 visitors. Below-median by more than 25% creates an existing lower-than-peer candidate; above-median by more than 25% with below-peer-median exposure creates an early/hidden candidate. Outbound comparison also requires 20 outbound events. These labels are rule-based, not statistical confidence.

One material gap blocks adjusted UI as-is: `ProductFunnelRow` chooses one `primarySurface`, `positionBand` and taxonomy context from the first available fact. Multi-surface products can therefore inherit incidental context. EXPLORE-4B may show raw totals, but adjusted claims must first derive product × surface × position-band slices and then apply the unchanged fallback, or stay suppressed.

Low-exposure products remain factual: `Все още няма достатъчно сравними показвания за надеждна оценка.` They are never bottom-ranked. High-opportunity/low-action wording is allowed only after compatible exposure and peer gates. Small early action is `Има ранни измерени действия, но показванията не са достатъчни за сравнение.`

### Product Explore product design

The first area answers:

1. Кои продукти хората действително виждат?
2. Кои от видените продукти отварят?
3. Кои продукти стигат до продуктова страница?
4. Кои водят до запазване или преминаване към сайта?
5. Кои получават малко възможности за показване?
6. Към кои има повторно измерена видимост или действие в друго посещение?
7. От кои места и контексти се откриват продуктите?
8. Кои се различават от типичното при достатъчно сравними показвания?

| Section | Facts | Low-data behavior / drill-down |
|---|---|---|
| Какво се случи | products/visitors at separately labelled stages | always factual; disclose canonical coverage |
| Какво заслужава внимание | eligible peer cases, low-exposure cases, early signals | omit interpretations when gates fail |
| Продукти, които се виждат и отварят | visible visitors and direct openings | factual counts and denominators |
| Продукти с малко видимост | eligible versus qualified-visible | state performance is unknown |
| Сравнение при сходни показвания | cohort, median, focal rate, sample | hidden until sliced cohort/gates pass |
| Всички продукти | compact sortable factual table | secondary exploration, not 20-column primary UI |
| Детайл за продукт | facts, contexts, caveats, peer evidence | composite-key panel/route |

Product detail shows aggregated opportunity, visibility, opening, page, save, collection, outbound and repeat facts; surfaces/positions; direct search/gift/filter context; landing acquisition; cohort/baseline/sample; limitations. It never exposes visitor/session IDs or timelines. Suppressed comparison retains facts plus the exact suppression reason.

Factual lists use names such as `Най-често отваряни`, never `най-добри`. Sort by declared count, then distinct visitors, normalized product name, brand name and composite key. Adjusted lists sort by declared peer difference, sample, then stable identity. Insufficient-exposure products live in a separate group.

### Future Product ↔ Brand/Product boundary

Current facts can reconstruct product-to-brand chronology, multiple same-brand products in a session and later cross-session same-brand product activity. They do not justify gateway product, cross-sell driver or portfolio role. Future `разглеждат и…` work must keep same visitor, same session, ordered session, same complete choice set, qualified co-exposure and direct attribution as distinct evidence levels. Affinity, behavioral competitors and recommendation-quality claims remain future-only.

### Read-only production dry run — 15 September 2026

The Supabase source was read without writes. Event coverage starts `2026-08-15 14:26 UTC`; canonical coverage starts `2026-09-12 16:16 UTC`. Loaded: 4,469 events, 44 states, 7,513 members. Thirty-day and historical event results are nearly identical, but eligible denominators cover only post-rollout history.

| Window | Products eligible / visible / opened / page-viewed | consideration / collection / outbound / repeat | Visitors eligible / visible / opened / page / consideration / outbound / repeat |
|---|---|---|---|
| 7d | 549 / 518 / 9 / 11 | 1 / 1 / 18 / 218 | 10 / 50 / 6 / 7 / 1 / 14 / 2 |
| 30d | 549 / 544 / 9 / 11 | 1 / 1 / 29 / 245 | 10 / 94 / 6 / 7 / 1 / 28 / 2 |
| reliable history | 549 / 544 / 9 / 11 | 1 / 1 / 29 / 245 | 10 / 94 / 6 / 7 / 1 / 28 / 2 |

`Eligible` is distinct composite products, not opportunities. The 7,208 canonical product-opportunities split: 139 at 1–4; 265 at 5–12; 292 at 13–24; 6,512 at 25+. More visible than eligible visitors reflects event-only surfaces and incompatible denominators—not a funnel. Repeat products are high because impressions qualify across smoke-test sessions; only two browsers create these facts.

Privacy-safe examples: `Картина – японски вълни` / Raelumin (16 eligible, 2 linked visible, 0 opened); `Ръчно рисувани чаши за вино Слънчогледи` / Art Tochka (16, 2, 0); `Сребърна лъжичка „Ветрило“` / Studio Nikolas (16, 2, 0). These are facts, not judgments.

Peer logic formed cohorts for 446 rows in 7d and 492 in 30d/history, but zero products passed confidence; 551 rows (7d) and 554 (30d/history) were suppressed. Examples:

- `Картина – японски вълни`: 16 eligible, 2 exposed, 0 selected; level 1, 8 peers, 110 peer opportunities, median 0, percentile 1; suppressed.
- `Сребърна лъжичка „Ветрило“`: 16/2/0; level 3, 22 peers, 299 peer opportunities, median 0; suppressed.
- `Изкуство за стена Michaelangelo’s David`: 16/2/0; exact level 0, 5 peers, 66 peer opportunities, median 0; suppressed.

Percentile 1 when all rates equal zero is a `<=` artifact, not superiority; suppress it. Peer opportunity total is diagnostic but not a current confidence gate.

### Data quality, minimum model and EXPLORE-4B boundary

Reliable history had 3,141 product-relevant events: zero missing product IDs, missing brand IDs, unsafe/missing composite identities, product outbounds without identity, or duplicate event IDs. All states passed count/position integrity. Eight canonical-sourced impressions lacked matching eligible membership (suspicious; exclude from rates). No directly linked selection lacked prior visibility in the strict check. Fourteen page facts lacked discovery attribution (expected direct/external landing candidates). No catalogue resolution/history join was attempted.

Existing structures suffice: `EligibleProductOpportunity`, `ProductStageFact`, `RepeatInterestFact`, and `ProductFunnelRow` as a raw summary only. EXPLORE-4B needs one `ProductPeerComparisonFact` keyed by composite product × explicit surface × position band, carrying fallback, focal/peer samples, median, optional percentile, provisional confidence and suppression reason. An optional read-only `ProductCatalogueLabel` may supply current labels, explicitly non-historical. Removal events need a separate bounded action projection if displayed. Missing identity/state/context fails closed.

EXPLORE-4B may implement only the hierarchy above; composite identity; separate stage facts; opportunity versus visibility; selection versus landing; save/add/share distinctions; product outbound; conservative repeat; audited context levels; deterministic factual lists; low-data/quality explanations; sliced peer comparison with unchanged fallback/gates; optional current catalogue labels; and focused identity/stage/attribution/cohort/tie/suppression tests.

Future-only: affinity/co-view, behavioral competitors, gateway/portfolio roles, saved-to-later causal narratives, multi-factor/statistical adjustment, Search Console queries, purchase/revenue, historical catalogue enrichment, and tracking/schema changes.

Forbidden claims: purchase, sale, conversion, revenue, quality, attractiveness, preference, causal effect, market share, representative Bulgarian behavior, demographic preference, competitor relationship, recommendation quality, exact SEO query attribution without direct evidence, and best/worst without approved adjusted methodology. Eligibility is not visibility; visibility is not attention; save is not purchase intent; outbound is not sale; no visibility is not rejection.
