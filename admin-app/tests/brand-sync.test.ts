import assert from "node:assert/strict";
import { brandMirrorFields, resolveBrandIdentity, resolveOrCreateBrand } from "../src/lib/brand-sync";

const known = { id: 10, brand_name: "Átelier & Co.", brand_slug: "atelier-co", brand_url: "https://atelier.example" };
assert.equal(resolveBrandIdentity([known], { brandName: "ATELIER CO", brandSlug: "atelier-company" }).status, "resolved", "case/accent/punctuation and harmless slug variation reuse the Brand");
assert.equal(resolveBrandIdentity([known], { preferredBrandId: 10 }).status, "resolved", "selected existing Brand is reused");

const created: any[] = [];
const create = async (fields: Record<string, unknown>) => {
  const brand = { id: 20 + created.length, ...fields };
  created.push(brand);
  return brand;
};
const first = await resolveOrCreateBrand({ brandName: "New Brand", brandSlug: "new-brand" }, { brands: created, create });
const second = await resolveOrCreateBrand({ brandName: "new-brand", brandSlug: "new-brand-shop" }, { brands: created, create });
assert.equal(created.length, 1, "several Products and repeated repair runs create one Brand");
assert.equal(first.id, second.id, "the created Brand is shared");
assert.deepEqual(brandMirrorFields(first).brand_ref, [first.id], "repair fields link Product through brand_ref");

const conflicting = resolveBrandIdentity([
  { id: 31, brand_name: "Conflict", brand_slug: "first" },
  { id: 32, brand_name: "Conflict", brand_slug: "second" },
], { brandName: "Conflict", brandSlug: "conflict" });
assert.equal(conflicting.status, "ambiguous", "conflicting identities require review");
console.log("Brand sync tests passed.");
