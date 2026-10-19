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

The canonical resolver keeps the exact 90-day boundary inclusive, and public
builds retain the conservative 83-day eligibility cutoff. Exact manual amounts
are now emitted only inside inert templates. The visible static/no-JavaScript
fallback is the orientational range or a link to check the brand's price.

The client validates the original verification date and the exact 90-day expiry
before displaying the template. It removes the amount at expiry, when hidden,
and rechecks on visibility/page restoration. A missed publication no longer
leaves an expired manual amount visible in ordinary browsers. This gate relies
on the browser clock; it is a display safeguard, not authoritative server time.
No data approval, verification timestamp or monitoring rule is changed.
