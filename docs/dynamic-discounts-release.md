# Safe dynamic /namaleniya/ release

Baseline: `45643ada55077eef2ec29aeeee3ce4220c0de386`.
This change is public-page only. It does not deploy the Admin, mutate source data,
change monitoring, or change the manual-price rules.

## Behavior

The static page retains its title, canonical, description, methodology, and
product/store links. Static reference cards carry no current prices, discount
percentages, freshness claims, or deal impression tracking. A permanent inert
card template and empty live grid allow recovery even when the build has no
deals or its read-only source loading fails.

The browser uses the existing production Consumer Deals endpoint. It validates
snapshot version/count/stale state/timestamp, price pairs and percentages,
currency, observation timestamps, duplicate identities, HTTP(S) URLs and exact
internal product paths. Legacy HTTP image URLs are upgraded to HTTPS locally,
without modifying the stored data; merchant destination URLs are preserved. A malformed batch or `stale: true` fails closed; expired
observations in an otherwise valid cached batch are omitted. Failure removes all
previously live prices and shows the neutral static references and retry action.
A valid empty response is distinct from a failure.

Requests time out after 12 seconds. Visible pages re-request every 10 minutes,
respecting the API/CDN cache. Observation expiry is scheduled at the earliest
72-hour deadline, rechecked at least every minute while timers run, and rechecked
on visibility/page restoration. Hidden tabs do not poll. Browser suspension can
delay timers; the visibility handler removes expired cards before showing the
live section. Timestamp validation allows the existing five-minute future-clock
tolerance. Client device clock errors remain a limitation. No client can detect
a merchant ending a sale before the next monitoring observation; the API exposes
observation times, not merchant promotion expiry dates.

## Local verification (no production requests)

Install the repository and Admin development dependencies as usual. Run:

```sh
npm run test:dynamic-deals
npx playwright install chromium
npm run test:deals-browser
node --test test/manual-price-fallback-ui.test.mjs
node --import ./admin-app/node_modules/tsx/dist/loader.mjs --test test/verified-offer.test.ts
```

An installed Chrome can be used instead of downloading Chromium:
`DEALS_BROWSER_CHANNEL=chrome npm run test:deals-browser`.
The browser suite compiles copies of the actual page, layout, shared card,
filters and loader with deterministic server-side data fixtures (nonempty,
empty, and failed source). Its browser requests to the API are mocked, and all
other external requests are blocked. It also runs the production deals build
verifier against compiled artifacts and deliberately broken variants.

## Controlled deployment — separate authorization required

1. Review the exact commit against the baseline and check that unrelated
   uncommitted work is excluded. Confirm current `main` and resolve any drift
   before preparing a release. This implementation does not push or merge.
2. Before any push, inspect BOTH connected Vercel projects' Git triggers,
   production branches, preview rules, and Ignored Build Steps. Do not assume a
   dedicated branch or the previous public guard suppresses Vercel deployments.
3. `scripts/vercel-ignore-reviewed-release.mjs` returns exit **0 to skip** only
   exact reviewed changesets/releases (including the previous manual-price
   Admin-only profile); exit **1 permits a build** for new/unknown/altered
   changesets or incomplete history. This new public change is not covered by
   that old profile. The guard is deliberately unchanged. It does not authorize
   publication and does not protect the Admin from an automatic Git deployment.
   If trigger isolation cannot be demonstrated, STOP before pushing/merging;
   obtain a separately reviewed release-control plan. Do not broaden or bypass
   the existing guard, modify Vercel settings, or redeploy the current Admin as
   part of this page release.
4. After explicit release approval and trigger isolation, build the exact
   reviewed public revision in the controlled public release environment using
   the existing read-only source credentials and production endpoint. No source
   data writes or monitor jobs are needed. Run `verify-public-build.mjs`: it now
   requires the deals grid, template, endpoint, loader behavior and asset graph,
   in addition to its existing catalog checks. Archive the complete verified
   artifact, SHA, checksums and current hosting files before publication.
5. The existing publish workflow builds the ENTIRE public catalog from current
   data. Diff the resulting artifact against hosting; source scope alone does
   not guarantee that only /namaleniya/ changes. Review changes to other pages or
   stop and prepare a separately approved page/asset-scoped release. Upload all
   required hashed assets before the new HTML and retain previous assets.
6. Publish only through the approved public/SuperHosting process. A successful
   build is not a deployment: confirm the publish job actually ran and succeeded.
   Do not run an Admin/Vercel deployment. Verify the exact served /namaleniya/
   HTML and asset checksums, browser CORS request, response generation time,
   visible card identity/prices, filters, sorting, links and analytics. Exercise
   failure conditions locally or with browser request interception, never by
   disabling the live API or changing live source data.

## Rollback

Keep the preceding public artifact and required hashed assets available, but
note that the old live page contains static active-price claims. Blindly
restoring that page would restore the original stale-discount problem. Before
release, also prepare and review a neutral /namaleniya/ rollback artifact that
retains SEO/product links without active prices or a dynamic loader. If a safe
previous dynamic release exists, restore that complete reviewed artifact;
otherwise use the neutral artifact as the immediate page-only fallback. Verify
served checksums and absence of active price claims. Do not roll back or alter
the Admin, monitoring workflows, Baserow, Google Sheets or Vercel settings.

New API deals can reference internal product pages that have not yet been
published in the static catalog. Catalog publication remains necessary for new
product routes; this change does not create routes or alter API destinations.
A malformed batch is rejected as a whole (safe availability tradeoff), while
merely expired observations are filtered individually.
