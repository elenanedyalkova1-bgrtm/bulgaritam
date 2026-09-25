import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolvePublishableOffer, formatVerifiedOfferAmount } from '../src/lib/verified-offer';

const base = { brand_name: 'Test brand', product_url: 'https://brand.test/product', price_min_eur: 69, price_max_eur: 89, currency: 'EUR', offer_price_amount: 69, offer_price_currency: 'EUR', offer_price_verified_at: new Date().toISOString(), offer_price_source: 'monitor_json_ld_product_offer', offer_price_source_url: 'https://brand.test/product', offer_price_status: 'verified_current' };
const sources = [
 ['src/components/HomepageProductCard.astro', /const offer = resolvePublishableOffer[\s\S]*?const price = [\s\S]*?;/, 'p', 'return price;'],
 ['src/components/SeoProductLanding.astro', /function priceLabel\(p\) \{[\s\S]*?\n\}/, 'p', 'return priceLabel(p);'],
 ['src/pages/blog/[slug].astro', /function priceLabel\(p\) \{[\s\S]*?\n\}/, 'p', 'return priceLabel(p);'],
 ['src/pages/brand/[brand_slug].astro', /const offer = resolvePublishableOffer[\s\S]*?const price = [\s\S]*?;/, 'product', 'return price;'],
 ['src/pages/p/[slug].astro', /const relatedPrice = \(p\) => \{[\s\S]*?\n\};/, 'p', 'return relatedPrice(p);'],
] as const;
for (const [file, pattern, argument, result] of sources) test(`${file}: safe exact price and unchanged fallback`, () => {
 const code = fs.readFileSync(file, 'utf8').match(pattern)?.[0];
 assert.ok(code, 'price presentation exists');
 const render = new Function(argument, 'resolvePublishableOffer', 'formatVerifiedOfferAmount', `${code}\n${result}`);
 const label = (product: object) => render(product, resolvePublishableOffer, formatVerifiedOfferAmount);
 assert.equal(label(base), '69 EUR');
 for (const patch of [{offer_price_status:'unverified'}, {offer_price_status:'change_pending'}, {offer_price_verified_at:'2020-01-01'}, {offer_price_source_url:'https://other.test/product'}, {offer_price_amount:0}]) assert.equal(label({...base,...patch}), '69–89 EUR');
 assert.equal(label({...base,offer_price_status:'unverified',price_max_eur:null}), '69+ EUR');
 assert.equal(label({...base,offer_price_status:'unverified',price_min_eur:null,price_max_eur:null}), '');
});
