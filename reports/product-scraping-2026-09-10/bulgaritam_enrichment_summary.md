# Bulgaritam product scraping and enrichment

## Summary

- Total submitted rows: 393
- Unique submitted URLs: 392
- Exact duplicate input URLs: 1
- Successful product pages: 340
- Failed URLs: 52
- Distinct detected brands: 17
- Existing brands matched from the available local snapshot: 0
- New brands requiring review: 17
- HIGH-confidence taxonomy classifications: 279
- MEDIUM-confidence taxonomy classifications: 61
- LOW-confidence fields written: 0
- Successful rows requiring human review: 340
- Category coverage: 285/340
- Subcategory coverage: 285/340
- Product-type coverage: 279/340

## Failed domains

- galdini.net: 28 (HTTP_403)
- papinocosmetics.com: 24 (EMPTY_OR_BLOCK_PAGE)

## QA warning counts

- NEW_BRAND_REVIEW_REQUIRED: 340
- SOURCE_PRICE_NOT_MAPPED_TO_APPROXIMATE_RANGE: 254
- MISSING_MATERIALS: 131
- MISSING_PRODUCT_TYPE: 61
- MISSING_CATEGORY: 55
- MISSING_SUBCATEGORY: 55
- MISSING_IMAGES: 23
- BATCH_SLUG_COLLISION: 22
- MISSING_DESCRIPTION: 22
- EXACT_DUPLICATE_INPUT_URL: 1

## Brand resolution note

The configured Baserow credentials returned HTTP 401 during the read-only snapshot request. Resolution therefore used the available local product/brand exports. None of the 17 detected brands matched that local snapshot, so `brand_ref` and existing-only brand metadata remain blank and every brand is marked `NEW_BRAND_REVIEW_REQUIRED`.

## Price and content safety

- Source prices and currencies are preserved in `bulgaritam_source_evidence.csv`.
- `price_min_eur` and `price_max_eur` are blank because source offer prices are not equivalent to Bulgaritam's approximate ranges.
- `long_desc_bg` is blank because automated paraphrasing without individual editorial review would risk copying or unsupported filler.
- Short descriptions contain only the product name, detected brand, and explicitly supported normalized materials.
- SEO fields, rating, `created_at`, recipient and gift fields remain blank unless an explicit safe convention existed; no giftability was inferred.
- Product images come only from Product JSON-LD or the page's primary Open Graph image, not related-product widgets.

## Safety

No Baserow writes, imports, production changes, application-code changes, deployment, or push were performed.
