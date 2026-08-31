import { BRANDS_TABLE, createRow, listRows } from "./baserow";

const clean = (value: unknown) => String(value ?? "").trim();
export const foldBrandIdentity = (value: unknown) => clean(value)
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("bg")
  .replace(/[^\p{L}\p{N}]+/gu, "");
export const validBrandSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
export const placeholderBrandName = (value: string) => !value || /^(unknown|brand|n\/a|няма|без бранд)$/i.test(value);

export type BrandIdentity = {
  preferredBrandId?: number;
  brandName?: string;
  brandSlug?: string;
  brandUrl?: string;
  descriptionBg?: string;
  logoUrl?: string;
  instagramUrl?: string;
  address?: string;
};

export type BrandResolution =
  | { status: "resolved"; brand: any }
  | { status: "missing"; key: string; fields: Record<string, unknown> }
  | { status: "ambiguous"; candidates: any[]; message: string }
  | { status: "unresolved"; message: string };

export function brandSeed(identity: BrandIdentity) {
  return {
    brand_name: clean(identity.brandName),
    brand_slug: clean(identity.brandSlug),
    brand_url: clean(identity.brandUrl),
    description_bg: clean(identity.descriptionBg),
    logo_url: clean(identity.logoUrl),
    instagram_url: clean(identity.instagramUrl),
    address: clean(identity.address),
    is_active: true,
  };
}

export function resolveBrandIdentity(brands: any[], identity: BrandIdentity): BrandResolution {
  const preferredId = Number(identity.preferredBrandId || 0);
  if (preferredId) {
    const preferred = brands.find((brand) => Number(brand.id) === preferredId);
    return preferred
      ? { status: "resolved", brand: preferred }
      : { status: "unresolved", message: `Selected Brand ${preferredId} does not exist.` };
  }
  const name = clean(identity.brandName);
  const slug = clean(identity.brandSlug);
  const nameKey = foldBrandIdentity(name);
  const slugKey = foldBrandIdentity(slug);
  const candidates = [...new Map(brands.filter((brand) =>
    (nameKey && foldBrandIdentity(brand.brand_name) === nameKey) ||
    (slugKey && foldBrandIdentity(brand.brand_slug) === slugKey)
  ).map((brand) => [Number(brand.id), brand])).values()];
  if (candidates.length === 1) return { status: "resolved", brand: candidates[0] };
  if (candidates.length > 1) return { status: "ambiguous", candidates, message: `Ambiguous Brand identity: ${name || slug}` };
  if (placeholderBrandName(name) || !validBrandSlug(slug)) {
    return { status: "unresolved", message: "Brand name and a valid brand slug are required." };
  }
  return { status: "missing", key: nameKey, fields: brandSeed(identity) };
}

export async function resolveOrCreateBrand(identity: BrandIdentity, fixture?: { brands?: any[]; create?: (fields: Record<string, unknown>) => Promise<any> }) {
  const initial = fixture?.brands || await listRows(BRANDS_TABLE);
  const resolution = resolveBrandIdentity(initial, identity);
  if (resolution.status === "resolved") return resolution.brand;
  if (resolution.status !== "missing") throw new Error(resolution.message);

  // Recheck immediately before creation so repeated/sequential runs are idempotent.
  const latest = fixture?.brands || await listRows(BRANDS_TABLE);
  const refreshed = resolveBrandIdentity(latest, identity);
  if (refreshed.status === "resolved") return refreshed.brand;
  if (refreshed.status !== "missing") throw new Error(refreshed.message);
  return fixture?.create ? fixture.create(refreshed.fields) : createRow(BRANDS_TABLE, refreshed.fields);
}

export function productBrandIdentity(product: any): BrandIdentity {
  return {
    preferredBrandId: Number(product.brand_ref?.[0]?.id || 0) || undefined,
    brandName: product.brand_name,
    brandSlug: product.brand_slug,
    brandUrl: product.brand_url,
    descriptionBg: product.intro_bg,
    address: product.address,
  };
}

export function brandMirrorFields(brand: any) {
  return {
    brand_ref: [brand.id],
    brand_name: brand.brand_name || "",
    brand_slug: brand.brand_slug || "",
    brand_url: brand.brand_url || "",
    intro_bg: brand.description_bg || "",
    address: brand.address || "",
  };
}
