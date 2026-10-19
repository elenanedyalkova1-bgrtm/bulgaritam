import assert from 'node:assert/strict';
import test from 'node:test';
import { DEAL_MAX_AGE_MS, observationIsFresh, timestamp, validateDealsPayload } from '../src/lib/consumer-deals-client.mjs';
import { now, deal, internalDeal, payload } from './fixtures/consumer-deals.mjs';

test('accepts current internal/external deals and valid empty results', () => {
  const result = validateDealsPayload(payload([deal(), internalDeal]), now);
  assert.equal(result.deals[1].destination_url, '/p/test-product/');
  assert.equal(result.deals[0].current_price, 40);
  assert.deepEqual(validateDealsPayload(payload([]), now).deals, []);
});
test('enforces exact 72-hour cutoff, including cached snapshots', () => {
  assert.equal(observationIsFresh(new Date(now - DEAL_MAX_AGE_MS + 1).toISOString(), now), true);
  assert.equal(observationIsFresh(new Date(now - DEAL_MAX_AGE_MS).toISOString(), now), false);
  assert.equal(validateDealsPayload(payload([deal(1, { latest_checked_at: new Date(now - DEAL_MAX_AGE_MS).toISOString() })]), now).deals.length, 0);
});
for (const [label, overrides] of Object.entries({
  stale: { stale: true }, missingStale: { stale: undefined }, wrongVersion: { version: 2 }, wrongCount: { count: 12 },
  invalidDate: { generated_at: 'not-a-date' }, staleGeneration: { generated_at: new Date(now - DEAL_MAX_AGE_MS).toISOString() },
  futureGeneration: { generated_at: new Date(now + 300_001).toISOString() },
})) test(`rejects ${label} snapshots`, () => assert.throws(() => validateDealsPayload(payload([deal()], overrides), now)));
for (const [label, overrides] of Object.entries({
  stringPrice: { current_price: '40' }, zero: { current_price: 0 }, negative: { current_price: -1 }, infinite: { current_price: Infinity },
  reversed: { regular_price: 30 }, inconsistentPercent: { discount_percent: 80 }, fakeCurrency: { currency: 'XYZ' },
  badDate: { latest_checked_at: '2026-02-31T09:00:00.000Z' }, future: { latest_checked_at: new Date(now + 300_001).toISOString() },
  script: { destination_url: 'javascript:alert(1)' }, protocolRelative: { destination_url: '//evil.test/path' },
  credentials: { outbound_url: 'https://secret:token@brand.test/product' }, backslash: { image_url: 'https://brand.test\\@evil.test/a' },
  internalEscape: { destination_type: 'internal', internal_slug: '../admin', destination_url: '/p/../admin/' },
})) test(`rejects invalid deal: ${label}`, () => assert.throws(() => validateDealsPayload(payload([deal(1, overrides)]), now)));
test('rejects an entire malformed batch, duplicates, and mismatched internal slug', () => {
  assert.throws(() => validateDealsPayload(payload([deal(), deal()]), now));
  assert.throws(() => validateDealsPayload(payload([deal(), { ...internalDeal, destination_url: '/p/other/' }]), now));
  assert.ok(Number.isNaN(timestamp('2026-02-31T09:00:00.000Z')));
});

test('existing HTTP merchant links stay valid and HTTP images upgrade without source mutation', () => {
  const raw = deal(1, { image_url: 'http://brand.test/image.jpg', destination_url: 'http://brand.test/product/1', outbound_url: 'http://brand.test/product/1' });
  const result = validateDealsPayload(payload([raw]), now).deals[0];
  assert.equal(result.image_url, 'https://brand.test/image.jpg');
  assert.equal(result.destination_url, raw.destination_url);
  assert.equal(raw.image_url, 'http://brand.test/image.jpg');
});
