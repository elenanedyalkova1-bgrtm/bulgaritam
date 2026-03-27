// src/lib/products.ts

export type Product = {
  id: string;

  name_bg: string;
  brand_name: string;
  slug: string;

  category: string;
  tags: string[];

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

  brand_slug: string;

  meta_title_bg: string;
  meta_desc_bg: string;
};

const BASEROW_API_TOKEN = import.meta.env.BASEROW_API_TOKEN;
const BASEROW_TABLE_ID = import.meta.env.BASEROW_TABLE_ID || "906650";
const BASEROW_API_URL = `https://api.baserow.io/api/database/rows/table/${BASEROW_TABLE_ID}/?user_field_names=true&size=200`;

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
  brand_slug?: string;
  meta_title_bg?: string;
  meta_desc_bg?: string;
};

function parseRow(row: BaserowRow): Product | null {
  const id = norm(row["id 2"] || row.id);
  const slug = norm(row.slug);
  const name_bg = norm(row.name_bg);

  if (!id || !slug || !name_bg) return null;

  const is_active =
    row.is_active === undefined || norm(row.is_active) === ""
      ? true
      : toBool(row.is_active);

  return {
    id,
    name_bg,
    brand_name: norm(row.brand_name),
    slug,

    category: norm(row.category),
    tags: splitList(row.tags),

    price_min_eur: toNum(row.price_min_eur),
    price_max_eur: toNum(row.price_max_eur),
    currency: norm(row.currency) || "EUR",

    short_desc_bg: norm(row.short_desc_bg),
    long_desc_bg: norm(row.long_desc_bg),

    product_url: norm(row.product_url),
    brand_url: norm(row.brand_url),

    image_urls: splitList(row.image_urls),

    is_active,
    created_at: norm(row.created_at),

    brand_slug: norm(row.brand_slug),

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
    const res = await fetch(nextUrl, {
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

export async function loadProducts(): Promise<Product[]> {
  const rows = await fetchAllRows();

  const products = rows
    .map(parseRow)
    .filter((p): p is Product => Boolean(p && p.is_active));

  products.sort((a, b) => {
    const ad = a.created_at ? Date.parse(a.created_at) : 0;
    const bd = b.created_at ? Date.parse(b.created_at) : 0;
    if (ad && bd && ad !== bd) return bd - ad;
    return a.name_bg.localeCompare(b.name_bg, "bg");
  });

  return products;
}
