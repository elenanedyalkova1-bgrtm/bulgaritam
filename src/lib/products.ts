// src/lib/products.ts

import { getGiftMeta, type GiftTarget } from "./gifts";
import { baserowUrl } from "./baserow-url";
import fs from "node:fs";

export type Product = {
  id: string;
  row_id: number;
  brand_id: number | null;

  name_bg: string;
  brand_name: string;
  slug: string;

  category: string;
  tags: string[];
  subcategory: string;
  product_type: string;
  recipient: string[];
  gift_occasion: string[];
  attributes: string[];
  audience: string[];
  colors: string[];
  materials: string[];
  giftable: boolean;
  gift_targets: GiftTarget[];
  gift_match_score: number;

  price_min_eur: number | null;
  price_max_eur: number | null;
  currency: string;

  short_desc_bg: string;
  long_desc_bg: string;

  product_url: string;
  brand_url: string;

  image_urls: string[];

  is_active: boolean;
  created_at: string;
  curation_score: number | null;
  editorial_score: number | null;
  ranking_score: number | null;

  brand_slug: string;
  intro_bg: string;
  website_url: string;
  brand_logo_url: string;
  instagram_url: string;
  address_bg: string;
  city_bg: string;
  oblast_bg: string;
  latitude: number | null;
  longitude: number | null;
  delivers_abroad: boolean;

  meta_title_bg: string;
  meta_desc_bg: string;
};

const BASEROW_API_TOKEN = import.meta.env.BASEROW_API_TOKEN;
const BASEROW_TABLE_ID = import.meta.env.BASEROW_TABLE_ID || "906650";
const BASEROW_API_URL = `https://api.baserow.io/api/database/rows/table/${BASEROW_TABLE_ID}/?user_field_names=true&size=200`;

function healthExcludedSlugs() {
  const reportPath = import.meta.env.PRODUCT_HEALTH_REPORT_PATH;
  if (!reportPath) return new Set<string>();
  try {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    return new Set<string>((report.confirmed_broken_image_products || []).map((item: any) => String(item.slug || "").trim()).filter(Boolean));
  } catch (error) {
    throw new Error(`Product health report could not be read: ${error instanceof Error ? error.message : error}`);
  }
}

function norm(value: unknown): string {
  return String(value ?? "").trim();
}

function toBool(value: unknown): boolean {
  const t = norm(value).toLowerCase();
  return t === "true" || t === "1" || t === "yes" || t === "y";
}

function toNum(value: unknown): number | null {
  const t = norm(value).replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function splitList(value: unknown): string[] {
  return norm(value)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

type BaserowRow = {
  id?: number;
  ["id 2"]?: string;
  name_bg?: string;
  brand_name?: string;
  slug?: string;
  category?: string;
  tags?: string;
  subcategory?: { value?: string } | string;
  product_type?: { value?: string } | string;
  giftable?: boolean;
  recipient?: Array<{ value?: string }>;
  gift_occasion?: Array<{ value?: string }>;
  attributes?: Array<{ value?: string }>;
  audience?: Array<{ value?: string }>;
  colors?: Array<{ value?: string }>;
  materials?: Array<{ value?: string }>;
  price_min_eur?: string;
  price_max_eur?: string;
  currency?: string;
  short_desc_bg?: string;
  long_desc_bg?: string;
  product_url?: string;
  brand_url?: string;
  image_urls?: string;
  is_active?: string;
  created_at?: string;
  curation_score?: string;
  editorial_score?: string;
  ranking_score?: string;
  score?: string;
  brand_slug?: string;
  intro_bg?: string;
  website_url?: string;
  brand_logo_url?: string;
  instagram_url?: string;
  address_bg?: string;
  city_bg?: string;
  oblast_bg?: string;
  latitude?: string;
  longitude?: string;
  delivers_abroad?: string;
  ships_abroad?: string;
  delivery_abroad?: string;
  meta_title_bg?: string;
  meta_desc_bg?: string;
  brand_ref?: Array<{ id?: number; value?: string }>;
};

type BaserowBrandRow = {
  id?: number;
  brand_name?: string;
  brand_slug?: string;
  brand_url?: string;
  description_bg?: string;
  logo_url?: string;
  instagram_url?: string;
  address?: string;
  is_active?: boolean;
};

function parseRow(row: BaserowRow, brand?: BaserowBrandRow): Product | null {
  const id = norm(row["id 2"] || row.id);
  const slug = norm(row.slug);
  const name_bg = norm(row.name_bg);
  const tags = splitList(row.tags);

  if (!id || !slug || !name_bg) return null;

  const is_active =
    row.is_active === undefined || norm(row.is_active) === ""
      ? true
      : toBool(row.is_active);

  const legacyGiftMeta = getGiftMeta({ tags });
  const structuredGiftable = row.giftable === true;
  const selectValue = (value: BaserowRow["subcategory"]) =>
    norm(typeof value === "object" && value !== null ? value.value : value);
  const multiSelectValues = (value: Array<{ value?: string }> | undefined) =>
    Array.isArray(value) ? value.map((item) => norm(item?.value)).filter(Boolean) : [];

  return {
    ...legacyGiftMeta,
    id,
    row_id: Number(row.id),
    brand_id: Number(brand?.id) || null,
    name_bg,
    brand_name: norm(brand?.brand_name) || norm(row.brand_name),
    slug,

    category: norm(row.category),
    tags,
    subcategory: selectValue(row.subcategory),
    product_type: selectValue(row.product_type),
    recipient: [...new Set([...multiSelectValues(row.recipient), ...multiSelectValues(row.audience)])],
    gift_occasion: multiSelectValues(row.gift_occasion),
    attributes: multiSelectValues(row.attributes),
    audience: multiSelectValues(row.audience),
    colors: multiSelectValues(row.colors),
    materials: multiSelectValues(row.materials),
    giftable: structuredGiftable || (!row.subcategory && legacyGiftMeta.giftable),

    price_min_eur: toNum(row.price_min_eur),
    price_max_eur: toNum(row.price_max_eur),
    currency: norm(row.currency) || "EUR",

    short_desc_bg: norm(row.short_desc_bg),
    long_desc_bg: norm(row.long_desc_bg),

    product_url: norm(row.product_url),
    brand_url: norm(brand?.brand_url) || norm(row.brand_url),

    image_urls: splitList(row.image_urls),

    is_active,
    created_at: norm(row.created_at),
    curation_score: toNum(row.curation_score),
    editorial_score: toNum(row.editorial_score),
    ranking_score: toNum(row.ranking_score ?? row.score),

    brand_slug: norm(brand?.brand_slug) || norm(row.brand_slug),
    intro_bg: norm(brand?.description_bg) || norm(row.intro_bg),
    website_url: norm(brand?.brand_url) || norm(row.website_url) || norm(row.brand_url),
    brand_logo_url: norm(brand?.logo_url) || norm(row.brand_logo_url),
    instagram_url: norm(brand?.instagram_url) || norm(row.instagram_url),
    address_bg: norm(brand?.address) || norm(row.address_bg),
    city_bg: norm(row.city_bg),
    oblast_bg: norm(row.oblast_bg),
    latitude: toNum(row.latitude),
    longitude: toNum(row.longitude),
    delivers_abroad: toBool(row.delivers_abroad) || toBool(row.ships_abroad) || toBool(row.delivery_abroad),

    meta_title_bg: norm(row.meta_title_bg),
    meta_desc_bg: norm(row.meta_desc_bg),
  };
}

async function fetchAllRows(): Promise<BaserowRow[]> {
  if (!BASEROW_API_TOKEN) {
    throw new Error("Missing BASEROW_API_TOKEN env var");
  }

  const rows: BaserowRow[] = [];
  let nextUrl: string | null = BASEROW_API_URL;

  while (nextUrl) {
    const res = await fetch(baserowUrl(nextUrl), {
      headers: {
        Authorization: `Token ${BASEROW_API_TOKEN}`,
      },
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

async function fetchAllBrandRows(): Promise<BaserowBrandRow[]> {
  const tableId = import.meta.env.BASEROW_BRANDS_TABLE_ID || "1133942";
  const rows: BaserowBrandRow[] = [];
  let nextUrl: string | null = `https://api.baserow.io/api/database/rows/table/${tableId}/?user_field_names=true&size=200`;

  while (nextUrl) {
    const res = await fetch(baserowUrl(nextUrl), { headers: { Authorization: `Token ${BASEROW_API_TOKEN}` } });
    if (!res.ok) throw new Error(`Failed to fetch Baserow Brands: ${res.status} ${res.statusText}`);
    const data = await res.json();
    rows.push(...(data.results || []));
    nextUrl = data.next || null;
  }
  return rows;
}

export async function loadProducts(): Promise<Product[]> {
  const [rows, brandRows] = await Promise.all([fetchAllRows(), fetchAllBrandRows()]);
  const brandsById = new Map(brandRows.map((brand) => [Number(brand.id), brand]));
  const brandsBySlug = new Map(brandRows.filter((brand) => norm(brand.brand_slug)).map((brand) => [norm(brand.brand_slug), brand]));

  const excludedSlugs = healthExcludedSlugs();
  const products = rows
    .map((row) => {
      const brandId = Number(row.brand_ref?.[0]?.id);
      const brand = brandsById.get(brandId) || brandsBySlug.get(norm(row.brand_slug));
      if (!brand || brand.is_active !== true || !String(row.image_urls || "").trim() || excludedSlugs.has(String(row.slug || "").trim())) return null;
      return parseRow(row, brand);
    })
    .filter((p): p is Product => Boolean(p && p.is_active));

  products.sort((a, b) => {
    const ad = a.created_at ? Date.parse(a.created_at) : 0;
    const bd = b.created_at ? Date.parse(b.created_at) : 0;
    if (ad && bd && ad !== bd) return bd - ad;
    return a.name_bg.localeCompare(b.name_bg, "bg");
  });

  return products;
}
