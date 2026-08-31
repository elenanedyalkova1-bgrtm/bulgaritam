// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://bulgaritam.bg',
  trailingSlash: 'always',
  integrations: [sitemap({
    filter: (page) => ![
      '/category/podaratsi/', '/category/idei-za-podarak/',
      '/k/podaraci/', '/k/idei-za-podarak/', '/k/bulgarski-podaratsi/',
      '/k/za-zhena/', '/k/podaraci-za-jena/', '/k/za-mazh/', '/k/podaraci-za-nego/',
      '/k/za-bebe/', '/k/podaraci-za-bebe/', '/k/za-dete/', '/k/podaraci-za-dete/',
      '/k/za-svatba/', '/k/podaraci-za-svatba/'
      , '/k/bulgarski-drehi/', '/k/obleklo/', '/k/dom-i-interior/', '/k/dekor/',
      '/k/detski-aksesoari/', '/k/grizha-za-deca/', '/k/imunitet/', '/k/vitamini/',
      '/k/srebarni-bijuta/'
    ].some((path) => page.endsWith(path)),
  })],
});
