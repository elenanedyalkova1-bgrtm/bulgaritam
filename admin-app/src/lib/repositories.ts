import { BRANDS_TABLE, PRODUCTS_TABLE, createRow, getRow, listFields, listRows, updateRow } from "./baserow";

export const productFields = ["name_bg","slug","category","subcategory","product_type","tags","price_min_eur","price_max_eur","currency","short_desc_bg","long_desc_bg","product_url","image_urls","created_at","meta_title_bg","meta_desc_bg","rating"] as const;
export const brandFields = ["brand_name","brand_slug","brand_url","description_bg","instagram_url","logo_url","address"] as const;
const text = (value: FormDataEntryValue | null) => String(value ?? "").trim();
const isProductActive = (value: unknown) => ["true","1","yes","y"].includes(String(value ?? "").trim().toLowerCase());

export async function listProducts() { return listRows(PRODUCTS_TABLE); }
export async function listBrands() { return listRows(BRANDS_TABLE); }
export async function findProduct(id: number) { return getRow(PRODUCTS_TABLE, id); }
export async function findBrand(id: number) { return getRow(BRANDS_TABLE, id); }
export async function getProductFieldSchema() { return listFields(PRODUCTS_TABLE); }

export function validateCsrf(form: FormData, expected: string) {
  if (!expected || text(form.get("csrf")) !== expected) throw new Error("Invalid CSRF token");
}

function validateSlug(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Slug must contain lowercase Latin letters, numbers and hyphens only.");
}
function validateUrl(value: string, label: string, required = false) {
  if (!value && !required) return;
  try { const url = new URL(value); if (!["http:","https:"].includes(url.protocol)) throw new Error(); }
  catch { throw new Error(`${label} must be a valid http(s) URL.`); }
}

export async function saveProduct(form: FormData, rowId?: number) {
  const values = Object.fromEntries(productFields.map((field) => [field, text(form.get(field))]));
  if (!values.name_bg) throw new Error("Product name is required.");
  validateSlug(values.slug);
  validateUrl(values.product_url, "Product URL", true);
  const brandId = Number(text(form.get("brand_ref")));
  if (!brandId) throw new Error("Brand is required.");
  const [products, brand, schema] = await Promise.all([listProducts(), findBrand(brandId), getProductFieldSchema()]);
  if (products.some((row) => row.id !== rowId && String(row.slug).trim() === values.slug)) throw new Error("A Product with this slug already exists.");
  if (!brand?.brand_slug || !brand?.brand_name) throw new Error("Selected Brand is invalid.");
  const fields: Record<string, unknown> = {
    ...values,
    brand_ref: [brandId],
    is_active: form.get("is_active") === "true" ? "true" : "false",
    // Compatibility mirrors. Brand editing never reads from these fields.
    brand_name: brand.brand_name,
    brand_slug: brand.brand_slug,
    brand_url: brand.brand_url || "",
    intro_bg: brand.description_bg || "",
    address: brand.address || "",
  };
  const optionIds = (fieldName: string, submitted: string[]) => {
    const field = schema.find((item: any) => item.name === fieldName);
    if (!field) throw new Error(`Baserow field ${fieldName} is missing.`);
    return submitted.map((value) => field.select_options?.find((option: any) => option.value === value)?.id).filter(Number.isFinite);
  };
  fields.subcategory = optionIds("subcategory", [values.subcategory])[0] || null;
  fields.product_type = optionIds("product_type", [values.product_type])[0] || null;
  fields.giftable = form.get("giftable") === "true";
  fields.recipient = optionIds("recipient", form.getAll("recipient").map(text));
  fields.gift_occasion = optionIds("gift_occasion", form.getAll("gift_occasion").map(text));
  fields.attributes = optionIds("attributes", form.getAll("attributes").map(text));
  if (!rowId) {
    const legacyIds = products.map((row) => Number(row["id 2"])).filter(Number.isFinite);
    fields["id 2"] = String(Math.max(0, ...legacyIds) + 1);
    if (!values.created_at) fields.created_at = new Date().toISOString();
  }
  const saved = rowId ? await updateRow(PRODUCTS_TABLE, rowId, fields) : await createRow(PRODUCTS_TABLE, fields);
  const verified = await findProduct(saved.id);
  if (Number(verified.brand_ref?.[0]?.id) !== brandId) throw new Error("Product saved, but Brand link verification failed.");
  return verified;
}

export async function saveBrand(form: FormData, rowId?: number) {
  const values = Object.fromEntries(brandFields.map((field) => [field, text(form.get(field))]));
  if (!values.brand_name) throw new Error("Brand name is required.");
  validateSlug(values.brand_slug);
  validateUrl(values.brand_url, "Brand URL");
  validateUrl(values.instagram_url, "Instagram URL");
  validateUrl(values.logo_url, "Logo URL");
  const brands = await listBrands();
  if (brands.some((row) => row.id !== rowId && String(row.brand_slug || "").trim() === values.brand_slug)) throw new Error("A Brand with this slug already exists.");
  const fields = { ...values, is_active: form.get("is_active") === "true" };
  const saved = rowId ? await updateRow(BRANDS_TABLE, rowId, fields) : await createRow(BRANDS_TABLE, fields);
  return findBrand(saved.id);
}

export async function setProductVisibility(id: number, visible: boolean) { await updateRow(PRODUCTS_TABLE, id, { is_active: visible ? "true" : "false" }); return findProduct(id); }
export async function setBrandVisibility(id: number, visible: boolean) { await updateRow(BRANDS_TABLE, id, { is_active: visible }); return findBrand(id); }
export { isProductActive };
