import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { build } from 'astro';
import { chromium } from 'playwright';
import { verifyConsumerDealsBuild } from '../scripts/lib/verify-consumer-deals-build.mjs';
import { CONSUMER_DEALS_ENDPOINT, DEAL_MAX_AGE_MS, DEAL_TIMEOUT_MS } from '../src/lib/consumer-deals-client.mjs';
import { now, deal, internalDeal, payload } from './fixtures/consumer-deals.mjs';

const root = path.resolve('.');
const temporary = [];
let browser, server, origin;
const artifacts = new Map();

async function fixture(name, staticDeals, fail = false) {
  const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'bulgaritam-deals-test-'))); temporary.push(dir);
  await fs.cp(path.join(root, 'src'), path.join(dir, 'src'), { recursive: true,
    filter: (source) => !source.startsWith(path.join(root, 'src/pages')) || source === path.join(root, 'src/pages') || source.startsWith(path.join(root, 'src/pages/namaleniya')) });
  await fs.cp(path.join(root, 'admin-app/src/lib'), path.join(dir, 'admin-app/src/lib'), { recursive: true });
  await fs.symlink(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  await fs.writeFile(path.join(dir, 'package.json'), '{"type":"module"}');
  await build({ root: pathToFileURL(dir + '/'), configFile: false, site: 'https://bulgaritam.bg', trailingSlash: 'always',
    logLevel: 'error', publicDir: path.join(dir, 'public/'), vite: { plugins: [{
      name: 'offline-deals-fixture', enforce: 'pre',
      transform(_code, id) {
        if (!id.split('?')[0].endsWith('/src/lib/weekly-discounts.ts')) return;
        return `export async function loadConsumerDeals() { ${fail ? 'throw new Error("offline source failure")' : `return {deals:${JSON.stringify(staticDeals)}}`} }
          export const formatDiscountMoney = (n,c) => new Intl.NumberFormat('bg-BG',{style:'currency',currency:c}).format(n);
          export const formatDiscountPercent = n => '−'+Math.round(n)+'%';`;
      },
    }] },
  });
  const dist = path.join(dir, 'dist'); artifacts.set(name, dist);
  assert.equal(verifyConsumerDealsBuild(dist).verified, true);
  return dist;
}

before(async () => {
  // Compile the real page, card, filters and loader. Only server-side data access is replaced.
  await fixture('fallback', [internalDeal, deal()]);
  await fixture('zero', []);
  await fixture('build-error', [], true);
  server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const variant = req.headers.cookie?.match(/fixture=(\w[\w-]*)/)?.[1] || 'zero';
      const pathname = decodeURIComponent(url.pathname);
      const file = path.resolve(artifacts.get(variant), '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
      if (!file.startsWith(artifacts.get(variant) + path.sep)) throw new Error('unsafe path');
      const body = await fs.readFile(file);
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.DEALS_BROWSER_CHANNEL ? { channel: process.env.DEALS_BROWSER_CHANNEL } : {}) });
}, { timeout: 120_000 });
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  for (const dir of temporary) await fs.rm(dir, { recursive: true, force: true });
});

async function openPage(t, { variant = 'zero', response = payload(), javaScriptEnabled = true, mobile = false } = {}) {
  const context = await browser.newContext({ javaScriptEnabled, viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
  t.after(() => context.close());
  await context.addCookies([{ name: 'fixture', value: variant, url: origin }]);
  let data = response; let calls = 0;
  // Block every external request except the fully mocked Consumer Deals response.
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (url === CONSUMER_DEALS_ENDPOINT) {
      calls++;
      if (data === 'network-error') return route.abort('failed');
      if (data === 'timeout') return;
      if (data === 'http-error') return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: typeof data === 'string' ? data : JSON.stringify(data) });
    }
    if (url === 'https://brand.test/image.jpg') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#e8e4da"/><circle cx="400" cy="400" r="180" fill="#668873"/></svg>' });
    if (url.startsWith(origin + '/')) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  if (javaScriptEnabled) {
    await page.clock.install({ time: now });
    await page.addInitScript(() => {
      window.dealEvents = [];
      window.addEventListener('bulgaritam:products-appended', (event) => window.dealEvents.push(event.detail.nodes.map((node) => ({ id: node.dataset.entityId, position: node.dataset.position, kind: node.dataset.analyticsKind }))));
    });
  }
  await page.goto(origin + '/namaleniya/');
  if (javaScriptEnabled && await page.getByRole('button', { name: 'Само необходими', exact: true }).isVisible()) {
    await page.getByRole('button', { name: 'Само необходими', exact: true }).click();
  }
  return { page, context, setResponse: (value) => { data = value; }, calls: () => calls };
}
async function state(page, value) {
  await page.waitForFunction((expected) => document.querySelector('#dealGrid')?.dataset.dealsState === expected, value);
}
const visibleCards = (page) => page.locator('#dealGrid > li:visible');

test('zero static deals still initialize the loader, cards, links and analytics', async (t) => {
  const { page, calls } = await openPage(t, { response: payload([deal(1, { image_url: 'http://brand.test/image.jpg' }), internalDeal]) });
  await state(page, 'ready'); assert.equal(calls(), 1);
  assert.equal(await visibleCards(page).count(), 2);
  assert.equal(await page.locator('#dealGrid img').first().getAttribute('src'), 'https://brand.test/image.jpg');
  assert.equal(await page.locator('#dealGrid .card-titlelink').nth(1).getAttribute('href'), '/p/test-product/');
  assert.equal(await page.locator('#dealGrid .card-titlelink').first().getAttribute('target'), '_blank');
  assert.equal(await page.locator('#dealGrid .card-titlelink').nth(1).getAttribute('target'), null);
  assert.match(await page.locator('#dealGrid .discount-price').first().getAttribute('aria-label'), /40/);
  assert.equal(await page.locator('#dealsFallback').isVisible(), false);
  assert.equal(await page.evaluate(() => window.dealEvents.at(-1)[1].id), '2');
  assert.equal(await page.locator('#dealGrid > li').nth(1).getAttribute('data-product-slug'), 'test-product');
  await page.evaluate(() => {
    window.dealTracking = [];
    const track = window.bulgaritamTrack;
    window.bulgaritamTrack = (name, data) => { window.dealTracking.push({ name, data }); return track?.(name, data); };
    document.querySelector('#dealGrid .card-titlelink').addEventListener('click', (event) => event.preventDefault());
  });
  await page.locator('#dealGrid .card-titlelink').first().click();
  const click = await page.evaluate(() => window.dealTracking.find((event) => event.name === 'deal_click'));
  assert.equal(click.data.entity_id, '1'); assert.equal(click.data.destination_type, 'external');
  assert.equal(click.data.category, 'Козметика');
});

test('source failure during build still produces a working dynamic page', async (t) => {
  const { page } = await openPage(t, { variant: 'build-error' });
  await state(page, 'ready'); assert.equal(await visibleCards(page).count(), 1);
});

test('empty API response removes prior deals and shows a genuine empty state', async (t) => {
  const { page, setResponse } = await openPage(t);
  await state(page, 'ready'); setResponse(payload([]));
  await page.clock.runFor(600_001); await state(page, 'empty');
  assert.equal(await page.locator('#dealGrid > li').count(), 0);
  assert.match(await page.locator('#dealsStatus').innerText(), /няма активно проверени/);
  assert.equal(await page.locator('#dealsRetry').isVisible(), false);
});
for (const [label, response] of Object.entries({ stale: payload([deal()], { stale: true }), network: 'network-error', http: 'http-error', malformed: '{broken',
  invalidPrice: payload([deal(1, { current_price: -1 })]), invalidUrl: payload([deal(1, { destination_url: 'javascript:alert(1)' })]), invalidDate: payload([deal(1, { latest_checked_at: 'tomorrow' })]),
})) test(`${label} response clears previously active deals and keeps neutral fallback`, async (t) => {
  const { page, setResponse } = await openPage(t, { variant: 'fallback' });
  await state(page, 'ready'); setResponse(response);
  await page.clock.runFor(600_001); await state(page, 'error');
  assert.equal(await page.locator('#dealGrid > li').count(), 0);
  assert.equal(await page.locator('.discount-price:visible').count(), 0);
  assert.equal(await page.locator('#dealsFallback').isVisible(), true);
  assert.equal(await page.locator('#dealsFallback a[href="/p/test-product/"]').count(), 2);
  assert.equal(await page.locator('#dealsRetry').isVisible(), true);
});

test('a failed refresh closes an open filter dialog and releases its scroll lock', async (t) => {
  const { page, setResponse } = await openPage(t);
  await state(page, 'ready'); await page.locator('#filtersToggle').click();
  assert.equal(await page.locator('html').evaluate((node) => node.classList.contains('no-scroll')), true);
  setResponse('http-error'); await page.clock.runFor(600_001); await state(page, 'error');
  assert.equal(await page.locator('html').evaluate((node) => node.classList.contains('no-scroll')), false);
  assert.equal(await page.locator('#filtersToggle').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('#filtersModal').isVisible(), false);
});

test('timeout fails safely and manual retry recovers', async (t) => {
  const { page, setResponse } = await openPage(t, { response: 'timeout' });
  await state(page, 'loading'); await page.clock.runFor(DEAL_TIMEOUT_MS + 1);
  await state(page, 'error'); setResponse(payload()); await page.locator('#dealsRetry').click();
  await state(page, 'ready'); assert.equal(await visibleCards(page).count(), 1);
});

test('expired observations in a cached response are never rendered', async (t) => {
  const { page } = await openPage(t, { response: payload([deal(1, { latest_checked_at: new Date(now - DEAL_MAX_AGE_MS).toISOString() })]) });
  await state(page, 'empty'); assert.equal(await page.locator('.discount-price:visible').count(), 0);
});

test('a displayed observation disappears at expiry even without another API response', async (t) => {
  const { page, calls } = await openPage(t, { response: payload([deal(1, { latest_checked_at: new Date(now - DEAL_MAX_AGE_MS + 1_000).toISOString() })]) });
  await state(page, 'ready'); await page.clock.runFor(1_001); await state(page, 'empty');
  assert.equal(await page.locator('#dealGrid > li').count(), 0); assert.equal(calls(), 1);
});

test('visibility return rechecks freshness and requests updated deals', async (t) => {
  const { page, setResponse, calls } = await openPage(t);
  await state(page, 'ready');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await page.locator('#dealsLive').isVisible(), false);
  await page.clock.fastForward(DEAL_MAX_AGE_MS + 1); setResponse(payload([], { generated_at: new Date(now + DEAL_MAX_AGE_MS + 1).toISOString() }));
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await state(page, 'empty'); assert.equal(await page.locator('#dealGrid > li').count(), 0); assert.equal(calls(), 2);
});

test('no JavaScript preserves SEO and internal product links without active discount claims', async (t) => {
  const { page, calls } = await openPage(t, { variant: 'fallback', javaScriptEnabled: false });
  assert.equal(calls(), 0);
  assert.equal(await page.locator('h1').innerText(), 'Намаления от български брандове');
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://bulgaritam.bg/namaleniya/');
  assert.ok(await page.locator('meta[name="description"]').getAttribute('content'));
  assert.equal(await page.locator('#dealsFallback a[href="/p/test-product/"]').count(), 2);
  assert.equal(await page.locator('#dealsFallback .discount-price').count(), 0);
  assert.equal(await page.locator('#dealsFallback [data-checked-at]').count(), 0);
  assert.equal(await page.locator('#dealsLive').isVisible(), false);
});

test('sorting, combined filters, refresh, badges, and mobile cards remain usable', async (t) => {
  const a = deal(1, { current_price: 20, regular_price: 50, discount_percent: 60, materials: ['Лен'], deal_category: null });
  const b = { ...internalDeal, giftable: true };
  const { page, setResponse } = await openPage(t, { mobile: true, response: payload([a, b]) });
  await state(page, 'ready');
  assert.equal(await page.locator('#dealGrid > li').nth(1).locator('[data-deal-gift-badge]').count(), 1);
  assert.equal(await page.locator('#dealGrid [data-deal-gift-badge]').evaluate((node) => getComputedStyle(node).minHeight), '22px');
  assert.equal(await page.locator('[data-deal-facet-options="brand"] label').first().evaluate((node) => getComputedStyle(node).display), 'flex');
  await page.locator('#dealSort').selectOption('price-desc');
  assert.equal(await visibleCards(page).first().getAttribute('data-entity-id'), '2');
  await page.locator('#filtersToggle').click(); await page.locator('input[name="category"][value="Козметика"]').check();
  await page.locator('input[name="material"][value="Памук"]').check(); await page.locator('#applyFilters').click();
  assert.equal(await visibleCards(page).count(), 1);
  await page.locator('#dealSearch').fill('продукт 2');
  setResponse(payload([b, deal(3, { brand: 'Нов бранд', materials: ['Коприна'] })]));
  await page.clock.runFor(600_001); await state(page, 'ready');
  await page.waitForFunction(() => !!document.querySelector('input[name="material"][value="Коприна"]'));
  assert.equal(await page.locator('#dealSort').inputValue(), 'price-desc');
  assert.equal(await page.locator('#dealSearch').inputValue(), 'продукт 2');
  assert.equal(await visibleCards(page).count(), 1);
  if (await page.locator('#newsletter-modal').isVisible()) await page.locator('.newsletter-modal__close').click();
  await page.locator('#filtersToggle').click(); await page.locator('#resetFilters').click(); await page.locator('#applyFilters').click();
  assert.equal(await visibleCards(page).count(), 2);
  assert.equal(await page.locator('input[name="material"][value="Лен"]').count(), 0);
  const layout = await page.locator('#dealGrid').evaluate((node) => ({ columns: getComputedStyle(node).gridTemplateColumns.split(' ').length, overflow: document.documentElement.scrollWidth > window.innerWidth }));
  assert.equal(layout.columns, 2); assert.equal(layout.overflow, false);
  if (process.env.DEALS_SCREENSHOT_PATH) {
    await page.locator('#dealGrid').scrollIntoViewIfNeeded();
    await page.clock.runFor(100);
    await page.screenshot({ path: process.env.DEALS_SCREENSHOT_PATH });
  }
});

test('all sorting modes, brand/price/discount filters and pagination use refreshed cards', async (t) => {
  const rows = Array.from({ length: 30 }, (_, index) => deal(index + 1, {
    current_price: 20 + index, regular_price: 100, discount_percent: 80 - index,
    latest_checked_at: new Date(now - (30 - index) * 60_000).toISOString(),
  }));
  const { page } = await openPage(t, { response: payload(rows) });
  await state(page, 'ready');
  assert.equal(await visibleCards(page).count(), 24);
  for (const [mode, id] of [['price-desc', '30'], ['price-asc', '1'], ['discount-desc', '1'], ['checked-desc', '30'], ['recommended', '1']]) {
    await page.locator('#dealSort').selectOption(mode);
    assert.equal(await visibleCards(page).first().getAttribute('data-entity-id'), id);
  }
  await page.locator('#loadSentinel').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll('#dealGrid > li')].filter((card) => !card.hidden).length === 30);
  assert.equal(await visibleCards(page).count(), 30);
  await page.locator('#filtersToggle').click();
  await page.locator('input[name="brand"][value="1"]').check();
  await page.locator('input[name="discount"][value="over50"]').check();
  await page.locator('input[name="price"][value="under25"]').check();
  await page.locator('input[name="ingredient"][value="Роза"]').check();
  await page.locator('#applyFilters').click();
  assert.equal(await visibleCards(page).count(), 1);
  assert.equal(await visibleCards(page).first().getAttribute('data-entity-id'), '1');
  await page.locator('#dealSearch').fill('няма такъв продукт');
  assert.equal(await page.locator('#noResults').isVisible(), true);
  await page.locator('#emptyReset').click(); assert.equal(await visibleCards(page).count(), 24);
});

test('build verification rejects missing grid, endpoint, loader or asset', async () => {
  const source = artifacts.get('zero');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bulgaritam-deals-verify-')); temporary.push(dir);
  await fs.cp(source, dir, { recursive: true });
  const file = path.join(dir, 'namaleniya/index.html'); const html = await fs.readFile(file, 'utf8');
  for (const marker of ['id="dealGrid"', 'id="dealCardTemplate"', 'data-deals-loader="consumer-deals-v1"', `data-deals-endpoint="${CONSUMER_DEALS_ENDPOINT}"`]) {
    await fs.writeFile(file, html.replace(marker, '')); assert.throws(() => verifyConsumerDealsBuild(dir));
  }
  await fs.writeFile(file, html);
  const asset = [...html.matchAll(/<script\b[^>]*src="(\/_astro\/[^"]+)"/g)][0][1];
  await fs.unlink(path.join(dir, asset)); assert.throws(() => verifyConsumerDealsBuild(dir), /Missing deals asset/);
});
