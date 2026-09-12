import fs from "node:fs";
import path from "node:path";
import { parse } from "parse5";

const root = path.resolve("dist");
const baselinePath = path.resolve("reports/internal-linking-audit-2026-09-10.csv");
const origin = "https://bulgaritam.bg";

const pageUrl = (file) => {
  const relative = path.relative(root, file).split(path.sep).join("/");
  if (relative === "index.html") return "/";
  if (relative.endsWith("/index.html")) return `/${relative.slice(0, -10)}`;
  return `/${relative}`;
};

const normalizeUrl = (value, base = "/") => {
  if (!value || /^(#|mailto:|tel:|javascript:|data:)/i.test(value)) return null;
  const url = new URL(value, `${origin}${base}`);
  if (!["bulgaritam.bg", "www.bulgaritam.bg"].includes(url.hostname)) return null;
  let pathname = decodeURI(url.pathname).replace(/\/{2,}/g, "/");
  if (pathname.endsWith("/index.html")) pathname = pathname.slice(0, -10);
  if (!path.extname(pathname) && !pathname.endsWith("/")) pathname += "/";
  return pathname;
};

const walkFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? walkFiles(target) : [target];
});

const attr = (node, name) => node.attrs?.find((entry) => entry.name === name)?.value || "";
const text = (node) => (node.childNodes || []).map((child) => child.nodeName === "#text" ? child.value : text(child)).join("");
const visit = (node, callback) => {
  callback(node);
  for (const child of node.childNodes || []) visit(child, callback);
  if (node.content) visit(node.content, callback);
};

const pages = new Map();
for (const file of walkFiles(root).filter((file) => file.endsWith(".html"))) {
  const url = pageUrl(file);
  const document = parse(fs.readFileSync(file, "utf8"));
  const links = [];
  const ldTypes = [];
  let robots = "";
  let canonical = "";
  visit(document, (node) => {
    if (node.tagName === "a") {
      const href = normalizeUrl(attr(node, "href"), url);
      if (href) links.push(href);
    }
    if (node.tagName === "meta" && attr(node, "name").toLowerCase() === "robots") robots = attr(node, "content");
    if (node.tagName === "link" && attr(node, "rel").toLowerCase() === "canonical") canonical = attr(node, "href");
    if (node.tagName === "script" && attr(node, "type").toLowerCase() === "application/ld+json") {
      try {
        const value = JSON.parse(text(node));
        for (const item of Array.isArray(value) ? value : [value]) if (item?.["@type"]) ldTypes.push(item["@type"]);
      } catch {}
    }
  });
  pages.set(url, { file, links, robots, canonical, isLanding: ldTypes.includes("CollectionPage") });
}

const sitemap = new Set();
for (const file of walkFiles(root).filter((file) => /sitemap-\d+\.xml$/.test(file))) {
  for (const match of fs.readFileSync(file, "utf8").matchAll(/<loc>(.*?)<\/loc>/g)) {
    const url = normalizeUrl(match[1]);
    if (url && !url.endsWith(".xml")) sitemap.add(url);
  }
}

const incoming = new Map([...pages.keys()].map((url) => [url, new Set()]));
const broken = new Map();
for (const [source, page] of pages) {
  for (const destination of new Set(page.links)) {
    if (pages.has(destination) && destination !== source) incoming.get(destination).add(source);
    else if (!pages.has(destination) && !path.extname(destination)) {
      if (!broken.has(destination)) broken.set(destination, new Set());
      broken.get(destination).add(source);
    }
  }
}

const reachable = new Set(["/"]);
const queue = ["/"];
while (queue.length) {
  const source = queue.shift();
  for (const destination of pages.get(source)?.links || []) {
    if (pages.has(destination) && !reachable.has(destination)) {
      reachable.add(destination);
      queue.push(destination);
    }
  }
}

const parseCsv = (raw) => {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (quoted && char === '"' && raw[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && raw[index + 1] === "\n") index += 1;
      row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = "";
    } else field += char;
  }
  const [header, ...values] = rows;
  return values.map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index] || ""])));
};

const baseline = parseCsv(fs.readFileSync(baselinePath, "utf8"));
const baselineByUrl = new Map(baseline.map((row) => [row.URL, row]));
const contentfulSitemapLandings = baseline.filter((row) => row.IN_SITEMAP === "YES" && row.INDEXABILITY === "INDEX" && Number(row.PRODUCT_COUNT) > 0);
const targetUrls = new Set(contentfulSitemapLandings.filter((row) => Number(row.INCOMING_HTML_PAGES) === 0).map((row) => row.URL));
const sourceType = (url) => url.startsWith("/p/") ? "product" : url.startsWith("/brand/") ? "brand" : url.startsWith("/k/") ? "taxonomy" : "intent_or_hub";
const landingRows = contentfulSitemapLandings.map((before) => {
  const sources = [...(incoming.get(before.URL) || [])].sort();
  return {
    url: before.URL,
    product_count: Number(before.PRODUCT_COUNT),
    incoming_link_count: sources.length,
    incoming_source_types: [...new Set(sources.map(sourceType))].sort(),
    reachable_from_homepage: reachable.has(before.URL),
  };
});

const additionsBySource = new Map();
for (const target of targetUrls) {
  for (const source of incoming.get(target) || []) additionsBySource.set(source, (additionsBySource.get(source) || 0) + 1);
}

const productUrls = [...sitemap].filter((url) => url.startsWith("/p/"));
const brandUrls = [...sitemap].filter((url) => url.startsWith("/brand/"));
const result = {
  generated_pages: pages.size,
  sitemap_pages: sitemap.size,
  contentful_indexable_sitemap_landings: landingRows,
  remaining_zero_incoming: landingRows.filter((row) => row.incoming_link_count === 0),
  exactly_one_incoming: landingRows.filter((row) => row.incoming_link_count === 1),
  metrics: {
    contentful_zero_incoming: landingRows.filter((row) => row.incoming_link_count === 0).length,
    contentful_exactly_one_incoming: landingRows.filter((row) => row.incoming_link_count === 1).length,
    contentful_two_or_more_incoming: landingRows.filter((row) => row.incoming_link_count >= 2).length,
    unreachable_contentful_landings: landingRows.filter((row) => !row.reachable_from_homepage).length,
    target_contextual_links_added: [...targetUrls].reduce((sum, url) => sum + (incoming.get(url)?.size || 0), 0),
    max_target_links_added_on_single_page: Math.max(0, ...additionsBySource.values()),
    broken_internal_destinations: broken.size,
    product_urls_in_sitemap: productUrls.length,
    product_urls_reachable: productUrls.filter((url) => reachable.has(url)).length,
    brand_urls_in_sitemap: brandUrls.length,
    brand_urls_reachable: brandUrls.filter((url) => reachable.has(url)).length,
  },
  broken_internal_destinations: Object.fromEntries([...broken].map(([url, sources]) => [url, [...sources].sort()])),
};

console.log(JSON.stringify(result, null, 2));
if (result.metrics.broken_internal_destinations || result.metrics.product_urls_in_sitemap !== result.metrics.product_urls_reachable || result.metrics.brand_urls_in_sitemap !== result.metrics.brand_urls_reachable) process.exitCode = 1;
