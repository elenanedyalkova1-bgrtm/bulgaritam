/** Publishing rules for product detail pages only; stored copy remains plain text. */
export type ProductPublishingData = {
  slug?: string;
  name_bg?: string;
  brand_name?: string;
  short_desc_bg?: string;
  long_desc_bg?: string;
  meta_title_bg?: string;
  meta_desc_bg?: string;
};

export const normalizeProductText = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

function metadataText(value: unknown): string {
  const text = normalizeProductText(value);
  // Metadata is plain text, not HTML. Reject unusable placeholder/control values.
  if (!text || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text) || /^(?:null|undefined|n\/a|[-—])$/i.test(text)) return "";
  return text;
}

// Compare whole identity tokens, allowing punctuation, word order and connective
// formatting. Keep numbers, units, negation and model/variant words significant.
// Do not stem arbitrary Bulgarian words: suffix stripping can alter model names.
const identityConnectives = new Set(["и", "с", "със", "от", "на", "за", "в", "във"]);
const identityGrammar: Record<string, string> = {
  // Reviewed definite/indefinite adjective pair in the current catalogue.
  "квадратната": "квадратна",
};
function identityTokens(value: unknown): string[] {
  return (normalizeProductText(value).normalize("NFKC").toLocaleLowerCase("bg")
    .replace(/(\d),(?=\d)/gu, "$1.")
    .match(/[\p{L}\p{N}]+(?:[.]\p{N}+)?/gu) || [])
    .filter(token => !identityConnectives.has(token))
    .map(token => identityGrammar[token] || token);
}

export function preservesProductIdentity(title: unknown, name: unknown): boolean {
  const required = identityTokens(name);
  if (!required.length) return false;
  const available = new Map<string, number>();
  for (const token of identityTokens(title)) available.set(token, (available.get(token) || 0) + 1);
  return required.every(token => {
    const count = available.get(token) || 0;
    if (!count) return false;
    available.set(token, count - 1);
    return true;
  });
}

function usableProductTitle(product: ProductPublishingData): string {
  const custom = metadataText(product.meta_title_bg);
  return custom && preservesProductIdentity(custom, product.name_bg) ? custom : "";
}

export function productTitle(product: ProductPublishingData): string {
  const custom = usableProductTitle(product);
  if (custom) return custom;
  const identity = [normalizeProductText(product.name_bg), normalizeProductText(product.brand_name)].filter(Boolean).join(" | ");
  const branded = `${identity} | Българитъм`;
  // Drop only optional site branding; never shorten product or brand identity.
  return identity && branded.length <= 60 ? branded : identity;
}

export function productDescription(product: ProductPublishingData): string {
  return metadataText(product.meta_desc_bg)
    || metadataText(product.short_desc_bg)
    || [normalizeProductText(product.name_bg), normalizeProductText(product.brand_name)].filter(Boolean).join(" от ");
}

// Keep this reviewed exception until the stored description is equally specific.
// The other six exceptions now have equivalent facts in their stored SEO copy.
const reviewedDescriptions: Record<string, string> = {
  "roklya-dot": "Дамска рокля Dot от DVETE с десен на точки, предлагана в размери S, M и L. Виж модела, снимките и актуалните условия при бранда.",
};

export function productPublishing(product: ProductPublishingData) {
  const short = normalizeProductText(product.short_desc_bg);
  const long = normalizeProductText(product.long_desc_bg);
  const distinctLong = Boolean(long && long !== short);
  return {
    title: productTitle(product),
    description: reviewedDescriptions[product.slug || ""] || productDescription(product),
    titleSource: usableProductTitle(product) ? "meta_title_bg" : "generated",
    descriptionSource: reviewedDescriptions[product.slug || ""] ? "reviewed_exception"
      : metadataText(product.meta_desc_bg) ? "meta_desc_bg"
      : metadataText(product.short_desc_bg) ? "short_desc_bg" : "generated",
    // Astro text interpolation escapes these strings; never render stored HTML.
    longParagraphs: distinctLong ? String(product.long_desc_bg).trim().split(/\r?\n\s*\r?\n/u).map(part => part.trim()).filter(Boolean) : [],
    // A concise description already visible in the lead; no schema-only copy.
    schemaDescription: short || long,
  };
}
