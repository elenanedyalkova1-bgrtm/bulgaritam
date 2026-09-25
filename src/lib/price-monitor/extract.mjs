import { decodeHtml, normalizeCurrency, parsePrice, pricesEqual } from "./normalize.mjs";

function attributes(tag) {
  const out = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    out[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return out;
}

function types(node) {
  const value = node?.["@type"];
  return (Array.isArray(value) ? value : [value]).filter(Boolean).map((item) => String(item).toLowerCase());
}

function allObjects(value, path = "$", seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  const rows = [{ node: value, path }];
  if (Array.isArray(value)) value.forEach((item, index) => rows.push(...allObjects(item, `${path}[${index}]`, seen)));
  else Object.entries(value).forEach(([key, item]) => rows.push(...allObjects(item, `${path}.${key}`, seen)));
  return rows;
}

function sameUrl(a, b) {
  try {
    const aa = new URL(a); const bb = new URL(b);
    return aa.hostname === bb.hostname && aa.pathname.replace(/\/$/, "") === bb.pathname.replace(/\/$/, "");
  } catch { return false; }
}

function canonicalUrl(html) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if ((attrs.rel || "").toLowerCase().split(/\s+/).includes("canonical")) return attrs.href || "";
  }
  return "";
}

function pageTitle(html) {
  return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function productScore(node, context) {
  let score = 0;
  const nodeUrl = node.url || node["@id"] || node.mainEntityOfPage;
  const url = typeof nodeUrl === "object" ? nodeUrl?.["@id"] || nodeUrl?.url : nodeUrl;
  if (url && (sameUrl(url, context.url) || sameUrl(url, context.canonical))) score += 100;
  if (node.mainEntityOfPage === true) score += 60;
  if (typeof node.mainEntityOfPage === "object" && sameUrl(node.mainEntityOfPage?.["@id"], context.url)) score += 60;
  const name = String(node.name || "").trim().toLowerCase();
  if (name && context.title.toLowerCase().includes(name)) score += 25;
  if (node.offers) score += 10;
  return score;
}

function regularPair(current, regular, method, evidence = null) {
  const currentPrice = parsePrice(current?.price);
  const regularPrice = parsePrice(regular?.price);
  const currentCurrency = normalizeCurrency(current?.currency);
  const regularCurrency = normalizeCurrency(regular?.currency);
  if (currentPrice == null || regularPrice == null || regularPrice <= currentPrice) return {};
  if (!currentCurrency || !regularCurrency || currentCurrency !== regularCurrency) return {};
  return {
    regular_price: regularPrice,
    regular_price_currency: regularCurrency,
    regular_price_method: method,
    regular_price_evidence: evidence,
  };
}

function regularFields(value) {
  if (value?.regular_price == null) return {};
  return {
    regular_price: value.regular_price,
    regular_price_currency: value.regular_price_currency,
    regular_price_method: value.regular_price_method,
    regular_price_evidence: value.regular_price_evidence,
  };
}

function enrichRegularPrice(selected, enrichment) {
  if (!selected || selected.price == null || selected.regular_price != null || enrichment?.regular_price == null) return selected;
  if (!pricesEqual(parsePrice(selected.price), parsePrice(enrichment.price))) return selected;
  const selectedCurrency = normalizeCurrency(selected.currency); const enrichmentCurrency = normalizeCurrency(enrichment.currency);
  if (!selectedCurrency || !enrichmentCurrency || selectedCurrency !== enrichmentCurrency) return selected;
  return { ...selected, ...regularFields(enrichment) };
}

function explicitListPrice(specification) {
  const entries = (Array.isArray(specification) ? specification : [specification]).filter((item) => item && typeof item === "object");
  return entries.find((item) => /(?:list|regular|original|was|strikethrough)[-_ ]?price/i.test(String(item.priceType || item.name || ""))) || null;
}

function offerCandidates(offers, path) {
  const entries = (Array.isArray(offers) ? offers : [offers]).filter((item) => item && typeof item === "object");
  const result = [];
  let nonExact = false;
  for (let index = 0; index < entries.length; index += 1) {
    const offer = entries[index];
    const offerPath = `${path}.offers${Array.isArray(offers) ? `[${index}]` : ""}`;
    if (offer.lowPrice != null || offer.highPrice != null || types(offer).includes("aggregateoffer")) nonExact = true;
    const rawPrice = offer.price ?? offer.priceSpecification?.price;
    const price = parsePrice(rawPrice);
    const currency = normalizeCurrency(offer.priceCurrency ?? offer.priceSpecification?.priceCurrency);
    if (price != null) {
      const candidate = { price, currency, path: `${offerPath}${offer.price != null ? ".price" : ".priceSpecification.price"}` };
      if (offer.price != null) {
        const listPrice = explicitListPrice(offer.priceSpecification);
        Object.assign(candidate, regularPair(
          candidate,
          { price: listPrice?.price, currency: listPrice?.priceCurrency ?? offer.priceCurrency },
          "json_ld_list_price",
          listPrice ? { path: `${offerPath}.priceSpecification.price`, price_type: listPrice.priceType || listPrice.name } : null,
        ));
      }
      result.push(candidate);
    }
  }
  return { result, nonExact };
}

function chooseExact(candidates, method, tier, confidence) {
  if (!candidates.length) return null;
  const prices = new Set(candidates.map((item) => item.price));
  const knownCurrencies = new Set(candidates.map((item) => item.currency).filter(Boolean));
  const compatibleMissingCurrency = prices.size === 1 && knownCurrencies.size === 1;
  const normalized = compatibleMissingCurrency
    ? candidates.map((item) => ({ ...item, currency: item.currency || [...knownCurrencies][0] }))
    : candidates;
  const unique = new Map(normalized.map((item) => [`${item.price}|${item.currency || ""}`, item]));
  if (unique.size !== 1) return { status: "ambiguous", reason: "multiple_distinct_current_prices", evidence: candidates.slice(0, 8) };
  const value = [...unique.values()][0];
  const pairs = new Map(candidates
    .filter((item) => item.regular_price != null)
    .map((item) => [`${item.regular_price}|${item.regular_price_currency || ""}`, item]));
  const pair = pairs.size === 1 && candidates.every((item) => item.regular_price != null) ? [...pairs.values()][0] : null;
  return {
    price: value.price, currency: value.currency, tier, method, confidence,
    evidence: { path: value.path, candidate_count: candidates.length },
    ...(pair ? {
      regular_price: pair.regular_price,
      regular_price_currency: pair.regular_price_currency,
      regular_price_method: pair.regular_price_method,
      regular_price_evidence: pair.regular_price_evidence,
    } : {}),
  };
}

function textPrice(value, path) {
  const text = decodeHtml(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const price = parsePrice(text); const currency = normalizeCurrency(text.match(/EUR|BGN|USD|GBP|€|лв\.?|£|\$/i)?.[0]);
  return price != null && currency ? { price, currency, path } : null;
}

function validatedDualCurrencyPrice(value, path) {
  const text = decodeHtml(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const pairs = [...text.matchAll(/([0-9][0-9\s.,]*)\s*(EUR|BGN|€|лв\.?)/gi)].map((match) => ({
    price: parsePrice(match[1]), currency: normalizeCurrency(match[2]),
  })).filter((item) => item.price != null && item.currency);
  const eur = pairs.filter((item) => item.currency === "EUR"); const bgn = pairs.filter((item) => item.currency === "BGN");
  if (eur.length !== 1 || bgn.length !== 1 || Math.abs((eur[0].price * 1.95583) - bgn[0].price) > 0.03) return null;
  return { price: eur[0].price, currency: "EUR", path, evidence: { dual_currency: true, displayed_bgn: bgn[0].price } };
}

function parseJsonLd(html) {
  const parsed = []; const errors = [];
  let index = 0;
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json(?:;[^"']*)?["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = decodeHtml(match[1]).trim();
    try { parsed.push({ value: JSON.parse(raw), block: index }); }
    catch (error) { errors.push({ block: index, error: String(error?.message || error) }); }
    index += 1;
  }
  return { parsed, errors, count: index };
}

function extractJsonLd(html, context) {
  const blocks = parseJsonLd(html);
  const products = [];
  for (const block of blocks.parsed) {
    for (const entry of allObjects(block.value, `$jsonld[${block.block}]`)) {
      if (types(entry.node).includes("product")) products.push({ ...entry, score: productScore(entry.node, context) });
    }
  }
  if (!products.length) return { result: null, diagnostics: { json_ld_blocks: blocks.count, malformed_json_ld: blocks.errors } };
  products.sort((a, b) => b.score - a.score);
  const topScore = products[0].score;
  const main = products.filter((item) => item.score === topScore);
  if (main.length > 1 && topScore < 100) {
    return { result: { status: "ambiguous", reason: "multiple_product_entities_no_unique_main", evidence: main.slice(0, 5).map((x) => ({ path: x.path, name: x.node.name, score: x.score })) }, diagnostics: { json_ld_blocks: blocks.count, malformed_json_ld: blocks.errors } };
  }
  const selected = main[0];
  const offers = offerCandidates(selected.node.offers, selected.path);
  if (offers.nonExact && !offers.result.length) {
    return { result: { status: "ambiguous", reason: "price_range_or_aggregate_offer", evidence: { path: `${selected.path}.offers` } }, diagnostics: { json_ld_blocks: blocks.count, malformed_json_ld: blocks.errors } };
  }
  return { result: chooseExact(offers.result, "json_ld_product_offer", 1, "high"), diagnostics: { json_ld_blocks: blocks.count, malformed_json_ld: blocks.errors, selected_product: { path: selected.path, score: selected.score, name: selected.node.name } } };
}

function extractMeta(html) {
  const values = new Map();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const key = String(attrs.property || attrs.name || attrs.itemprop || "").toLowerCase();
    if (key) values.set(key, attrs.content || attrs.value || "");
  }
  const amount = values.get("product:price:amount") || values.get("og:price:amount");
  const currency = values.get("product:price:currency") || values.get("og:price:currency");
  const price = parsePrice(amount);
  if (price != null) return { price, currency: normalizeCurrency(currency), tier: 2, method: "open_graph_product_price", confidence: "high", evidence: { property: values.has("product:price:amount") ? "product:price:amount" : "og:price:amount" } };

  const itemPrices = []; const currencies = [];
  for (const match of html.matchAll(/<(?:meta|data|span|div)\b[^>]*itemprop\s*=\s*["'](?:price|priceCurrency)["'][^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const prop = attrs.itemprop?.toLowerCase(); const value = attrs.content || attrs.value || "";
    if (prop === "price") { const parsed = parsePrice(value); if (parsed != null) itemPrices.push(parsed); }
    if (prop === "pricecurrency") currencies.push(normalizeCurrency(value));
  }
  for (const match of html.matchAll(/<(span|data|div)\b([^>]*)itemprop\s*=\s*["'](?:price|priceCurrency)["']([^>]*)>([\s\S]{0,160}?)<\/\1>/gi)) {
    const attrs = attributes(match[0].slice(0, match[0].indexOf(">") + 1));
    const prop = attrs.itemprop?.toLowerCase();
    const text = decodeHtml(match[4]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const value = attrs.content || attrs.value || text;
    if (prop === "price") { const parsed = parsePrice(value); if (parsed != null) itemPrices.push(parsed); }
    if (prop === "pricecurrency") currencies.push(normalizeCurrency(value));
  }
  const uniquePrices = [...new Set(itemPrices)];
  if (uniquePrices.length > 1) return { status: "ambiguous", reason: "multiple_microdata_prices", evidence: uniquePrices };
  if (uniquePrices.length === 1) return { price: uniquePrices[0], currency: currencies.find(Boolean) || null, tier: 2, method: "schema_microdata_price", confidence: "high", evidence: { itemprop: "price" } };
  return null;
}

function extractEmbedded(html, context) {
  const candidates = [];
  let block = 0;
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const value = JSON.parse(decodeHtml(match[1]).trim());
      for (const entry of allObjects(value, `$application_json[${block}]`)) {
        const node = entry.node;
        if (Array.isArray(node) || !node || typeof node !== "object") continue;
        const productLike = types(node).includes("product") || /product/i.test(String(node.type || node.kind || node.__typename || "")) || (node.name && (node.url || node.slug || node.sku));
        const relatedToMain = productLike && (!node.url || sameUrl(node.url, context.url) || context.title.toLowerCase().includes(String(node.name || "").toLowerCase()));
        if (!relatedToMain) continue;
        const raw = node.price ?? node.currentPrice ?? node.salePrice;
        const price = parsePrice(typeof raw === "object" ? raw.amount ?? raw.value : raw);
        const currency = normalizeCurrency(node.currency ?? node.priceCurrency ?? (typeof raw === "object" ? raw.currency : null));
        if (price != null) candidates.push({ price, currency, path: `${entry.path}.${node.price != null ? "price" : node.currentPrice != null ? "currentPrice" : "salePrice"}` });
      }
    } catch { /* malformed application state is ignored */ }
    block += 1;
  }
  return chooseExact(candidates, "embedded_product_json", 3, "medium");
}

function selectedVariantId(url) {
  try { return new URL(url).searchParams.get("variant"); } catch { return null; }
}

function jsonObjectsContainingVariants(script) {
  const objects = [];
  for (const marker of script.matchAll(/["']variants["']\s*:/gi)) {
    for (let start = script.lastIndexOf("{", marker.index); start >= 0; start = script.lastIndexOf("{", start - 1)) {
      let depth = 0; let quote = ""; let escaped = false;
      for (let index = start; index < script.length; index += 1) {
        const char = script[index];
        if (quote) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === quote) quote = "";
          continue;
        }
        if (char === '"' || char === "'") { quote = char; continue; }
        if (char === "{") depth += 1;
        if (char !== "}") continue;
        depth -= 1;
        if (depth !== 0) continue;
        try {
          const value = JSON.parse(script.slice(start, index + 1));
          if (Array.isArray(value?.variants)) objects.push(value);
        } catch { /* only strict JSON product objects are accepted */ }
        break;
      }
      if (objects.length) break;
    }
  }
  return objects;
}

function easyBundleProduct(script) {
  if (!/window\.easybundle_active_product_data\s*=/.test(script)) return null;
  const field = (name) => script.match(new RegExp(`(?:^|[,\\s])${name}\\s*:\\s*([^,}]+)`, "i"))?.[1]?.trim();
  const bool = (name) => field(name) === "true" ? true : field(name) === "false" ? false : null;
  const price = parsePrice(field("price")); const priceMin = parsePrice(field("price_min")); const priceMax = parsePrice(field("price_max"));
  const compareAt = parsePrice(field("compare_at_price")); const compareMin = parsePrice(field("compare_at_price_min")); const compareMax = parsePrice(field("compare_at_price_max"));
  if (bool("price_varies") !== false || bool("compare_at_price_varies") !== false) return null;
  if (![priceMin, priceMax].every((value) => value != null && value === price)) return null;
  if (![compareMin, compareMax].every((value) => value != null && value === compareAt)) return null;
  const currency = normalizeCurrency(script.match(/["']currency["']\s*:\s*["']([A-Za-z]{3})["']/i)?.[1]);
  return { variants: [{ id: null, available: true, price, compare_at_price: compareAt }], currency, _source: "easybundle_active_product_data" };
}

function shopifyProductNodes(html) {
  const nodes = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = attributes(`<script ${match[1]}>`); const script = decodeHtml(match[2]).trim();
    if (/(?:productjson|product-json|product-template|product-data)/i.test(`${attrs.id || ""} ${attrs.class || ""} ${attrs["data-product-json"] || ""}`)) {
      try {
        const parsed = JSON.parse(script); const node = parsed.product || parsed;
        if (Array.isArray(node?.variants)) nodes.push({ ...node, _source: attrs.id || "product-json" });
      } catch { /* malformed identified product JSON is ignored */ }
    }
    for (const node of jsonObjectsContainingVariants(script)) nodes.push({ ...node, _source: attrs.id || "embedded_product_state" });
    const easyBundle = easyBundleProduct(script); if (easyBundle) nodes.push(easyBundle);
  }
  return nodes;
}

function shopifyRegularEnrichment(html, context, selected) {
  const variantId = selectedVariantId(context.url);
  const pairs = [];
  for (const node of shopifyProductNodes(html)) {
    const rawVariants = node.variants.filter((item) => item && item.available !== false && item.is_purchasable !== false);
    const rawPrices = rawVariants.map((item) => parsePrice(item.price)).filter((value) => value != null);
    if (!rawVariants.length || rawPrices.length !== rawVariants.length) continue;
    const divisor = rawPrices.every((value) => Number.isInteger(value) && value >= 1000) ? 100 : 1;
    const currency = normalizeCurrency(node.currency || node.priceCurrency || node.currency_code) || selected.currency;
    if (!currency || currency !== normalizeCurrency(selected.currency)) continue;
    const variants = rawVariants.map((item) => ({
      id: item.id == null ? null : String(item.id), price: parsePrice(item.price) / divisor,
      compare: parsePrice(item.compare_at_price ?? item.compareAtPrice), source: node._source,
    })).map((item) => ({ ...item, compare: item.compare == null ? null : item.compare / divisor }));
    let chosen = null; let decision = "all_purchasable_variants_same_pair";
    if (variantId) {
      const exact = variants.filter((item) => item.id === String(variantId));
      if (exact.length !== 1) continue;
      chosen = exact[0]; decision = "url_selected_variant";
    } else {
      const uniquePairs = new Set(variants.map((item) => `${item.price}|${item.compare ?? ""}`));
      if (uniquePairs.size !== 1 || variants.some((item) => item.compare == null)) continue;
      chosen = variants[0];
    }
    if (chosen.compare == null || chosen.compare <= chosen.price || !pricesEqual(chosen.price, selected.price)) continue;
    pairs.push({
      price: chosen.price, currency,
      ...regularPair(
        { price: chosen.price, currency }, { price: chosen.compare, currency },
        "shopify_compare_at_price_enrichment",
        { source: chosen.source, path: "shopify.variants.compare_at_price", decision, variant_id: variantId || null },
      ),
    });
  }
  const unique = new Map(pairs.filter((item) => item.regular_price != null)
    .map((item) => [`${item.price}|${item.currency}|${item.regular_price}|${item.regular_price_currency}`, item]));
  return unique.size === 1 ? [...unique.values()][0] : null;
}

function extractPlatformAdapter(html, platform) {
  if (platform === "shopify") {
    const candidates = [];
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const attrs = attributes(`<script ${match[1]}>`);
      if (!/(?:productjson|product-json|product-template|product-data)/i.test(`${attrs.id || ""} ${attrs.class || ""} ${attrs["data-product-json"] || ""}`)) continue;
      try {
        const parsed = JSON.parse(decodeHtml(match[2]).trim());
        const node = parsed.product || parsed;
        const currency = normalizeCurrency(node.currency || node.priceCurrency || node.currency_code);
        const variants = Array.isArray(node.variants) ? node.variants.filter((item) => item?.available !== false) : [];
        const prices = variants.map((item) => parsePrice(item.price)).filter((item) => item != null);
        const divisor = prices.length && prices.every((item) => Number.isInteger(item) && item >= 1000) ? 100 : 1;
        for (const item of variants) {
          const price = parsePrice(item.price);
          if (price == null) continue;
          const candidate = { price: price / divisor, currency, path: `shopify.${attrs.id || "product-json"}.variants.price` };
          const compareAt = parsePrice(item.compare_at_price ?? item.compareAtPrice);
          Object.assign(candidate, regularPair(
            candidate,
            { price: compareAt == null ? null : compareAt / divisor, currency },
            "shopify_compare_at_price",
            { path: `shopify.${attrs.id || "product-json"}.variants.compare_at_price`, variant_id: item.id ?? null },
          ));
          candidates.push(candidate);
        }
        if (!prices.length) {
          const price = parsePrice(node.price);
          if (price != null && (node.price_min == null || node.price_max == null || parsePrice(node.price_min) === parsePrice(node.price_max))) {
            const divisor = Number.isInteger(price) && price >= 1000 ? 100 : 1;
            const candidate = { price: price / divisor, currency, path: `shopify.${attrs.id || "product-json"}.price` };
            const compareAt = parsePrice(node.compare_at_price ?? node.compareAtPrice);
            Object.assign(candidate, regularPair(
              candidate,
              { price: compareAt == null ? null : compareAt / divisor, currency },
              "shopify_compare_at_price",
              { path: `shopify.${attrs.id || "product-json"}.compare_at_price`, variant_id: null },
            ));
            candidates.push(candidate);
          }
        }
      } catch { /* adapter only accepts valid deterministic JSON */ }
    }
    return chooseExact(candidates, "shopify_product_json", 4, "medium");
  }

  if (platform === "woocommerce") {
    const candidates = [];
    for (const match of html.matchAll(/<form\b[^>]*class=["'][^"']*variations_form[^"']*["'][^>]*>/gi)) {
      const attrs = attributes(match[0]);
      if (!attrs["data-product_variations"]) continue;
      try {
        const variations = JSON.parse(attrs["data-product_variations"]);
        for (const item of variations) {
          if (item?.variation_is_active === false || item?.is_purchasable === false) continue;
          const price = parsePrice(item.display_price ?? item.display_regular_price);
          if (price != null) {
            const currency = normalizeCurrency(item.currency || item.price_currency);
            const candidate = { price, currency, path: "woocommerce.variations_form.display_price" };
            Object.assign(candidate, regularPair(
              candidate,
              { price: item.display_regular_price, currency },
              "woocommerce_variation_regular_sale",
              { path: "woocommerce.variations_form.display_regular_price", variation_id: item.variation_id ?? null },
            ));
            candidates.push(candidate);
          }
        }
      } catch { /* malformed variation data is never guessed */ }
    }
    for (const match of html.matchAll(/<(?:form|div)\b[^>]*data-product_price=["']([^"']+)["'][^>]*>/gi)) {
      const price = parsePrice(match[1]);
      if (price != null) candidates.push({ price, currency: null, path: "woocommerce.data-product_price" });
    }
    const rootStart = html.search(/<div\b[^>]*id=["']product-\d+["'][^>]*class=["'][^"']*\bproduct\b[^"']*["'][^>]*>/i);
    if (rootStart >= 0) {
      const productRegion = html.slice(rootStart, rootStart + 80_000);
      const priceBlock = productRegion.match(/<(?:p|div)\b[^>]*class=["'][^"']*\bprice\b[^"']*["'][^>]*>([\s\S]{0,1800}?)<\/(?:p|div)>/i)?.[1];
      if (priceBlock) {
        const activeBlock = priceBlock.match(/<ins\b[^>]*>([\s\S]*?)<\/ins>/i)?.[1] || priceBlock.replace(/<del\b[^>]*>[\s\S]*?<\/del>/gi, " ");
        const amounts = [];
        for (const amountMatch of activeBlock.matchAll(/<[^>]*class=["'][^"']*woocommerce-Price-amount[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)) {
          const text = decodeHtml(amountMatch[1]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          const price = parsePrice(text); const currency = normalizeCurrency(text.match(/EUR|BGN|USD|GBP|€|лв\.?|£|\$/i)?.[0]);
          if (price != null) amounts.push({ price, currency, path: "woocommerce.main_product.price" });
        }
        if (!amounts.length) {
          const plain = textPrice(activeBlock, "woocommerce.main_product.price_text");
          if (plain) amounts.push(plain);
        }
        const regularBlock = priceBlock.match(/<del\b[^>]*>([\s\S]*?)<\/del>/i)?.[1] || "";
        const regularAmounts = [];
        for (const amountMatch of regularBlock.matchAll(/<[^>]*class=["'][^"']*woocommerce-Price-amount[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)) {
          const text = decodeHtml(amountMatch[1]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          const price = parsePrice(text); const currency = normalizeCurrency(text.match(/EUR|BGN|USD|GBP|€|лв\.?|£|\$/i)?.[0]);
          if (price != null) regularAmounts.push({ price, currency });
        }
        if (amounts.length) {
          const uniqueRegular = new Map(regularAmounts.map((item) => [`${item.price}|${item.currency || ""}`, item]));
          const regular = uniqueRegular.size === 1 ? [...uniqueRegular.values()][0] : null;
          for (const amount of amounts) {
            Object.assign(amount, regularPair(amount, regular, "woocommerce_del_ins", { path: "woocommerce.main_product.price.del" }));
            candidates.push(amount);
          }
        }
      }
    }
    for (const match of html.matchAll(/<div\b[^>]*class=["'][^"']*\bav-woo-purchase-button\b[^"']*["'][^>]*>([\s\S]{0,2400}?)<\/div>/gi)) {
      const priceBlock = match[1].match(/<p\b[^>]*class=["'][^"']*\bprice\b[^"']*["'][^>]*>([\s\S]{0,800}?)<\/p>/i)?.[1];
      if (!priceBlock) continue;
      const activeBlock = priceBlock.match(/<ins\b[^>]*>([\s\S]*?)<\/ins>/i)?.[1] || priceBlock.replace(/<del\b[^>]*>[\s\S]*?<\/del>/gi, " ");
      const amount = textPrice(activeBlock, "woocommerce.purchase_button.price");
      if (amount) candidates.push(amount);
    }
    return chooseExact(candidates, "woocommerce_product_data", 4, "medium");
  }
  return null;
}

function extractProvenDomainProductPrice(html, context) {
  let hostname = "";
  try { hostname = new URL(context.url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
  const candidates = [];
  if (hostname === "borianasport.com") {
    for (const match of html.matchAll(/<div\b[^>]*class=["'][^"']*\bprice-wrapper\b[^"']*["'][^>]*>([\s\S]{0,4000}?)<\/div>/gi)) {
      const current = textPrice(match[1].match(/<span\b[^>]*class=["'][^"']*\bprice-new\b[^"']*["'][^>]*>([\s\S]{0,160}?)<\/span>/i)?.[1], "borianasport.product.price-new");
      if (!current) continue;
      const regular = textPrice(match[1].match(/<span\b[^>]*class=["'][^"']*\bprice-old\b[^"']*["'][^>]*>([\s\S]{0,160}?)<\/span>/i)?.[1], "borianasport.product.price-old");
      Object.assign(current, regularPair(current, regular, "borianasport_old_current_pair", { path: "borianasport.product.price-old" }));
      candidates.push(current);
    }
  } else if (hostname === "astogold.bg") {
    for (const match of html.matchAll(/<p\b[^>]*class=["'][^"']*\bproduct__price\b[^"']*["'][^>]*>([\s\S]{0,300}?)<\/p>/gi)) {
      const current = validatedDualCurrencyPrice(match[1], "astogold.product__price"); if (current) candidates.push(current);
    }
  } else if (hostname === "art-tochka.com") {
    for (const match of html.matchAll(/<div\b[^>]*class=["'][^"']*\bregular-price\b[^"']*["'][^>]*id=["']priceHolder["'][^>]*>([\s\S]{0,300}?)<\/div>/gi)) {
      const current = validatedDualCurrencyPrice(match[1], "art_tochka.product.priceHolder"); if (current) candidates.push(current);
    }
  } else if (hostname === "gil.bg") {
    for (const match of html.matchAll(/<ul\b[^>]*class=["'][^"']*\bprice\b[^"']*["'][^>]*>([\s\S]{0,800}?)<\/ul>/gi)) {
      const current = textPrice(match[1].match(/<span\b[^>]*class=["'][^"']*\blive-price\b[^"']*["'][^>]*>([\s\S]{0,160}?)(?:<\/span>|<span>)/i)?.[1], "gil.product.live-price");
      if (current) candidates.push(current);
    }
  } else if (hostname === "gabi-jewellery.com") {
    for (const match of html.matchAll(/<span\b[^>]*id=["']product-price["'][^>]*class=["'][^"']*\bproduct-price\b[^"']*["'][^>]*>([\s\S]{0,160}?)<\/span>/gi)) {
      const current = textPrice(match[1], "gabi_jewellery.product-price"); if (current) candidates.push(current);
    }
  } else if (hostname === "sito-studio.com") {
    for (const match of html.matchAll(/<div\b[^>]*class=["'][^"']*\bproduct_cta_wrap\b[^"']*["'][^>]*>[\s\S]{0,5000}?<div\b[^>]*data-wf-sku-bindings=["'][^"']*f_price_[^"']*["'][^>]*class=["'][^"']*\bprice--[^"']*["'][^>]*>([\s\S]{0,160}?)<\/div>[\s\S]{0,5000}?<form\b[^>]*data-node-type=["']commerce-add-to-cart-form["']/gi)) {
      const current = textPrice(match[1], "sito_studio.product_cta.webflow_sku_price"); if (current) candidates.push(current);
    }
  }
  return chooseExact(candidates, `domain_product_price_${hostname.replace(/[^a-z0-9]+/g, "_")}`, 4, "medium");
}

function extractStrongDomainProductPrice(html, context, jsonLdResult) {
  let hostname = "";
  try { hostname = new URL(context.url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
  const structuredPrice = parsePrice(jsonLdResult?.price);
  const structuredCurrency = normalizeCurrency(jsonLdResult?.currency);

  if (hostname === "ballhole.bg") {
    const candidates = [];
    for (const match of html.matchAll(/<p\b[^>]*class=["'][^"']*\bprice\b[^"']*["'][^>]*>([\s\S]{0,800}?)<\/p>[\s\S]{0,1800}?<form\b[^>]*class=["'][^"']*\bvariations_form\b[^"']*["'][^>]*>/gi)) {
      const current = validatedDualCurrencyPrice(match[1], "ballhole.main_product.price");
      if (!current || structuredCurrency !== "BGN" || !pricesEqual(structuredPrice, current.evidence?.displayed_bgn)) continue;
      const attrs = attributes(match[0].slice(match[0].lastIndexOf("<form")));
      if (!attrs["data-product_variations"]) continue;
      try {
        const variations = JSON.parse(attrs["data-product_variations"]);
        const active = variations.filter((item) => item?.variation_is_active !== false && item?.is_purchasable !== false);
        const prices = active.map((item) => parsePrice(item.display_price)).filter((value) => value != null);
        if (!active.length || prices.length !== active.length || prices.some((price) => !pricesEqual(price, current.evidence.displayed_bgn))) continue;
        candidates.push({ ...current, evidence: { ...current.evidence, relationship: "main_product_price_before_variation_cart", all_purchasable_variants_same_price: true } });
      } catch { /* malformed variation data cannot establish an exact price */ }
    }
    return chooseExact(candidates, "domain_purchase_price_ballhole_bg", 2, "high");
  }

  if (hostname === "cavalerbg.com") {
    const candidates = [];
    for (const match of html.matchAll(/<div\b[^>]*class=["'][^"']*\bproduct-price\b[^"']*["'][^>]*>[\s\S]{0,300}?<div\b[^>]*class=["'][^"']*\bnew\b[^"']*["'][^>]*>([\s\S]{0,260}?)<\/div>[\s\S]{0,1100}?<button\b[^>]*(?:data-ng-click=["']addToCart\(|class=["'][^"']*\bproductbuybtn\b)[^>]*>/gi)) {
      if (/\b(?:from|от)\b/i.test(decodeHtml(match[1]))) continue;
      const visible = textPrice(match[1], "cavaler.main_product.purchase_price");
      if (!visible || visible.currency !== "EUR" || structuredCurrency !== "BGN" || !pricesEqual(visible.price, structuredPrice)) continue;
      candidates.push({ ...visible, evidence: { relationship: "quantity_price_buy_control", corroborating_structured_amount: structuredPrice, rejected_structured_currency: structuredCurrency } });
    }
    return chooseExact(candidates, "domain_purchase_price_cavalerbg_com", 2, "high");
  }

  return null;
}

function semanticPairFromRegion(region, source) {
  const pairs = [];
  const directPair = /<(div|p|section)\b[^>]*class=["'][^"']*\bprice-group\b[^"']*["'][^>]*>\s*<(?:div|span|p)\b[^>]*class=["'][^"']*\bproduct-price-new\b[^"']*["'][^>]*>([\s\S]{0,160}?)<\/(?:div|span|p)>\s*<(?:div|span|p)\b[^>]*class=["'][^"']*\bproduct-price-old\b[^"']*["'][^>]*>([\s\S]{0,160}?)<\/(?:div|span|p)>\s*<\/\1>/gi;
  for (const match of region.matchAll(directPair)) {
    const currentText = decodeHtml(match[2]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const regularText = decodeHtml(match[3]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const current = {
      price: parsePrice(currentText), currency: normalizeCurrency(currentText.match(/EUR|BGN|USD|GBP|€|лв\.?|£|\$/i)?.[0]),
      path: `${source}.price-group.product-price-new`,
    };
    Object.assign(current, regularPair(
      current,
      { price: parsePrice(regularText), currency: normalizeCurrency(regularText.match(/EUR|BGN|USD|GBP|€|лв\.?|£|\$/i)?.[0]) },
      "semantic_colocated_old_current_pair",
      { path: `${source}.price-group.product-price-old`, container: "price-group", relationship: "direct_siblings" },
    ));
    if (current.price != null && current.regular_price != null) pairs.push(current);
  }
  return pairs;
}

function extractCoLocatedSemanticPair(html) {
  const candidates = [];
  const main = html.match(/<(?:main|article)\b[^>]*(?:itemtype\s*=\s*["'][^"']*Product|class\s*=\s*["'][^"']*(?:product-detail|product-page|single-product)[^"']*)[^>]*>([\s\S]*?)<\/(?:main|article)>/i)?.[1];
  if (main) candidates.push(...semanticPairFromRegion(main, "dom.authoritative_product_region"));
  for (const wrapper of html.matchAll(/<div\b[^>]*class=["'][^"']*\bproduct-price-group\b[^"']*["'][^>]*>/gi)) {
    candidates.push(...semanticPairFromRegion(html.slice(wrapper.index, wrapper.index + 2_000), "dom.product-price-group"));
  }
  return chooseExact(candidates, "semantic_current_price_dom", 5, "low");
}

function extractSafeDom(html) {
  const main = html.match(/<(?:main|article)\b[^>]*(?:itemtype\s*=\s*["'][^"']*Product|class\s*=\s*["'][^"']*(?:product-detail|product-page|single-product)[^"']*)[^>]*>([\s\S]*?)<\/(?:main|article)>/i)?.[1];
  if (!main) return null;
  const snippets = [];
  for (const container of main.matchAll(/<(div|p)\b([^>]*)class\s*=\s*["'][^"']*(?:product[-_ ]?price|price[-_ ]?container|prices)[^"']*["']([^>]*)>([\s\S]{0,1200}?)<\/\1>/gi)) {
    const body = container[4];
    const oldMatch = body.match(/<[^>]*class=["'][^"']*(?:old[-_ ]?price|regular[-_ ]?price|price[-_ ]?old)[^"']*["'][^>]*>([\s\S]{0,240}?)<\/[^>]+>/i);
    const currentMatch = body.match(/<[^>]*class=["'][^"']*(?:current[-_ ]?price|sale[-_ ]?price|price[-_ ]?new|new[-_ ]?price)[^"']*["'][^>]*>([\s\S]{0,240}?)<\/[^>]+>/i);
    if (!oldMatch || !currentMatch) continue;
    const currentText = decodeHtml(currentMatch[1]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const regularText = decodeHtml(oldMatch[1]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const current = { price: parsePrice(currentText), currency: normalizeCurrency(currentText.match(/EUR|BGN|USD|GBP|€|лв\.?|£|\$/i)?.[0]), path: "dom.semantic_product_price.current" };
    if (current.price == null || /\b(?:from|от)\b/i.test(currentText)) continue;
    Object.assign(current, regularPair(
      current,
      { price: parsePrice(regularText), currency: normalizeCurrency(regularText.match(/EUR|BGN|USD|GBP|€|лв\.?|£|\$/i)?.[0]) },
      "semantic_old_current_pair",
      { path: "dom.semantic_product_price.old" },
    ));
    snippets.push(current);
  }
  for (const match of main.matchAll(/<(del|s|ins|span|div|p)\b([^>]*)>([\s\S]{0,300}?)<\/\1>/gi)) {
    const attrs = attributes(`<x ${match[2]}>`); const semantic = `${attrs.class || ""} ${attrs.id || ""}`.toLowerCase();
    if (!/(?:current|sale|special|final)[-_ ]?price/.test(semantic)) continue;
    if (/(?:installment|monthly|month|leasing)/.test(semantic)) continue;
    const text = decodeHtml(match[3]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (/\b(?:from|от)\b/i.test(text)) return { status: "ambiguous", reason: "from_price" };
    const price = parsePrice(text); const currency = normalizeCurrency(text.match(/EUR|BGN|USD|GBP|€|лв\.?|£|\$/i)?.[0]);
    if (price != null && !snippets.some((item) => item.regular_price != null && item.price === price && item.currency === currency)) {
      snippets.push({ price, currency, path: `dom.${semantic.trim().replace(/\s+/g, ".")}` });
    }
  }
  return chooseExact(snippets, "semantic_current_price_dom", 5, "low");
}

function browserEvidence(html) {
  const text = html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const appShell = /<(?:div|main)[^>]+id=["'](?:app|root|__next|__nuxt)["']/i.test(html);
  const scripts = (html.match(/<script\b/gi) || []).length;
  return (appShell && text.length < 600) || (scripts >= 8 && text.length < 300);
}

export function extractPrice(html, { url = "", platform = "unknown" } = {}) {
  const context = { url, canonical: canonicalUrl(html), title: pageTitle(html) };
  const diagnostics = (details = {}) => ({ ...details, page_identity: { canonical: context.canonical || null, title: context.title || null } });
  const finish = (selected) => {
    if (!selected || selected.price == null || selected.regular_price != null) return selected;
    let enriched = selected;
    if (platform === "shopify") enriched = enrichRegularPrice(enriched, shopifyRegularEnrichment(html, context, enriched));
    enriched = enrichRegularPrice(enriched, extractCoLocatedSemanticPair(html));
    return enriched;
  };
  const jsonLd = extractJsonLd(html, context);
  const strongDomain = extractStrongDomainProductPrice(html, context, jsonLd.result);
  if (strongDomain?.price != null) return { ...finish(strongDomain), diagnostics: diagnostics(jsonLd.diagnostics) };
  if (strongDomain?.status) return { ...strongDomain, diagnostics: diagnostics(jsonLd.diagnostics) };
  if (jsonLd.result?.price != null) return { ...finish(jsonLd.result), diagnostics: diagnostics(jsonLd.diagnostics) };
  const meta = extractMeta(html);
  if (meta?.price != null) return { ...finish(meta), diagnostics: diagnostics(jsonLd.diagnostics) };
  if (meta?.status) return { ...meta, diagnostics: diagnostics(jsonLd.diagnostics) };
  const embedded = extractEmbedded(html, context);
  if (embedded?.price != null) return { ...finish(embedded), diagnostics: diagnostics(jsonLd.diagnostics) };
  if (embedded?.status) return { ...embedded, diagnostics: diagnostics(jsonLd.diagnostics) };
  const adapter = extractPlatformAdapter(html, platform);
  if (adapter?.price != null) return { ...finish(adapter), diagnostics: diagnostics(jsonLd.diagnostics) };
  if (adapter?.status) return { ...adapter, diagnostics: diagnostics(jsonLd.diagnostics) };
  const provenDomain = extractProvenDomainProductPrice(html, context);
  if (provenDomain?.price != null) return { ...finish(provenDomain), diagnostics: diagnostics(jsonLd.diagnostics) };
  if (provenDomain?.status) return { ...provenDomain, diagnostics: diagnostics(jsonLd.diagnostics) };
  const colocated = extractCoLocatedSemanticPair(html);
  if (colocated?.price != null) return { ...colocated, diagnostics: diagnostics(jsonLd.diagnostics) };
  const dom = extractSafeDom(html);
  if (dom) return { ...dom, diagnostics: diagnostics(jsonLd.diagnostics) };
  if (jsonLd.result?.status === "ambiguous") return { ...jsonLd.result, diagnostics: diagnostics(jsonLd.diagnostics) };
  if (browserEvidence(html)) return { status: "browser_required", reason: "javascript_rendered_product_shell", diagnostics: diagnostics(jsonLd.diagnostics) };
  return { status: "not_detected", reason: jsonLd.diagnostics.malformed_json_ld?.length ? "malformed_json_ld_and_no_fallback" : "no_reliable_exact_price", diagnostics: diagnostics(jsonLd.diagnostics) };
}
