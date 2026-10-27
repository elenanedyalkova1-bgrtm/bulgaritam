/**
 * Image lists use commas between URL entries, not within CDN transformations.
 * A new unquoted entry must start with a URL or root-relative path. Quote an
 * entry when a literal comma is followed by URL-like text inside that URL.
 * Keep bytes/ordering intact: only separators, wrapping quotes and whitespace
 * are removed. Do not use this parser for taxonomy/tag lists.
 * @param {unknown} value
 * @returns {string[]}
 */
export function parseImageUrls(value) {
  const text = String(value ?? "").trim();
  if (!text) return [];
  /** @type {string[]} */
  const result = [];
  let entry = "";
  let quoted = false;
  const flush = () => {
    const url = entry.trim();
    if (url) result.push(url);
    entry = "";
  };
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (character === '"') {
      if (quoted && text[i + 1] === '"') { entry += '"'; i++; continue; }
      if (quoted || !entry.trim()) { quoted = !quoted; continue; }
    }
    if (!quoted) {
      const remainder = text.slice(i + 1);
      const nextEntry = /^[,\s]*(?:"\s*)?(?:https?:\/\/|\/)/i.test(remainder);
      if (character === "\n" || character === "\r" ||
          (character === "," && (nextEntry || !entry.trim() || /^[,\s]*$/.test(remainder)))) {
        flush();
        continue;
      }
    }
    entry += character;
  }
  flush();
  return result;
}
