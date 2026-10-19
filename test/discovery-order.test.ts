import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveryProducts } from '../src/lib/discovery-order.ts';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../public/product-discovery.js', import.meta.url), 'utf8');
function session(storage = new Map(), entropy = 123) {
  const context: any = { window: {}, Uint32Array, crypto: { getRandomValues: (array) => { array[0] = entropy; return array; } }, sessionStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } };
  runInNewContext(script, context);
  return context.window.bulgaritamDiscoveryPlan;
}
test('seed is generated once per session and survives navigation/reload', () => {
  const storage = new Map();
  const first = session(storage, 123)(20);
  assert.deepEqual(Array.from(session(storage, 999)(20).pages), Array.from(first.pages));
  assert.notDeepEqual(Array.from(session(new Map(), 999)(20).pages), Array.from(first.pages));
});
test('global page plan has unique contiguous ranks and permits page one anywhere', () => {
  const positions = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    const plan = session(new Map(), seed)(8);
    positions.add(plan.pages.indexOf(1));
    const ranks = plan.pages.flatMap(page => Array.from({length:48}, (_, i) => plan.rank(page, i)));
    assert.deepEqual(Array.from(ranks), Array.from({length:384}, (_, i) => i));
  }
  assert.equal(positions.size, 8);
});
test('single-page collections also vary across sessions without losing products', () => {
  const a = session(new Map(), 3)(1, 12), b = session(new Map(), 987)(1, 12);
  const ranks = plan => Array.from({length:12}, (_, i) => plan.rank(1, i));
  assert.notDeepEqual(ranks(a), ranks(b));
  assert.equal(new Set(ranks(a)).size, 12);
});
test('build ordering ignores source order and dates, spreads brands, and includes imports', () => {
  const products = Array.from({length:240}, (_, i) => ({slug:`product-${i}`,brand_slug:`brand-${i % 12}`,created_at:'2020-01-01'}));
  const result = discoveryProducts(products);
  assert.deepEqual(discoveryProducts([...products].reverse().map(p => ({...p, created_at:'2030-01-01'}))).map(p => p.slug), result.map(p => p.slug));
  for (let i = 0; i < 48; i++) {
    assert.equal(new Set(result.slice(i, i+5).map(p => p.brand_slug)).size, 5);
  }
  const imported = {slug:'new-import',brand_slug:'new-brand',created_at:'2035-01-01'};
  const updated = discoveryProducts([...products, imported]);
  assert.equal(new Set(updated.map(p => p.slug)).size, 241);
  assert.ok(updated.includes(imported));
  assert.equal(products[0].slug, 'product-0');
});
