# Price Monitor scheduling architecture

Status: implemented locally; repository workflow activation is pending the GitHub prerequisites below.

## Runtime choice

Use the repository's existing GitHub Actions infrastructure. The Admin runs on Vercel, but a catalog crawl is a poor fit for a request-bound serverless function. GitHub Actions already stores the Baserow secret, supports scheduled/manual runs, concurrency locks, 30-minute job timeouts, and durable JSON artifacts.

The workflow runs daily at 02:17 UTC. Its default target is `ceil(active monitorable products / 7)`, so eligible successful-price products are covered in a rolling approximately 7-day cycle without calendar-date bursts.

## Load controls

- Dynamic daily target: `ceil(active monitorable products / 7)`.
- Max bounded run: `min(2000, max(25, ceil(daily target × 1.25)))`; manual limits are clamped to it.
- Global concurrency: 6.
- Per-domain concurrency: 1.
- Minimum interval between starts to one domain: 2 seconds.
- Per-attempt timeout: 15 seconds.
- User-Agent: `BulgaritamPriceMonitor/1.0 (+https://bulgaritam.bg/; contact: info@bulgaritam.bg)`.
- Due selection is domain-first round-robin. Each domain is capped at `ceil(active products on that domain / 7)` per daily run, so a 100-product brand is spread over roughly 7 runs.

The measured 1,016-URL full scan completed in 153 seconds locally. A normal daily 143–146-product run is therefore expected to spend roughly 20–60 seconds monitoring, plus runner setup and persistence. A pathological run where many independent domains time out can take longer; the workflow has a 30-minute ceiling.

## Due and priority policy

| State | Recheck interval |
|---|---:|
| changed | 3 days |
| transient error | 3 days |
| verified/current | 7 days |
| ambiguous | 7 days |
| not detected | 7 days |
| redirected | 7 days |
| browser required | 30 days |
| blocked | 30 days |
| dead URL | 45 days |

Priority affects selection inside the daily cap; it does not bypass domain throttling. Excess due items remain due and form the next run's backlog. History is append-only and is never collapsed into the latest state.

| Active products | Daily target | Max bounded run | Approx. history rows/month | Approx. history rows/year |
| ---: | ---: | ---: | ---: | ---: |
| 1,000 | 143 | 179 | 4,286 | 52,143 |
| 2,000 | 286 | 358 | 8,571 | 104,286 |
| 5,000 | 715 | 894 | 21,429 | 260,714 |
| 10,000 | 1,429 | 1,787 | 42,857 | 521,429 |

## Failure handling

Retry only timeouts/network failures and HTTP 408, 425, 500, 502, 503, and 504. Use two retries after 1 and 2 seconds. Do not retry 403, 429, CAPTCHA/anti-bot responses, 404/410, ambiguous extraction, or missing price. The monitor never attempts CAPTCHA solving or protection bypasses.

Successful scheduled checks append an immutable row to Google Sheets `Price History` first, then update allowlisted monitoring state in the Baserow Products table. A history failure prevents the current-state patch. A later Baserow failure leaves the history observation intact and the run report records the persistence error. The monitor never writes `offer_price_amount`, `price_min_eur`, or `price_max_eur`. Changed products naturally appear in Price Health through `price_check_status=changed`.

## Cost

No paid service is introduced by this design. Costs are limited to existing GitHub Actions minutes, Baserow/API traffic, and the normal free Google Sheets API quota. Baseline external product requests equal the dynamic daily target before rare retries. GitHub billing depends on repository visibility and the account's included Actions allowance.

## Activation prerequisites

1. Approve and apply the dry-run Baserow Products current-state migration.
2. Create a Google Spreadsheet, enable the Google Sheets API, create a service account, and share the spreadsheet with its email as Editor.
3. Run `npm run setup:price-monitor-sheet` to inspect the plan; only after approval run it with `--apply`.
4. Set GitHub variable `GOOGLE_PRICE_MONITOR_SPREADSHEET_ID` and secrets `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`.
5. Confirm `BASEROW_API_TOKEN` has row read/write access only to the Products table.
6. Review the first workflow-dispatch dry-run artifact.
7. Only then merge/enable the scheduled workflow.
