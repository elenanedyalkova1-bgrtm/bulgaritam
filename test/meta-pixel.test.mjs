import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const component = readFileSync(new URL('../src/components/MetaPixel.astro', import.meta.url), 'utf8');
const script = component.match(/<script is:inline>([\s\S]*?)<\/script>/)[1];
const layout = readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
const bootstrap = layout.match(/<script is:inline>([\s\S]*?)<\/script>/)[1];

function setup({ stored = null, excluded = false, blockedStorage = false } = {}) {
  const scripts = [], listeners = new Map();
  const document = {
    cookie: excluded ? 'bulgaritam_analytics_excluded=1' : '',
    documentElement: { dataset: {} },
    createElement: () => ({}),
    getElementsByTagName: () => [{ parentNode: { insertBefore: node => scripts.push(node) } }],
  };
  const window = {
    localStorage: { getItem() { if (blockedStorage) throw Error('Storage blocked'); return stored; } },
    addEventListener(name, fn) { listeners.set(name, [...(listeners.get(name) || []), fn]); },
  };
  const context = { window, document };
  runInNewContext(bootstrap, context);
  runInNewContext(script, context);
  return {
    scripts, window, context,
    consent(analytics) { window.__cookieConsent = { analytics }; for (const fn of listeners.get('cookie-consent')) fn(); },
    calls() { return Array.from(window.fbq?.queue || [], args => Array.from(args)); },
  };
}

test('unknown, rejected, corrupt or inaccessible consent sends no Meta request', () => {
  for (const options of [{}, { stored: '{"analytics":false}' }, { stored: 'broken' }, { blockedStorage: true }]) {
    const h = setup(options); h.consent(false);
    assert.equal(h.scripts.length, 0); assert.equal(h.window.fbq, undefined);
  }
});
test('saved acceptance loads official SDK once with exact ID and only PageView', () => {
  const h = setup({ stored: '{"analytics":true}' });
  h.consent(true); h.consent(true); runInNewContext(script, h.context);
  assert.equal(h.scripts.length, 1);
  assert.equal(h.scripts[0].src, 'https://connect.facebook.net/en_US/fbevents.js');
  assert.deepEqual(h.calls(), [
    ['set', 'autoConfig', false, '1994579961234776'],
    ['init', '1994579961234776'], ['consent', 'grant'], ['track', 'PageView'],
  ]);
});
test('accept then revoke/regrant does not duplicate PageView, even before SDK download', () => {
  const h = setup(); h.consent(true); h.consent(false); h.consent(false); h.consent(true);
  assert.equal(h.scripts.length, 1);
  assert.deepEqual(h.calls().filter(c => c[0] === 'consent'), [['consent', 'grant'], ['consent', 'revoke'], ['consent', 'grant']]);
  assert.equal(h.calls().filter(c => c[0] === 'track').length, 1);
});
test('internal traffic exclusion wins over saved and newly granted consent', () => {
  const h = setup({ stored: '{"analytics":true}', excluded: true }); h.consent(true);
  assert.equal(h.scripts.length, 0); assert.equal(h.window.fbq, undefined);
});
test('each full document navigation sends its own single PageView', () => {
  for (let i = 0; i < 3; i++) {
    const h = setup({ stored: '{"analytics":true}' }); h.consent(true);
    assert.equal(h.calls().filter(c => c[0] === 'track').length, 1);
  }
});
test('component is in global head after consent bootstrap with no noscript bypass', () => {
  assert.ok(layout.indexOf('<MetaPixel />') > layout.indexOf('window.__cookieConsent ='));
  assert.ok(layout.indexOf('<MetaPixel />') < layout.indexOf('</head>'));
  assert.doesNotMatch(component, /<noscript|<img|facebook\.com\/tr/);
});
