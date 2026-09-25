# Bulgaritam Price Monitor V1

Read-only, deterministic price discovery for external product pages. The module does not import or mutate public product data, Baserow records, UI components, or Product JSON-LD.

## Layers

- `monitor.mjs`: HTTP fetching, status mapping, redirect reporting, comparison, concurrency.
- `extract.mjs`: platform-agnostic extraction tiers plus narrowly scoped Shopify/WooCommerce adapters and conservative semantic DOM fallback.
- `platform.mjs`: diagnostic platform signals only; extraction does not depend on them.
- `normalize.mjs`: locale-aware numeric and currency normalization.
- `index.mjs`: public API for independent use and future scheduled jobs.

## Commands

```sh
npm run price-monitor -- url --url=https://example.com/product
npm run price-monitor -- product --slug=product-slug
npm run price-monitor -- batch --limit=20 --concurrency=5 --output=reports/price-monitor.json
npm run test:price-monitor
npm run migrate:price-monitor
npm run monitor:scheduled -- due
```

`url` does not require Baserow. `product` and `batch` read the catalog but never write to it. Results include both `status` (where a redirect remains visible) and `extraction_status` (so an ambiguous/not-detected extraction is not hidden by the redirect).

Platform adapters run only after generic machine-readable extraction fails and the platform was positively detected. Variant data is accepted only when all active/purchasable variants share one price; divergent prices return `ambiguous`.

## Persistence safety

Monitoring commands are dry-run by default. `npm run migrate:price-monitor` prints the schema migration plan without writing it. Schema changes require the separate `--apply-schema` flag.

After the Baserow current-state migration and Google Sheet setup have been explicitly approved and applied, configure `GOOGLE_PRICE_MONITOR_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. `--write-monitor-results` then appends one immutable observation per real check to the Sheet's `Price History` tab before patching only the allowlisted Baserow monitoring metadata. If history append fails, Baserow is not patched.

`npm run setup:price-monitor-sheet` is dry-run by default and prints the exact tabs, columns, and derived formulas. Its separate `--apply` mode creates `Price History`, `Prices`, and `Price Timeline`; it refuses to overwrite a non-matching history header. The monitor itself writes only `Price History`. `Prices` and `Price Timeline` are formula-derived and can be regenerated from history by stable `product_id`.

The monitoring persistence layer rejects `price_min_eur`, `price_max_eur`, `offer_price_amount`, and `offer_price_currency`; changing verified/public prices remains a separate approval operation.

## Scheduled and manual monitoring

The scheduler is dry-run unless `--write-monitor-results` is explicitly supplied:

```sh
npm run monitor:scheduled -- one --slug=product-slug
npm run monitor:scheduled -- one --id=123
npm run monitor:scheduled -- domain --domain=example.bg --limit=50
npm run monitor:scheduled -- domain --brand="Brand Name" --limit=50
npm run monitor:scheduled -- batch --limit=50
npm run monitor:scheduled -- due
```

Due runs target `ceil(active monitorable products / 14)` and apply a per-domain `ceil(domain products / 14)` quota. Excess due work remains in the backlog. The scheduler uses global concurrency 6, one in-flight request per domain, a 2-second minimum same-domain start interval, a 15-second attempt timeout, and at most two exponential-backoff retries for network/timeouts and HTTP 408/425/5xx. HTTP 403/429, CAPTCHA/anti-bot responses, 404/410, ambiguity, and extraction failures are not retried.

An optional `--apps-script-fallback` switch is implemented but is not enabled by the production workflow. It requires `APPS_SCRIPT_PRICE_FETCH_URL` and `APPS_SCRIPT_PRICE_FETCH_SECRET`, uses the live Baserow row ID and URL without a static product registry, and runs only after Node receives an approved fetch-level failure (403, exhausted network/timeout, or exhausted 408/425/500/502/503/504). Successful fetches, changed/redirected detections, ambiguity, browser-required pages, 404/410, and 429 never route to fallback. Returned HTML always re-enters the same canonical Node extractor.
