import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/pages/partnyori.astro', import.meta.url), 'utf8');
const validation = source.slice(source.indexOf(' const presenceFields='), source.indexOf(' form.addEventListener("submit",async e=>'));
for (const [name, values, invalid] of [
  ['empty', ['', '', ''], true],
  ['whitespace', [' ', ' ', ' '], true],
  ['website only', ['https://example.com', '', ''], false],
  ['Instagram only', ['', 'https://instagram.com/test', ''], false],
  ['Facebook only', ['', '', 'https://facebook.com/test'], false],
  ['all three', ['https://example.com', 'https://instagram.com/test', 'https://facebook.com/test'], false],
  ['malformed optional URL', ['https://example.com', '', 'https://'], true],
]) {
  test(`client web presence: ${name}`, () => {
    const fields = Object.fromEntries(['website', 'instagram', 'facebook'].map((key, i) => [key, {
      value: values[i], error: '', setCustomValidity(message) { this.error = message; }, addEventListener() {},
    }]));
    runInNewContext(validation + '\nvalidatePresence();', { form: { elements: { namedItem: key => fields[key] } }, URL });
    assert.equal(Object.values(fields).some(field => !!field.error), invalid);
  });
}
