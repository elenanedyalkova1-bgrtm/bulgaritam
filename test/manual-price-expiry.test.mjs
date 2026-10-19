import test from 'node:test';
import assert from 'node:assert/strict';
import { referenceIsFresh, initializeManualPriceGates } from '../src/scripts/manual-price-expiry.mjs';
const verified = '2026-01-01T00:00:00.000Z';
const expiry = new Date(Date.parse(verified) + 90 * 86400000).toISOString();
test('manual reference retains inclusive 90-day boundary and rejects malformed/future/extended dates', () => {
  const boundary = Date.parse(expiry);
  assert.equal(referenceIsFresh(verified, expiry, boundary), true);
  assert.equal(referenceIsFresh(verified, expiry, boundary + 1), false);
  assert.equal(referenceIsFresh(verified, expiry, Date.parse(verified) - 1), false);
  assert.equal(referenceIsFresh('bad', expiry, boundary), false);
  assert.equal(referenceIsFresh(verified, 'bad', boundary), false);
  assert.equal(referenceIsFresh(verified, new Date(boundary + 1).toISOString(), boundary), false);
});
test('runtime removes expired reference and restores fallback without a new build', () => {
  const originalNow = Date.now;
  let now = Date.parse(expiry), scheduled;
  const live = {childElementCount: 0, append() {this.childElementCount=1;}, replaceChildren() {this.childElementCount=0;}};
  const fallback = {hidden:false};
  const gate = {dataset:{verifiedAt:verified,expiresAt:expiry},querySelector:s=>s.includes('-live')?live:s.includes('-fallback')?fallback:{content:{cloneNode:()=>({})}}};
  const listeners = {};
  const doc = {hidden:false,querySelectorAll:()=>[gate],addEventListener:(n,f)=>listeners[n]=f};
  const win = {clearTimeout(){},setTimeout(fn,ms){scheduled={fn,ms};},addEventListener:(n,f)=>listeners[n]=f};
  try {
    Date.now=()=>now;
    initializeManualPriceGates(doc,win);
    assert.equal(live.childElementCount,1); assert.equal(fallback.hidden,true); assert.equal(scheduled.ms,1);
    now++; scheduled.fn();
    assert.equal(live.childElementCount,0); assert.equal(fallback.hidden,false);
    now--; listeners.pageshow(); assert.equal(live.childElementCount,1);
    doc.hidden=true; listeners.visibilitychange(); assert.equal(live.childElementCount,0);
    doc.hidden=false; now++; listeners.visibilitychange(); assert.equal(fallback.hidden,false);
  } finally {Date.now=originalNow;}
});
