import fs from 'node:fs';
import path from 'node:path';
import { CONSUMER_DEALS_ENDPOINT } from '../../src/lib/consumer-deals-client.mjs';

export function verifyConsumerDealsBuild(dist) {
  const html = fs.readFileSync(path.join(dist, 'namaleniya/index.html'), 'utf8');
  for (const required of ['id="dealGrid"', 'id="dealCardTemplate"', 'id="dealsFallback"', 'id="dealsStatus"',
    'data-deals-loader="consumer-deals-v1"', `data-deals-endpoint="${CONSUMER_DEALS_ENDPOINT}"`,
    'https://bulgaritam.bg/namaleniya/']) {
    if (!html.includes(required)) throw new Error(`Deals build missing ${required}`);
  }
  // Follow the page's compiled module graph, including Vite's relative shared chunks.
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)]
    .map((match) => match[1]).filter((src) => src.startsWith('/_astro/'));
  if (!scripts.length) throw new Error('Deals build missing compiled loader');
  const seen = new Set();
  let code = '';
  function visit(relative) {
    const file = path.resolve(dist, `.${relative}`);
    if (!file.startsWith(path.resolve(dist) + path.sep)) throw new Error('Unsafe deals asset path');
    if (seen.has(file)) return;
    seen.add(file);
    if (!fs.existsSync(file)) throw new Error(`Missing deals asset: ${relative}`);
    const source = fs.readFileSync(file, 'utf8'); code += source;
    for (const match of source.matchAll(/(?:from\s*|import\s*|import\s*\()\s*["']([^"']+\.js)["']/g)) {
      if (match[1].startsWith('.')) visit(path.posix.resolve(path.posix.dirname(relative), match[1]));
      else if (match[1].startsWith('/')) visit(match[1]);
    }
  }
  scripts.forEach(visit);
  for (const marker of ['dealsInitialized', 'bulgaritam:deals-refreshed', 'visibilitychange', CONSUMER_DEALS_ENDPOINT]) {
    if (!code.includes(marker)) throw new Error(`Deals loader missing behavior: ${marker}`);
  }
  for (const match of html.matchAll(/<link\b[^>]*href="([^"]+)"[^>]*>/g)) {
    if (match[1].startsWith('/_astro/') && !fs.existsSync(path.join(dist, match[1]))) throw new Error(`Missing deals stylesheet: ${match[1]}`);
  }
  return { verified: true, scripts: seen.size };
}
