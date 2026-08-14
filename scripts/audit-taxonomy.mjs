const BASEROW_API_TOKEN = process.env.BASEROW_API_TOKEN;
const BASEROW_TABLE_ID = process.env.BASEROW_TABLE_ID || "906650";

if (!BASEROW_API_TOKEN) {
  console.error("Missing BASEROW_API_TOKEN");
  process.exit(1);
}

const split = (value) =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const num = (value) => {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const clean = (value) => String(value ?? "").trim();

const truthy = (value) =>
  ["true", "1", "yes", "y"].includes(String(value ?? "").trim().toLowerCase());

const tableUrl = `https://api.baserow.io/api/database/rows/table/${BASEROW_TABLE_ID}/?user_field_names=true&size=200`;

const { getTaxonomyForProduct } = await import("../src/lib/taxonomy.ts");
const { getGiftMeta } = await import("../src/lib/gifts.ts");
const {
  getClothingTypeMatches,
  WOMEN_CLOTHING_TYPE_OPTIONS,
  MEN_CLOTHING_TYPE_OPTIONS,
} = await import("../src/lib/clothing-types.ts");

async function fetchAllRows() {
  const rows = [];
  let next = tableUrl;

  while (next) {
    const response = await fetch(next, {
      headers: {
        Authorization: `Token ${BASEROW_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Baserow rows: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    rows.push(...(data.results || []));
    next = data.next || null;
  }

  return rows;
}

function mapRow(row) {
  const tags = split(row.tags);
  return {
    id: clean(row["id 2"] || row.id),
    slug: clean(row.slug),
    name_bg: clean(row.name_bg),
    brand_name: clean(row.brand_name),
    category: clean(row.category),
    tags,
    short_desc_bg: clean(row.short_desc_bg),
    long_desc_bg: clean(row.long_desc_bg),
    price_min_eur: num(row.price_min_eur),
    price_max_eur: num(row.price_max_eur),
    currency: clean(row.currency) || "EUR",
    created_at: clean(row.created_at),
    brand_slug: clean(row.brand_slug),
    image_urls: split(row.image_urls),
    product_url: clean(row.product_url),
    delivers_abroad: truthy(row.delivers_abroad) || truthy(row.ships_abroad) || truthy(row.delivery_abroad),
    ...getGiftMeta({ tags }),
  };
}

function compact(product) {
  return {
    slug: product.slug,
    name: product.name_bg,
    category: product.category,
    tags: product.tags,
  };
}

const rows = await fetchAllRows();
const products = rows.map(mapRow).filter((product) => product.slug && product.name_bg);

const enriched = products.map((product) => {
  const taxonomy = getTaxonomyForProduct(product);
  const womenTypes = getClothingTypeMatches(product, WOMEN_CLOTHING_TYPE_OPTIONS);
  const menTypes = getClothingTypeMatches(product, MEN_CLOTHING_TYPE_OPTIONS);

  return {
    ...product,
    taxonomy,
    womenTypes,
    menTypes,
  };
});

const report = {
  clothingWomen: enriched
    .filter((product) => product.taxonomy.subcategoryKeys.includes("clothing_women"))
    .map((product) => ({ ...compact(product), subs: product.taxonomy.subcategoryKeys })),
  clothingMen: enriched
    .filter((product) => product.taxonomy.subcategoryKeys.includes("clothing_men"))
    .map((product) => ({ ...compact(product), subs: product.taxonomy.subcategoryKeys })),
  dualGenderClothing: enriched
    .filter(
      (product) =>
        product.taxonomy.subcategoryKeys.includes("clothing_women") &&
        product.taxonomy.subcategoryKeys.includes("clothing_men")
    )
    .map((product) => ({ ...compact(product), subs: product.taxonomy.subcategoryKeys })),
  dresses: enriched
    .filter((product) => product.womenTypes.includes("dresses") || product.menTypes.includes("dresses"))
    .map((product) => ({
      ...compact(product),
      womenTypes: product.womenTypes,
      menTypes: product.menTypes,
      subs: product.taxonomy.subcategoryKeys,
    })),
  kidsClothing: enriched
    .filter((product) => product.taxonomy.subcategoryKeys.includes("kids_clothing"))
    .map((product) => ({ ...compact(product), subs: product.taxonomy.subcategoryKeys, cat: product.taxonomy.categoryKey })),
  kidsBooks: enriched
    .filter((product) => product.taxonomy.subcategoryKeys.includes("kids_books"))
    .map((product) => ({ ...compact(product), subs: product.taxonomy.subcategoryKeys, cat: product.taxonomy.categoryKey })),
  kidsToys: enriched
    .filter((product) => product.taxonomy.subcategoryKeys.includes("kids_toys"))
    .map((product) => ({ ...compact(product), subs: product.taxonomy.subcategoryKeys, cat: product.taxonomy.categoryKey })),
  kidsCosmetics: enriched
    .filter((product) => product.taxonomy.subcategoryKeys.includes("kids_cosmetics"))
    .map((product) => ({ ...compact(product), subs: product.taxonomy.subcategoryKeys, cat: product.taxonomy.categoryKey })),
  kidsFurnitureTextiles: enriched
    .filter((product) => product.taxonomy.subcategoryKeys.includes("kids_furniture_textiles"))
    .map((product) => ({ ...compact(product), subs: product.taxonomy.subcategoryKeys, cat: product.taxonomy.categoryKey })),
  homeTextiles: enriched
    .filter((product) => product.taxonomy.subcategoryKeys.includes("home_textiles"))
    .map((product) => ({ ...compact(product), subs: product.taxonomy.subcategoryKeys, cat: product.taxonomy.categoryKey })),
  giftsChild: enriched
    .filter((product) => product.taxonomy.subcategoryKeys.includes("gifts_for_child"))
    .map((product) => ({ ...compact(product), giftTargets: product.gift_targets, subs: product.taxonomy.subcategoryKeys })),
  giftsBaby: enriched
    .filter((product) => product.taxonomy.subcategoryKeys.includes("gifts_for_baby"))
    .map((product) => ({ ...compact(product), giftTargets: product.gift_targets, subs: product.taxonomy.subcategoryKeys })),
  giftsWedding: enriched
    .filter((product) => product.taxonomy.subcategoryKeys.includes("gifts_for_wedding"))
    .map((product) => ({ ...compact(product), giftTargets: product.gift_targets, subs: product.taxonomy.subcategoryKeys })),
};

console.log(JSON.stringify(report, null, 2));
