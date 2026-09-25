export function detectPlatform(html, headers = {}) {
  const haystack = `${html}\n${JSON.stringify(headers)}`.toLowerCase();
  const signals = [
    ["shopify", [/cdn\.shopify\.com/, /shopify\.theme/, /x-shopid/]],
    ["woocommerce", [/woocommerce/, /wp-content\/plugins\/woocommerce/, /wc-ajax/]],
    ["wix", [/wixstatic\.com/, /x-wix-/, /wixstores/]],
    ["cloudcart", [/cloudcart/, /cdncloudcart/]],
    ["shopiko", [/shopiko/, /shopiko\.bg/]],
    ["gombashop", [/gombashop/, /gomba\.eu/]],
  ];
  for (const [platform, patterns] of signals) if (patterns.some((pattern) => pattern.test(haystack))) return platform;
  return /<html|<!doctype/i.test(html) ? "custom" : "unknown";
}
