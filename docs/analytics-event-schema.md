# Bulgaritam discovery analytics schema

Transport: consent-gated `window.dataLayer.push({ event, ...parameters })` → GTM → GA4. `G-7XT69Z6DKS` remains the verified GA4 Measurement ID. Until `PUBLIC_GTM_CONTAINER_ID` is configured, local code keeps the existing direct GA4 sender as a mutually exclusive fallback.

## Shared parameters

| Parameter | Meaning |
| --- | --- |
| `product_id`, `product_slug`, `product_name` | Stable Baserow Product ID plus readable context |
| `brand_id`, `brand_slug`, `brand_name` | Stable Baserow Brand ID plus readable context |
| `category`, `subcategory`, `product_type` | Structured taxonomy context |
| `list_context`, `list_name`, `position` | Placement and approximate 1-based result position |
| `query`, `search_term`, `normalized_query`, `structured_intent`, `used_fallback` | Search attribution; `query` remains for backwards compatibility |
| `gift_recipient`, `gift_occasion`, `active_filters` | Active discovery facets |
| `source_context` | UI/page surface that caused the action |
| `destination_domain` | Merchant hostname only; URL paths/query parameters are excluded |
| `page_path`, `page_title`, `page_type`, `language`, `device_type` | Non-identifying page/session context |
| `landing_page`, `referrer_domain`, `utm_source`, `utm_medium`, `utm_campaign` | Acquisition context without full referrer URLs |

`list_context` values: `homepage_default`, `search_results`, `category`, `subcategory`, `product_type`, `gift_discovery`, `brand_page`, `recommended`, `saved_collection`, `seo_landing_page`, `brand_directory`.

## Events

### Search

- `search`: shared context plus `query`, `search_term`, `normalized_query`, `result_count`, `search_results_count`, `structured_intent`, `used_fallback`, taxonomy and gift facets.
- `search_results_view`: same schema, emitted for a non-zero settled result set.
- `search_no_results`: same schema, emitted for a zero-result settled result set.

### Browse

- `select_category`, `select_subcategory`, `select_product_type`
- `select_gift_recipient`, `select_gift_occasion`
- `apply_filter`, `remove_filter`, `clear_filters`, `change_sort`

All include `selected_value` where applicable and the current discovery context.

### Visibility

- `product_impression`: Product + Brand IDs, taxonomy, list context/name, position, query and active facets.
- `brand_impression`: Brand ID, list context/name, position, query and active context.

An impression requires at least 50% intersection. The client deduplicates by DOM card and discovery-context signature, so rerendering does not repeatedly fire the same impression while a genuinely changed query/filter context can create a new attributed impression.

### Engagement and commerce

- `view_product`, `save_product`, `remove_saved_product`, `share_product`
- `view_brand`, `save_brand`, `outbound_product_click`, `outbound_brand_click`

Outbound events include `destination_domain`, never the full merchant URL.

### Collections

- `create_collection`, `add_to_collection`, `remove_from_collection`, `view_collection`, `share_collection`

Allowed collection parameters: opaque local `collection_id`, `item_count`/`collection_product_count`, `method`/`share_method`, and relevant Product/Brand IDs. User-entered collection names are prohibited.

## First-party event store

After analytics consent, the same sanitized event is optionally sent to `PUBLIC_ANALYTICS_ENDPOINT`. The implementation endpoint is `https://admin.bulgaritam.bg/api/events/` and stores rows server-side in the Baserow table configured as `BASEROW_ANALYTICS_EVENTS_TABLE_ID`. The public browser never receives a Baserow token.

The store uses an opaque per-tab/session ID in `sessionStorage` and an opaque journey ID in `localStorage`; both are created only after consent when an event is sent. Search/discovery context is retained in `sessionStorage` and added to downstream product, save, collection and outbound events. No account identity, IP-derived field, email, phone, collection name, full destination URL or URL query string is stored.

Required Analytics Events fields: `event_name`, `occurred_at`, `anonymous_session_id`, `anonymous_journey_id`, `product_id`, `product_name`, `brand_id`, `brand_name`, `category`, `subcategory`, `product_type`, `search_term`, `search_results_count`, `collection_id`, `source_context`, `destination_domain`, and `payload_json`.

## GTM workspace specification

Create one unpublished workspace with:

1. Data Layer Variables for every shared parameter and event-specific `result_count`, `selected_value`, `collection_id`, `item_count`, and `method`.
2. Custom Event triggers grouped by Search, Browse, Visibility, Engagement, Outbound and Collections.
3. One GA4 Configuration/Google tag for `G-7XT69Z6DKS` with consent checks.
4. GA4 Event tags using `{{Event}}` and the allow-listed parameters above. Do not forward arbitrary dataLayer keys.
5. Consent Initialization defaults: analytics/ad storage denied; analytics storage updates only from Bulgaritam consent.

Preserve unrelated container tags, triggers and variables. Preview/Debug validation is required before any container version is published.

## Reporting and Brand isolation

Founder reporting may aggregate all events and acquisition dimensions. Future Brand reporting must always filter by stable `brand_id`, return aggregates only, and never expose client/user identifiers. Search terms in Brand reporting should be suppressed until at least 5 events exist for the Brand/query/period combination; suppressed rows roll into “Other”. Founder-only reports may retain platform-wide zero-result and unmet-demand analysis.

GA4 custom dimensions should prioritize: `product_id`, `brand_id`, `category`, `subcategory`, `product_type`, `list_context`, `list_name`, `query`, `structured_intent`, `used_fallback`, `gift_recipient`, `gift_occasion`, `active_filters`, `source_context`, `destination_domain`, `selected_value`. Register `result_count`, `position`, `item_count` as custom metrics where needed.

## Privacy constraints

Analytics is sent only after analytics consent. Email-like and Bulgarian phone-like values are redacted. Email, phone, user names, collection names, full outbound URLs, and URL query parameters are not sent. Country/region/device/acquisition should use GA4's privacy-controlled aggregate dimensions rather than custom user-level collection.
