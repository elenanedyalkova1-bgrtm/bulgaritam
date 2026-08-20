import { baserowUrl } from "./baserow-url";

const clean = (v: unknown) => (v == null ? "" : String(v).trim());

export type BrandRow = {
  id: number;
  brand_slug: string;
  brand_name: string;
  intro_bg?: string;
  website_url?: string;
  brand_logo_url?: string;
  instagram_url?: string;
  address_bg?: string;
  city_bg?: string;
  oblast_bg?: string;
  latitude?: number | null;
  longitude?: number | null;
  delivers_abroad?: boolean;
  meta_title_bg?: string;
  meta_desc_bg?: string;
};

const BASEROW_API_TOKEN = import.meta.env.BASEROW_API_TOKEN;
const BRANDS_TABLE_ID = import.meta.env.BASEROW_BRANDS_TABLE_ID || "1133942";

export async function loadBrands(): Promise<BrandRow[]> {
  if (!BASEROW_API_TOKEN) throw new Error("Missing BASEROW_API_TOKEN env var");
  const rows: any[] = [];
  let nextUrl: string | null = `https://api.baserow.io/api/database/rows/table/${BRANDS_TABLE_ID}/?user_field_names=true&size=200`;
  while (nextUrl) {
    const response = await fetch(baserowUrl(nextUrl), { headers: { Authorization: `Token ${BASEROW_API_TOKEN}` } });
    if (!response.ok) throw new Error(`Failed to fetch Baserow Brands: ${response.status} ${response.statusText}`);
    const data = await response.json();
    rows.push(...(data.results || []));
    nextUrl = data.next || null;
  }

  return rows
    .filter((row) => row.is_active === true && clean(row.brand_slug) && clean(row.brand_name))
    .map((row) => ({
      id: Number(row.id),
      brand_slug: clean(row.brand_slug),
      brand_name: clean(row.brand_name),
      intro_bg: clean(row.description_bg),
      website_url: clean(row.brand_url),
      brand_logo_url: clean(row.logo_url),
      instagram_url: clean(row.instagram_url),
      address_bg: clean(row.address),
      city_bg: "",
      oblast_bg: "",
      latitude: null,
      longitude: null,
      delivers_abroad: false,
      meta_title_bg: "",
      meta_desc_bg: "",
    }))
    .sort((a, b) => a.brand_name.localeCompare(b.brand_name, "bg"));
}
