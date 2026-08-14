# Bulgaritam Analytics Dashboard

This document describes the analytics setup now wired into Bulgaritam and the dashboard structure to use in GA4 + Looker Studio for monthly reporting.

## Measurement ID

The site is configured to use:

- `G-7XT69Z6DKS`

It can also be overridden later with:

- `PUBLIC_GA_MEASUREMENT_ID`

## Tracking model

Bulgaritam now sends structured events through a central analytics layer in:

- `/Users/elenanedyalkova/bulgaritam-clean/src/layouts/BaseLayout.astro`

Tracking respects cookie consent:

- analytics events are sent only when analytics cookies are accepted

## Events currently tracked

### Discovery and search

- `homepage_search`
- `brands_search`
- `category_pill_click`
- `subcategory_pill_click`
- `sort_change`
- `filter_apply`
- `occasion_filter_apply`

### Navigation and clicks

- `product_open`
- `brand_open`
- `outbound_brand_click`

### Save and sharing

- `save_product`
- `copy_collection_link`
- `share_collection`

## Main event parameters

Depending on the interaction, events can include:

- `page_path`
- `page_location`
- `page_title`
- `language`
- `device_type`
- `product_slug`
- `product_name`
- `brand_slug`
- `brand_name`
- `category_key`
- `subcategory_keys`
- `destination_url`
- `search_query`
- `results_count`
- `active_category`
- `active_subcategory`
- `sort_mode`
- `occasion_keys`
- `delivers_outside_bulgaria`
- `board_id`
- `board_name`
- `items_count`

## Recommended GA4 custom dimensions

In GA4 Admin -> Custom definitions, create event-scoped custom dimensions for:

1. `product_slug`
2. `product_name`
3. `brand_slug`
4. `brand_name`
5. `category_key`
6. `subcategory_keys`
7. `search_query`
8. `active_category`
9. `active_subcategory`
10. `sort_mode`
11. `occasion_keys`
12. `delivers_outside_bulgaria`
13. `board_name`
14. `destination_url`
15. `device_type`
16. `language`

Recommended custom metrics:

1. `results_count`
2. `items_count`

## Suggested Looker Studio dashboard pages

### 1. Overview

Scorecards:

- Total outbound brand clicks
- Total product opens
- Total saves
- Total collection shares
- Total searches

Breakdowns:

- Outbound clicks by device
- Outbound clicks by language
- Searches by page

### 2. Top products

Table:

- Dimension: `product_name`
- Dimension: `brand_name`
- Dimension: `product_slug`
- Metric: Event count
- Filter: `event_name = outbound_brand_click`

Secondary table:

- Filter: `event_name = save_product`

Use this for:

- most clicked products
- most saved products

### 3. Top brands

Table:

- Dimension: `brand_name`
- Dimension: `brand_slug`
- Metric: Event count
- Filter: `event_name = brand_open`

Separate table:

- Filter: `event_name = outbound_brand_click`

Use this for:

- most opened brands
- brands receiving most outgoing traffic

### 4. Search behavior

Table:

- Dimension: `search_query`
- Metric: Event count
- Filter:
  - `event_name = homepage_search`
  - or `event_name = brands_search`

Add charts for:

- top homepage searches
- top brands page searches
- low-result searches

### 5. Filter behavior

Table:

- Dimension: `active_category`
- Dimension: `active_subcategory`
- Dimension: `sort_mode`
- Metric: Event count

And separate tables for:

- `category_pill_click`
- `subcategory_pill_click`
- `occasion_filter_apply`
- `filter_apply`

This shows:

- which pills are most used
- which filters influence browsing most

### 6. Save and share behavior

Table:

- Dimension: `board_name`
- Metric: Event count
- Filter: `event_name = save_product`

Another table:

- Filter:
  - `event_name = copy_collection_link`
  - `event_name = share_collection`

This shows:

- what people save
- whether saved collections are being shared

## Monthly report structure

Use this fixed monthly structure:

1. Total outbound clicks to brands
2. Top 10 clicked products
3. Top 10 clicked brands
4. Top 20 searches
5. Top clicked categories and subcategories
6. Save behavior summary
7. Collection share summary
8. Mobile vs desktop behavior
9. Key opportunities

## Best business KPI for Bulgaritam

The core KPI is:

- `outbound_brand_click`

This is the clearest metric for proving value to brands because it shows real traffic sent from Bulgaritam to the brand site.

The second most useful KPI group is:

- `homepage_search`
- `brands_search`
- `category_pill_click`
- `subcategory_pill_click`

These explain intent and what users are trying to find.

## Important note

GA4 will not backfill historical data. Reports become meaningful from the moment this tracking is live and users start generating events.

Clarity remains useful for:

- heatmaps
- recordings
- qualitative UX review

GA4 + Looker Studio should be the main reporting layer.
