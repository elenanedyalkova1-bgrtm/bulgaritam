const BASEROW_API_TOKEN = process.env.BASEROW_API_TOKEN;
const BASEROW_TABLE_ID = process.env.BASEROW_TABLE_ID || "906650";
const BASEROW_API_URL = `https://api.baserow.io/api/database/rows/table/${BASEROW_TABLE_ID}/?user_field_names=true&size=200`;
const FETCH_HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; BulgaritamTagAudit/1.0; +https://bulgaritam.bg)",
  "accept-language": "bg,en;q=0.8",
};

if (!BASEROW_API_TOKEN) {
  console.error("Missing BASEROW_API_TOKEN env var");
  process.exit(1);
}

const norm = (value = "") =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[\/_,;:.!?()[\]{}"'`´’“”]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const splitList = (value = "") =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const corpusIncludes = (corpus, term) => {
  const normalizedTerm = norm(term);
  if (!normalizedTerm) return false;
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s|\\|)${escaped}(?=$|\\s|\\|)`).test(corpus);
};

const BIO_TERMS = [
  "био",
  "bio",
  "organic",
  "органик",
  "органичен",
  "натурален",
  "натурална",
  "natural",
];

const ECO_TERMS = [
  "еко",
  "eco",
  "sustainable",
  "устойчив",
  "устойчиво",
  "reusable",
  "многократ",
  "recyclable",
  "рециклируем",
  "биоразградим",
  "biodegradable",
  "zero waste",
  "plastic free",
];

const INGREDIENT_PATTERNS = [
  { label: "алое вера", terms: ["алое", "aloe", "aloe vera"] },
  { label: "роза", terms: ["роза", "rose"] },
  { label: "лайка", terms: ["лайка", "chamomile"] },
  { label: "невен", terms: ["невен", "calendula"] },
  { label: "лавандула", terms: ["лавандула", "lavender"] },
  { label: "мента", terms: ["мента", "mint"] },
  { label: "мача", terms: ["мача", "matcha"] },
  { label: "мед", terms: ["мед", "honey"] },
  { label: "пчелен восък", terms: ["пчелен восък", "beeswax"] },
  { label: "ший", terms: ["ший", "shea"] },
  { label: "кокос", terms: ["кокос", "coconut"] },
  { label: "арган", terms: ["арган", "argan"] },
  { label: "рицин", terms: ["рицин", "castor"] },
  { label: "хиалуронова киселина", terms: ["хиалурон", "hyaluronic"] },
  { label: "колаген", terms: ["колаген", "collagen"] },
  { label: "витамин c", terms: ["витамин c", "vitamin c"] },
  { label: "магнезий", terms: ["магнезий", "magnesium"] },
  { label: "цинк", terms: ["цинк", "zinc"] },
  { label: "пробиотик", terms: ["пробиот", "probiotic"] },
  { label: "билки", terms: ["билки", "herbs", "herbal"] },
];

const HERBAL_EXTRACT_PATTERNS = [
  { label: "тинктура", terms: ["тинктура", "tincture"] },
  { label: "екстракт", terms: ["екстракт", "extract"] },
  { label: "билки", terms: ["билки", "herbs", "herbal"] },
  { label: "розмарин", terms: ["розмарин", "rosemary"] },
  { label: "черен кимион", terms: ["черен кимион", "black seed", "black cumin"] },
  { label: "бял трън", terms: ["бял трън", "milk thistle"] },
  { label: "куркума", terms: ["куркума", "turmeric"] },
  { label: "каен пипер", terms: ["каен", "cayenne"] },
  { label: "боров прашец", terms: ["боров прашец", "pine pollen"] },
  { label: "конопено масло", terms: ["конопено масло", "hemp oil"] },
];

const MATERIAL_PATTERNS = [
  { label: "памук", terms: ["памук", "cotton"] },
  { label: "органичен памук", terms: ["органичен памук", "organic cotton"] },
  { label: "лен", terms: ["лен", "linen"] },
  { label: "вълна", terms: ["вълна", "wool"] },
  { label: "кожа", terms: ["кожа", "leather"] },
  { label: "сребро", terms: ["сребро", "sterling silver", "silver"] },
  { label: "сатен", terms: ["сатен", "satin"] },
  { label: "коприна", terms: ["коприна", "silk"] },
  { label: "бамбук", terms: ["бамбук", "bamboo"] },
  { label: "дърво", terms: ["дърво", "wooden", "wood"] },
  { label: "керамика", terms: ["керамика", "ceramic"] },
  { label: "соев восък", terms: ["соев", "soy wax", "soya wax"] },
];

const INGREDIENT_CATEGORY_HINTS = [
  "козметика",
  "здраве",
  "чай",
  "добавки",
  "supplement",
  "body",
  "face",
  "hair",
  "tea",
];

const HERBAL_CATEGORY_HINTS = [
  "здраве",
  "чай",
  "добавки",
  "екстракт",
  "тинктура",
  "supplement",
];

const MATERIAL_CATEGORY_HINTS = [
  "облекло",
  "аксесоари",
  "дом",
  "текстил",
  "бижута",
  "дом и интериор",
];

async function fetchAllRows() {
  const rows = [];
  let nextUrl = BASEROW_API_URL;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Token ${BASEROW_API_TOKEN}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Baserow rows: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    rows.push(...(data.results || []));
    nextUrl = data.next || null;
  }

  return rows;
}

function parseRow(row) {
  const tags = splitList(row.tags);
  const normalizedTags = tags.map(norm);
  const corpus = [
    row.name_bg,
    row.short_desc_bg,
    row.long_desc_bg,
    row.category,
    ...tags,
  ]
    .map(norm)
    .filter(Boolean)
    .join(" | ");

  return {
    id: String(row["id 2"] || row.id || "").trim(),
    slug: String(row.slug || "").trim(),
    name: String(row.name_bg || "").trim(),
    category: String(row.category || "").trim(),
    product_url: String(row.product_url || "").trim(),
    tags,
    normalizedTags,
    corpus,
  };
}

function hasBioTag(product) {
  return BIO_TERMS.some((term) => product.normalizedTags.some((tag) => tag === norm(term) || tag.includes(norm(term))));
}

function hasEcoTag(product) {
  return ECO_TERMS.some((term) => product.normalizedTags.some((tag) => tag === norm(term) || tag.includes(norm(term))));
}

function hasCategoryHint(product, terms) {
  return terms.some((term) => corpusIncludes(product.corpus, term));
}

function htmlToText(html = "") {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchProductPageText(url) {
  if (!/^https?:\/\//i.test(url)) return "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return "";
    const html = await res.text();
    return norm(htmlToText(html));
  } catch {
    return "";
  }
}

function collectSuggestions(product, patterns, remoteCorpus = "") {
  const combinedCorpus = [product.corpus, remoteCorpus].filter(Boolean).join(" | ");
  return patterns
    .map((pattern) => {
      const matchedTerms = pattern.terms.filter((term) => corpusIncludes(combinedCorpus, term));
      if (!matchedTerms.length) return null;
      if (product.normalizedTags.some((tag) => tag.includes(norm(pattern.label)))) return null;

      const remoteOnly = matchedTerms.every((term) => !corpusIncludes(product.corpus, term)) && remoteCorpus;
      return {
        label: pattern.label,
        evidence_terms: matchedTerms,
        source: remoteOnly ? "remote" : "local",
      };
    })
    .filter(Boolean)
    .slice(0, 6);
}

const rows = await fetchAllRows();
const products = rows
  .map(parseRow)
  .filter((product) => product.slug && product.name);

const candidateProducts = products.filter(
  (product) =>
    product.product_url &&
    (
      hasCategoryHint(product, INGREDIENT_CATEGORY_HINTS) ||
      hasCategoryHint(product, HERBAL_CATEGORY_HINTS) ||
      hasCategoryHint(product, MATERIAL_CATEGORY_HINTS)
    )
);

const remoteCorpusBySlug = new Map();
await Promise.all(
  candidateProducts.slice(0, 120).map(async (product) => {
    const text = await fetchProductPageText(product.product_url);
    if (text) remoteCorpusBySlug.set(product.slug, text);
  })
);

const likelyMissingBioTags = products
  .filter((product) => {
    const remoteCorpus = remoteCorpusBySlug.get(product.slug) || "";
    const combinedCorpus = [product.corpus, remoteCorpus].filter(Boolean).join(" | ");
    return BIO_TERMS.some((term) => corpusIncludes(combinedCorpus, term)) && !hasBioTag(product);
  })
  .map((product) => ({
    slug: product.slug,
    name: product.name,
    category: product.category,
    product_url: product.product_url,
    current_tags: product.tags,
    source: (remoteCorpusBySlug.get(product.slug) || "").length ? "local+remote" : "local",
  }))
  .slice(0, 40);

const likelyMissingEcoTags = products
  .filter((product) => {
    const remoteCorpus = remoteCorpusBySlug.get(product.slug) || "";
    const combinedCorpus = [product.corpus, remoteCorpus].filter(Boolean).join(" | ");
    return ECO_TERMS.some((term) => corpusIncludes(combinedCorpus, term)) && !hasEcoTag(product);
  })
  .map((product) => ({
    slug: product.slug,
    name: product.name,
    category: product.category,
    product_url: product.product_url,
    current_tags: product.tags,
    source: (remoteCorpusBySlug.get(product.slug) || "").length ? "local+remote" : "local",
  }))
  .slice(0, 40);

const likelyMissingIngredientTags = products
  .map((product) => ({
    slug: product.slug,
    name: product.name,
    category: product.category,
    product_url: product.product_url,
    current_tags: product.tags,
    suggested_ingredient_tags: collectSuggestions(
      product,
      INGREDIENT_PATTERNS,
      remoteCorpusBySlug.get(product.slug) || ""
    ),
  }))
  .filter(
    (product) =>
      product.suggested_ingredient_tags.length > 0 &&
      hasCategoryHint(product, INGREDIENT_CATEGORY_HINTS)
  )
  .slice(0, 80);

const likelyMissingHerbalExtractTags = products
  .map((product) => ({
    slug: product.slug,
    name: product.name,
    category: product.category,
    product_url: product.product_url,
    current_tags: product.tags,
    suggested_herbal_tags: collectSuggestions(
      product,
      HERBAL_EXTRACT_PATTERNS,
      remoteCorpusBySlug.get(product.slug) || ""
    ),
  }))
  .filter(
    (product) =>
      product.suggested_herbal_tags.length > 0 &&
      hasCategoryHint(product, HERBAL_CATEGORY_HINTS)
  )
  .slice(0, 80);

const likelyMissingMaterialTags = products
  .map((product) => ({
    slug: product.slug,
    name: product.name,
    category: product.category,
    product_url: product.product_url,
    current_tags: product.tags,
    suggested_material_tags: collectSuggestions(
      product,
      MATERIAL_PATTERNS,
      remoteCorpusBySlug.get(product.slug) || ""
    ),
  }))
  .filter(
    (product) =>
      product.suggested_material_tags.length > 0 &&
      hasCategoryHint(product, MATERIAL_CATEGORY_HINTS)
  )
  .slice(0, 80);

const summary = {
  total_products_checked: products.length,
  remote_pages_checked: remoteCorpusBySlug.size,
  likely_missing_bio_tags: likelyMissingBioTags.length,
  likely_missing_eco_tags: likelyMissingEcoTags.length,
  likely_missing_ingredient_tags: likelyMissingIngredientTags.length,
  likely_missing_herbal_extract_tags: likelyMissingHerbalExtractTags.length,
  likely_missing_material_tags: likelyMissingMaterialTags.length,
  likelyMissingBioTags,
  likelyMissingEcoTags,
  likelyMissingIngredientTags,
  likelyMissingHerbalExtractTags,
  likelyMissingMaterialTags,
};

console.log(JSON.stringify(summary, null, 2));
