import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');
function pngSize(bytes) {
  assert(bytes.subarray(0, 8).equals(pngSignature), 'Expected a PNG signature');
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
}
function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? htmlFiles(file) : entry.name.endsWith('.html') ? [file] : [];
  });
}

export function verifyBranding(dist = 'dist') {
  const readAsset = (url) => {
    const bytes = fs.readFileSync(path.join(dist, url.replace(/^\//, '')));
    assert(bytes.length > 0, `Empty asset: ${url}`);
    return bytes;
  };
  for (const [name, size] of [['favicon-192x192.png', 192], ['favicon-512x512.png', 512], ['apple-touch-icon.png', 180]]) {
    assert.deepEqual(pngSize(readAsset(name)), [size, size], name);
  }
  assert.deepEqual(pngSize(readAsset('social-preview.png')), [1200, 630]);
  const svg = readAsset('favicon.svg').toString();
  assert.match(svg, /<svg\b/);
  assert.match(svg, /<path\b/);
  assert.doesNotMatch(svg, /<image\b|data:image|<script\b/i);
  assert.match(svg, /viewBox="0 0 1080 1080"/);
  const ico = readAsset('favicon.ico');
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1, 'Expected an ICO container');
  assert.equal(ico.readUInt16LE(4), 3);
  [16, 32, 48].forEach((size, i) => {
    const entry = 6 + i * 16;
    assert.equal(ico[entry], size);
    assert.equal(ico[entry + 1], size);
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    assert(offset >= 54 && offset + length <= ico.length, 'Invalid ICO frame bounds');
    assert.deepEqual(pngSize(ico.subarray(offset, offset + length)), [size, size]);
  });
  const manifest = JSON.parse(readAsset('site.webmanifest'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#F0ECE5');
  assert.equal(manifest.background_color, '#F0ECE5');
  assert.deepEqual(manifest.icons.map(({ src, sizes, type }) => ({ src, sizes, type })), [
    { src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: '/favicon-512x512.png', sizes: '512x512', type: 'image/png' },
  ]);
  for (const icon of manifest.icons) readAsset(icon.src);
  for (const obsolete of ['favicon.png', 'favicon-48x48.png', 'mstile-150x150.png']) {
    assert(!fs.existsSync(path.join(dist, obsolete)), `Obsolete asset remains: ${obsolete}`);
  }
  const expected = [
    { rel: 'icon', type: 'image/x-icon', sizes: '16x16 32x32 48x48', href: '/favicon.ico' },
    { rel: 'icon', type: 'image/svg+xml', sizes: 'any', href: '/favicon.svg' },
    { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/favicon-192x192.png' },
    { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
    { rel: 'manifest', href: '/site.webmanifest' },
  ];
  const files = htmlFiles(dist);
  assert(files.length > 0, 'No generated HTML found');
  let defaultSocialPages = 0;
  let organizationLogos = 0;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const head = html.split('</head>')[0];
    const links = [...head.matchAll(/<link\b[^>]*>/g)].map(([tag]) => attributes(tag));
    const icons = links.filter(({ rel }) => /icon|manifest/.test(rel || ''));
    assert.deepEqual(icons, expected, `${file}: favicon declarations`);
    for (const icon of icons) readAsset(icon.href);
    assert.doesNotMatch(head, /msapplication|mstile|favicon-48x48|favicon\.png/, file);
    const metas = [...head.matchAll(/<meta\b[^>]*>/g)].map(([tag]) => attributes(tag));
    assert.deepEqual(metas.filter(({ name }) => name === 'theme-color'), [{ name: 'theme-color', content: '#F0ECE5' }]);
    const og = metas.find(({ property }) => property === 'og:image');
    const twitter = metas.find(({ name }) => name === 'twitter:image');
    if (og) {
      assert.equal(og.content, twitter?.content, `${file}: OG/Twitter mismatch`);
      if (new URL(og.content).pathname === '/social-preview.png') {
        defaultSocialPages++;
        assert.equal(metas.find(({ property }) => property === 'og:image:width')?.content, '1200');
        assert.equal(metas.find(({ property }) => property === 'og:image:height')?.content, '630');
      }
    }
    for (const [, json] of head.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)) {
      const visit = (value) => {
        if (!value || typeof value !== 'object') return;
        if (value['@type'] === 'Organization' && value.name === 'Българитъм') {
          assert.equal(new URL(value.logo).pathname, '/favicon-192x192.png');
          readAsset('/favicon-192x192.png');
          organizationLogos++;
        }
        Object.values(value).forEach(visit);
      };
      visit(JSON.parse(json));
    }
    if (html.includes('class="topbar"')) {
      const logo = html.match(/<a\b[^>]*class="brand-logo"[^>]*>(.*?)<\/a>/s);
      assert(logo, `${file}: missing header logo`);
      assert.match(logo[0], /href="\/"/);
      assert.match(logo[0], /aria-label="Българитъм – начало"/);
      assert.match(logo[1], /src="\/favicon.svg"/);
      assert.match(logo[1], /width="44" height="44" alt=""/);
    }
  }
  assert(defaultSocialPages > 0 && organizationLogos > 0);
  return { pages: files.length, defaultSocialPages, organizationLogos, icons: 'valid' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(verifyBranding(process.argv[2] || 'dist')));
}
