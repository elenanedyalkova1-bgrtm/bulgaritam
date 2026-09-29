import { detectPlatform } from "./platform.mjs";
import { normalizeExternalProductUrl } from "./product-metadata.mjs";

const decode = (v = "") => v.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
const absolute = (value, base) => { try { return new URL(decode(value), base).href; } catch { return null; } };
const sameDomain = (a, b) => { try { return new URL(a).hostname.replace(/^www\./, "") === new URL(b).hostname.replace(/^www\./, ""); } catch { return false; } };
const xmlLocs = (xml) => [...xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)].map((m) => decode(m[1].trim())).filter(Boolean);
const htmlLinks = (html, base) => [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)].map((m) => absolute(m[1], base)).filter(Boolean);
const listing = (url, base) => { try { const p = new URL(url).pathname.replace(/\/+$/, "") || "/"; return normalizeExternalProductUrl(url) === normalizeExternalProductUrl(base) || p === "/" || /^\/(shop|magazin|products?|produkti|catalog|katalog|collections?|outlet|promo)$/i.test(p) || /^\/[^/]*(?:shop|store|catalog|katalog)$/i.test(p) || /\/(product-category|category|categories|collections?)\//i.test(p); } catch { return true; } };
const productPattern = (url) => { try { const p = new URL(url).pathname; return /\/(products?|produkt|produkti|p|shop\/[^/]+)\//i.test(p) || /\/singleproduct\/\d+/i.test(p); } catch { return false; } };
export const validateDiscoveredProductUrl = (url, base) => { const normalized = normalizeExternalProductUrl(url); return normalized && sameDomain(normalized, base) && !listing(normalized, base) ? normalized : null; };

export async function fetchDiscoveryPage(url, { fetchImpl = fetch, timeoutMs = 12_000, userAgent = "BulgaritamProductDiscovery/1.0 (+https://bulgaritam.bg/)" } = {}) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { const response = await fetchImpl(url, { redirect: "follow", signal: controller.signal, headers: { "User-Agent": userAgent, Accept: "text/html,application/xml,text/xml,application/json,*/*" } }); return { ok: response.ok, status: response.status, final_url: response.url || url, content_type: response.headers?.get?.("content-type") || "", body: (await response.text()).slice(0, 8_000_000) }; }
  catch (error) { return { ok: false, status: null, final_url: url, body: "", error: error?.name === "AbortError" ? "timeout" : String(error?.message || error) }; }
  finally { clearTimeout(timer); }
}

export async function discoverBrandProducts({ brand_id, brand_url }, options = {}) {
  if (brand_id == null || !/^https?:\/\//i.test(String(brand_url || ""))) throw new Error("Discovery requires brand_id and an HTTP(S) brand_url");
  const fetchPage = options.fetchPage || ((url) => fetchDiscoveryPage(url, options));
  const maxSitemaps = Math.min(20, Math.max(1, options.maxSitemaps ?? 8)); const maxProducts = Math.min(10_000, Math.max(1, options.maxProducts ?? 5_000));
  const requests = []; const get = async (url) => { requests.push(url); return fetchPage(url); };
  const home = await get(brand_url); const base = home.final_url || brand_url; const platform = home.ok ? detectPlatform(home.body, { "content-type": home.content_type }) : "unknown";
  const candidates = new Map(); const methods = new Set(); const rejected = []; const add = (url, method, confidence) => { const normalized = validateDiscoveredProductUrl(url, base); if (!normalized || candidates.size >= maxProducts) { if (rejected.length < 10) rejected.push({ url, normalized, reason: normalized ? "capacity" : "validation" }); return; } const old = candidates.get(normalized); if (!old || old.confidence === "medium" && confidence === "high") candidates.set(normalized, { source_url: url, normalized_url: normalized, discovery_method: method, discovery_confidence: confidence }); };
  const queue = []; const robots = await get(absolute("/robots.txt", base));
  if (robots.ok) for (const match of robots.body.matchAll(/^\s*Sitemap:\s*(\S+)/gim)) { queue.push(absolute(match[1], base)); methods.add("robots_sitemap"); }
  for (const path of ["/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml"]) queue.push(absolute(path, base));
  const visited = new Set(); let sitemapFound = false; let productSitemapFound = false;
  while (queue.length && visited.size < maxSitemaps) {
    const url = queue.shift(); if (!url || visited.has(url)) continue; visited.add(url); const page = await get(url);
    if (!page.ok || !/<(?:urlset|sitemapindex)\b/i.test(page.body)) continue;
    sitemapFound = true; const urls = xmlLocs(page.body); const isIndex = /<sitemapindex\b/i.test(page.body); const productMap = /product|produkt|shop/i.test(new URL(url).pathname);
    if (productMap) productSitemapFound = true;
    if (isIndex) {
      for (const child of urls.sort((a, b) => Number(/product|produkt|shop/i.test(b)) - Number(/product|produkt|shop/i.test(a))).slice(0, 20)) if (sameDomain(child, base)) queue.push(child);
    } else {
      for (const item of urls) if (productMap || productPattern(item)) add(item, productMap ? "product_sitemap" : "sitemap_url_pattern", productMap ? "high" : "medium");
    }
  }
  if (sitemapFound) methods.add(productSitemapFound ? "product_sitemap" : "sitemap");
  if (platform === "shopify") { const page = await get(absolute("/products.json?limit=250", base)); if (page.ok) try { const data = JSON.parse(page.body); for (const item of data.products || []) if (item.handle) add(absolute(`/products/${item.handle}`, base), "shopify_products_json", "high"); if (data.products?.length) methods.add("shopify_products_json"); } catch {} }
  if (home.ok) { for (const href of htmlLinks(home.body, base)) if (productPattern(href)) add(href, "homepage_product_link", "medium"); if ([...candidates.values()].some((x) => x.discovery_method === "homepage_product_link")) methods.add("homepage_product_links"); }
  if (!candidates.size && home.ok) { const shop = htmlLinks(home.body, base).find((href) => sameDomain(href, base) && /\/(shop|magazin|products?|produkti|collection)\b/i.test(new URL(href).pathname)); if (shop) { const page = await get(shop); if (page.ok) for (const href of htmlLinks(page.body, page.final_url)) if (productPattern(href)) add(href, "shop_page_link", "medium"); if (candidates.size) methods.add("shop_page_links"); } }
  return { brand_id, brand_url, final_domain_url: base, platform, sitemap_found: sitemapFound, product_sitemap_found: productSitemapFound, discovery_methods: [...methods], candidates: [...candidates.values()], rejected_candidates: rejected, capacity_reached: rejected.some((item) => item.reason === "capacity"), request_count: requests.length, requests, status: candidates.size ? "success" : home.ok ? "not_detected" : "blocked", error_reason: candidates.size ? null : home.ok ? "no_product_urls_from_bounded_sources" : `homepage_fetch_${home.status || home.error}` };
}
