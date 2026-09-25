import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the actual browser pagination code with disjoint static HTML pages.
const source = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const loader = source.slice(source.indexOf('    const firstPageCards ='), source.indexOf('    const catalogueMaterials ='));
async function harness(total, seed = 3, fail = () => false) {
  const pages = Array.from({ length: Math.ceil(total / 48) }, (_, page) => Array.from({ length: Math.min(48, total - page * 48) }, (_, index) => ({ dataset: { productSlug: String(page * 48 + index) } })));
  const requests = [];
  const math = Object.create(Math);
  math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const context = vm.createContext({ Math: math, Set, Array, Number, String, Error,
    productCardCatalogue: { content: { querySelectorAll: () => pages[0] } },
    productFeed: { dataset: { totalPages: pages.length, totalItems: total } },
    document: { importNode: card => ({ dataset: { ...card.dataset } }) },
    DOMParser: class { parseFromString(html) { return { querySelectorAll: () => pages[Number(html) - 1] }; } },
    fetch: async url => { const page = Number(url.split('/')[2]); requests.push(page); if (fail(page)) throw Error('offline'); return { ok: true, text: async () => String(page) }; },
  });
  const api = await vm.runInContext(`(async () => { ${loader}; return { cards: () => allCards, next: () => loadStaticPage(pageOrder[loadedThroughPage]), all: ensureAllStaticPages, pages: pageOrder }; })()`, context);
  return { api, requests };
}
for (const total of [1000, 2000, 10032]) test(`progressive discovery preserves order and unique membership: ${total}`, async () => {
  const { api, requests } = await harness(total);
  const initial = Array.from(api.cards(), c => c.dataset.productSlug);
  assert.ok(initial.length <= 48);
  assert.ok(requests.length <= 1, 'does not fetch entire catalogue on entry');
  await api.next();
  assert.deepEqual(Array.from(api.cards().slice(0, initial.length), c => c.dataset.productSlug), initial);
  await Promise.all([api.all(), api.all()]);
  assert.equal(api.cards().length, total);
  assert.equal(new Set(api.cards().map(c => c.dataset.productSlug)).size, total);
  assert.equal(new Set(requests).size, requests.length, 'each remote page fetched once');
  assert.deepEqual(Array.from(api.cards().slice(0, initial.length), c => c.dataset.productSlug), initial);
});
test('a new load changes initial discovery order', async () => {
  const a = await harness(2000, 3), b = await harness(2000, 987);
  assert.notDeepEqual(Array.from(a.api.cards(), c => c.dataset.productSlug), Array.from(b.api.cards(), c => c.dataset.productSlug));
});
test('offline initial request falls back to embedded cards; retry preserves membership', async () => {
  let offline = true;
  const { api } = await harness(1000, 3, () => offline);
  assert.equal(api.cards().length, 48);
  const initial = Array.from(api.cards(), c => c.dataset.productSlug);
  await assert.rejects(api.next());
  assert.deepEqual(Array.from(api.cards(), c => c.dataset.productSlug), initial);
  offline = false;
  await api.all();
  assert.equal(new Set(api.cards().map(c => c.dataset.productSlug)).size, 1000);
});
