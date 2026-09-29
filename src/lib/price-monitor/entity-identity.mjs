import { normalizeExternalProductUrl } from "./product-metadata.mjs";

export const ENTITY_TYPES = Object.freeze(["catalog_product", "observed_product"]);
export function entityIdentity(value = {}) {
  const entityType = ENTITY_TYPES.includes(value.entity_type) ? value.entity_type : "catalog_product";
  const entityId = String(value.entity_id ?? value.product_id ?? value.id ?? "").trim();
  return { entity_type: entityType, entity_id: entityId };
}
export const observedCanonicalKey = ({ brand_id, canonical_url, source_url }) => {
  const url = normalizeExternalProductUrl(canonical_url || source_url);
  return brand_id != null && url ? `${brand_id}|${url}` : null;
};
export function matchObservedToCatalog(observed, catalog) {
  const canonical = normalizeExternalProductUrl(observed.canonical_url);
  const source = normalizeExternalProductUrl(observed.source_url);
  const sameBrand = (row) => String(row.brand_id ?? row.brand_ref?.[0]?.id ?? "") === String(observed.brand_id ?? "");
  const byCanonical = catalog.find((row) => sameBrand(row) && canonical && normalizeExternalProductUrl(row.canonical_url || row.product_url) === canonical);
  if (byCanonical) return { product_id: byCanonical.id ?? byCanonical.product_id, method: "canonical_url" };
  const bySource = catalog.find((row) => sameBrand(row) && source && normalizeExternalProductUrl(row.product_url) === source);
  if (bySource) return { product_id: bySource.id ?? bySource.product_id, method: "source_url" };
  const externalId = String(observed.external_product_id || observed.sku || "").trim();
  if (!externalId) return null;
  const candidates = catalog.filter((row) => sameBrand(row) && [row.external_product_id, row.sku].some((v) => String(v || "").trim() === externalId));
  return candidates.length === 1 ? { product_id: candidates[0].id ?? candidates[0].product_id, method: "external_id_or_sku" } : null;
}
