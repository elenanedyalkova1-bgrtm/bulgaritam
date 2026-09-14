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
