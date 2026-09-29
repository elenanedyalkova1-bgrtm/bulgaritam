import { decodeHtml, normalizeCurrency, parsePrice } from "./normalize.mjs";

const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map((m) => [m[1].toLowerCase(), decodeHtml(m[2] ?? m[3] ?? m[4] ?? "")]));
const types = (node) => (Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]]).filter(Boolean).map((v) => String(v).toLowerCase());
const walk = (value, out = [], seen = new Set()) => { if (!value || typeof value !== "object" || seen.has(value)) return out; seen.add(value); out.push(value); for (const child of Array.isArray(value) ? value : Object.values(value)) walk(child, out, seen); return out; };
const absolute = (value, base) => { try { return new URL(value, base).href; } catch { return null; } };
export const normalizeExternalProductUrl = (value) => { try { const u = new URL(value); u.hash = ""; for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|srsltid|ref$|source$)/i.test(key)) u.searchParams.delete(key); u.hostname = u.hostname.toLowerCase().replace(/^www\./, ""); u.pathname = u.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/"; return u.href; } catch { return null; } };

function jsonLdProducts(html) {
  const products = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json(?:;[^"']*)?["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { for (const node of walk(JSON.parse(decodeHtml(match[1]).trim()))) if (types(node).includes("product")) products.push(node); } catch {}
  }
  return products;
}
const availability = (value) => { const text = String(value ?? "").toLowerCase(); if (/instock/.test(text)) return "in_stock"; if (/outofstock|soldout/.test(text)) return "out_of_stock"; if (/preorder/.test(text)) return "preorder"; if (/backorder/.test(text)) return "backorder"; return null; };
const firstImage = (value, base) => { const raw = Array.isArray(value) ? value[0] : typeof value === "object" ? value?.url || value?.contentUrl : value; return raw ? absolute(raw, base) : null; };

export function extractProductMetadata(html, { url = "" } = {}) {
  const canonicalRaw = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => attrs(m[0])).find((a) => String(a.rel).toLowerCase().split(/\s+/).includes("canonical"))?.href;
  const canonicalUrl = normalizeExternalProductUrl(absolute(canonicalRaw, url) || url);
  const titleTag = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const meta = new Map();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) { const a = attrs(match[0]); const key = String(a.property || a.name || a.itemprop || "").toLowerCase(); if (key && (a.content || a.value)) meta.set(key, a.content || a.value); }
  const products = jsonLdProducts(html);
  let selected = products.find((p) => normalizeExternalProductUrl(typeof p.url === "object" ? p.url?.["@id"] || p.url?.url : p.url) === canonicalUrl) || products[0] || null;
  const offer = Array.isArray(selected?.offers) ? selected.offers[0] : selected?.offers;
  const title = String(selected?.name || meta.get("og:title") || titleTag).trim() || null;
  const imageUrl = firstImage(selected?.image, url) || absolute(meta.get("og:image"), url);
  const sku = String(selected?.sku || selected?.mpn || "").trim() || null;
  const externalProductId = String(selected?.productID || selected?.productId || selected?.["@id"] || "").trim() || null;
  return {
    title, image_url: imageUrl || null, canonical_url: canonicalUrl,
    availability: availability(offer?.availability ?? selected?.availability), sku, external_product_id: externalProductId,
    metadata_method: selected ? "json_ld_product" : meta.size ? "open_graph_meta" : title ? "html_title" : null,
  };
}
