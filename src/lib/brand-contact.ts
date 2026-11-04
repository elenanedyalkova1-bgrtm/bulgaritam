/** Contact values come from Brands, never inferred from an empty website. */
export type BrandContact = {
  no_site?: boolean;
  instagram_url?: string;
  facebook_url?: string;
  email?: string;
  address_bg?: string;
  physical_address_type?: string;
};
export function socialUrl(value: unknown, service: 'instagram' | 'facebook'): string {
  try {
    const url = new URL(String(value || '').trim());
    const host = url.hostname.toLowerCase();
    const domain = service === 'instagram' ? 'instagram.com' : 'facebook.com';
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password &&
      (host === domain || host.endsWith('.' + domain)) && url.pathname !== '/' ? url.href : '';
  } catch { return ''; }
}
export function contactMethods(brand: BrandContact) {
  const instagram = socialUrl(brand.instagram_url, 'instagram');
  const facebook = socialUrl(brand.facebook_url, 'facebook');
  const rawEmail = String(brand.email || '').trim();
  const email = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(rawEmail) ? rawEmail : '';
  const address = String(brand.address_bg || '').trim();
  const retail = ['магазин', 'шоурум'].includes(String(brand.physical_address_type || '').trim().toLowerCase());
  const store = retail && address.length >= 5 && /[\p{L}]/u.test(address) && !/^(?:няма|n\/a|null|undefined|[-—])$/i.test(address) ? address : '';
  return { instagram, facebook, email, store, directions: store ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(store)}` : '', available: Boolean(instagram || facebook || email || store) };
}
export function brandContactFields(row: Record<string, any>) {
  return { no_site: row.no_site === true, instagram_url: socialUrl(row.instagram_url, 'instagram'),
    facebook_url: socialUrl(row.facebook_url, 'facebook'), email: String(row.email || '').trim(),
    address_bg: String(row.address || '').trim(), physical_address_type: String(row.physical_address_type || '').trim() };
}
export function contactQualityIssue(brand: BrandContact) {
  return brand.no_site === true && !contactMethods(brand).available ? 'no_site_without_usable_contact' : null;
}
