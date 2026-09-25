// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';

const pruneNoindexFromSitemap = {
  name: 'prune-noindex-from-sitemap',
  hooks: {
    'astro:build:done': ({ dir }) => {
      const outputDir = new URL(dir);
      const sitemapPath = new URL('sitemap-0.xml', outputDir);
      if (!fs.existsSync(sitemapPath)) return;
      const htmlByPath = new Map();
      const walk = (directory) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const absolute = path.join(directory, entry.name);
          if (entry.isDirectory()) walk(absolute);
          else if (entry.name === 'index.html') {
            const relative = path.relative(outputDir.pathname, path.dirname(absolute)).split(path.sep).join('/');
            htmlByPath.set(relative ? `/${relative}/` : '/', fs.readFileSync(absolute, 'utf8'));
          }
        }
      };
      walk(outputDir.pathname);
      const xml = fs.readFileSync(sitemapPath, 'utf8').replace(/<url><loc>([^<]+)<\/loc><\/url>/g, (entry, value) => {
        const html = htmlByPath.get(new URL(value).pathname);
        return html && /<meta name="robots" content="[^"]*noindex/i.test(html) ? '' : entry;
      });
      fs.writeFileSync(sitemapPath, xml);
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site: 'https://bulgaritam.bg',
  trailingSlash: 'always',
  integrations: [sitemap({
    filter: (page) => ![
      '/category/podaratsi/', '/category/idei-za-podarak/',
      '/podarak-za-zhena-za-rozhden-den/', '/k/detsko-obleklo/',
      '/blog/', '/politika-na-poveritelnost/', '/spodelena-kolekciya/', '/zapazeni/',
      '/k/podaraci/', '/k/idei-za-podarak/', '/k/bulgarski-podaratsi/',
      '/k/za-zhena/', '/k/podaraci-za-jena/', '/k/za-mazh/', '/k/podaraci-za-nego/',
      '/k/za-bebe/', '/k/podaraci-za-bebe/', '/k/za-dete/', '/k/podaraci-za-dete/',
      '/k/za-svatba/', '/k/podaraci-za-svatba/'
      , '/k/bulgarski-drehi/', '/k/obleklo/', '/k/dom-i-interior/', '/k/dekor/', '/k/detski-knigi/',
      '/k/detski-aksesoari/', '/k/grizha-za-deca/', '/k/imunitet/', '/k/vitamini/',
      '/k/srebarni-bijuta/'
    ].some((path) => page.endsWith(path)),
  }), pruneNoindexFromSitemap],
});
