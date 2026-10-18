# Manual price fallback (90 days)

This release treats a manually researched price as a historical reference, not
as a fresh automated Offer. The public resolver requires complete manual
provenance, the same canonical external product URL, a compatible currency, an
eligible monitor fetch/extraction failure, no positive change or ambiguity, and
a genuine verification date no more than 90 days old.

## Required Baserow schema migration (not applied by this release)

Add these fields to the existing Products table before enabling Admin review
actions:

1. `manual_price_last_reviewed_at` — Date, include time, UTC.
2. `manual_price_review_outcome` — Single select with exactly:
   `confirmed_unchanged`, `change_found`, `unable_to_verify`,
   `source_unavailable`.

No existing field is renamed or cleared. The migration must be applied and
validated separately; this repository change performs no schema mutation.

## Review lifecycle

- Review becomes due 60 days after `manual_price_verified_at`.
- It is overdue at day 90. The reference remains displayable at the exact
  90-day boundary and expires immediately after it.
- `unable_to_verify`, `change_found`, and `source_unavailable` update only the
  review audit fields (plus the relevant authoritative status for the latter
  two). They never refresh either verification timestamp.
- `confirmed_unchanged` is an explicit human action. It reuses
  `buildManualPriceMutation(..., "confirm")` and is blocked when monitoring has
  positive change, ambiguity/variation, currency conflict, dead-source, or
  canonical-identity evidence.

Manual references are not passed to Product JSON-LD, Price History, the
discount evaluator, cards, or automatic approval.

## Static-public expiry safety

The canonical resolver keeps the exact 90-day boundary inclusive. Static HTML
cannot remove an amount after publication, and this project does not have an
approved dynamic product-page runtime. Public builds therefore use a
conservative 83-day emission cutoff, reserving seven days for the maximum
supported weekly publishing interval. A reference emitted at the inclusive
day-83 boundary may remain visible through day 90; the next build must occur no
later than seven days afterward. Day-84 through day-90 references remain valid
in the data model and Admin, but the static public page shows the orientational
range instead. If the publishing interval can exceed seven days, the public
build must be withheld or this safety window must be increased before release.
