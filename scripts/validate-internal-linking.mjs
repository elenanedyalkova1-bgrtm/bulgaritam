import fs from "node:fs";
import path from "node:path";
import { parse } from "parse5";
import landingSpecs from "../src/data/primary-cluster-landings.json" with { type: "json" };

const root = path.resolve("dist");
const origin = "https://bulgaritam.bg";
const landingUrls = new Set(landingSpecs.map((spec) => spec.path));
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
const nodeText = (node) => (node.childNodes || []).map((child) => child.nodeName === "#text" ? child.value : nodeText(child)).join("");
const visit = (node, callback, group = "") => {
  const activeGroup = attr(node, "data-seo-link-group") || group;
  callback(node, activeGroup);
  for (const child of node.childNodes || []) visit(child, callback, activeGroup);
  if (node.content) visit(node.content, callback, activeGroup);
};

const pages = new Map();
for (const file of walkFiles(root).filter((file) => file.endsWith(".html"))) {
  const url = pageUrl(file);
  const document = parse(fs.readFileSync(file, "utf8"));
  const links = [];
  const seoLinkGroups = new Map();
  const productIds = new Set();
  let robots = "";
  let canonical = "";
  let isCollectionPage = false;
  visit(document, (node, seoLinkGroup) => {
    if (node.tagName === "a") {
      const href = normalizeUrl(attr(node, "href"), url);
      if (href) {
        links.push(href);
        if (seoLinkGroup) {
          if (!seoLinkGroups.has(seoLinkGroup)) seoLinkGroups.set(seoLinkGroup, []);
          seoLinkGroups.get(seoLinkGroup).push(href);
        }
      }
    }
    const productId = attr(node, "data-product-id");
    if (productId) productIds.add(productId);
    if (node.tagName === "meta" && attr(node, "name").toLowerCase() === "robots") robots = attr(node, "content");
    if (node.tagName === "link" && attr(node, "rel").toLowerCase() === "canonical") canonical = attr(node, "href");
    if (node.tagName === "script" && attr(node, "type").toLowerCase() === "application/ld+json") {
      try {
        const value = JSON.parse(nodeText(node));
        isCollectionPage ||= (Array.isArray(value) ? value : [value]).some((item) => item?.["@type"] === "CollectionPage");
      } catch {}
    }
  });
  pages.set(url, { file, links, seoLinkGroups, productCount: productIds.size, robots, canonical, isCollectionPage });
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
const duplicateLinkIssues = [];
const linkLimitIssues = [];
for (const [source, page] of pages) {
  for (const [group, links] of page.seoLinkGroups) {
    const counts = new Map();
    for (const destination of links) counts.set(destination, (counts.get(destination) || 0) + 1);
    for (const [destination, count] of counts) {
      if (count > 1) duplicateLinkIssues.push({ source, group, destination, count });
    }
    const limit = group === "product" ? 4 : group === "sibling-fallback" ? 6 : 8;
    if (links.length > limit) linkLimitIssues.push({ source, group, count: links.length, limit });
  }
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

const landings = landingSpecs.map((spec) => {
  const page = pages.get(spec.path);
  const sources = [...(incoming.get(spec.path) || [])].sort();
  const productCount = page?.productCount || 0;
  const indexable = Boolean(page && !/\bnoindex\b/i.test(page.robots));
  return {
    url: spec.path, key: spec.key, name: spec.h1, generated: Boolean(page),
    product_count: productCount, status: productCount > 0 ? "contentful" : "empty",
    robots: page?.robots || "", indexable, canonical: page?.canonical || "",
    in_sitemap: sitemap.has(spec.path), incoming_link_count: sources.length,
    incoming_sources: sources, reachable_from_homepage: reachable.has(spec.path),
  };
});
const contentful = landings.filter((landing) => landing.status === "contentful");
const empty = landings.filter((landing) => landing.status === "empty");
const contentfulOrphans = contentful.filter((landing) => landing.incoming_link_count === 0);
const contentfulOutsideSitemap = contentful.filter((landing) => !landing.in_sitemap);
const contentfulWithNoindex = contentful.filter((landing) => !landing.indexable);
const missingLandingPages = landings.filter((landing) => !landing.generated);
const badCanonicals = contentful.filter((landing) => normalizeUrl(landing.canonical) !== landing.url);
const result = {
  metrics: {
    total_landings: landings.length, contentful_landings: contentful.length, empty_landings: empty.length,
    contentful_orphans: contentfulOrphans.length, contentful_pages_outside_sitemap: contentfulOutsideSitemap.length,
    contentful_pages_with_noindex: contentfulWithNoindex.length, duplicate_link_issues: duplicateLinkIssues.length,
    link_limit_issues: linkLimitIssues.length,
    missing_landing_pages: missingLandingPages.length, bad_contentful_canonicals: badCanonicals.length,
    broken_internal_destinations: broken.size,
  },
  contentful_orphans: contentfulOrphans, contentful_pages_outside_sitemap: contentfulOutsideSitemap,
  contentful_pages_with_noindex: contentfulWithNoindex, duplicate_link_issues: duplicateLinkIssues, link_limit_issues: linkLimitIssues,
  missing_landing_pages: missingLandingPages, bad_contentful_canonicals: badCanonicals, empty_landings: empty,
  landings, broken_internal_destinations: Object.fromEntries([...broken].map(([url, sources]) => [url, [...sources].sort()])),
};
console.log(JSON.stringify(result, null, 2));
if (contentfulOrphans.length || contentfulOutsideSitemap.length || contentfulWithNoindex.length
  || duplicateLinkIssues.length || linkLimitIssues.length || missingLandingPages.length || badCanonicals.length || broken.size) process.exitCode = 1;
