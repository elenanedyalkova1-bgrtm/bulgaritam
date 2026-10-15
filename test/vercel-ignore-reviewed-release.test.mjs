import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { shouldIgnoreReviewedRelease } from '../scripts/vercel-ignore-reviewed-release.mjs';

function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function commit(cwd, message) {
  git(cwd, 'add', '.');
  git(cwd, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', message);
  return git(cwd, 'rev-parse', 'HEAD');
}

function createFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'vercel-ignore-reviewed-release-'));
  git(root, 'init', '-b', 'main');
  mkdirSync(path.join(root, 'admin-app'), { recursive: true });
  mkdirSync(path.join(root, 'scripts'), { recursive: true });
  writeFileSync(path.join(root, 'public.txt'), 'base\n');
  writeFileSync(path.join(root, 'admin-app', 'admin.txt'), 'base\n');
  const baseSha = commit(root, 'base');

  git(root, 'switch', '-c', 'release');
  writeFileSync(path.join(root, 'scripts', 'monitor.mjs'), 'export const fixed = true;\n');
  const releaseSha = commit(root, 'release');
  const expectedChanges = ['A\tscripts/monitor.mjs'];

  return { root, baseSha, releaseSha, expectedChanges };
}

function classify(fixture, cwd = fixture.root) {
  return shouldIgnoreReviewedRelease({
    cwd,
    baseSha: fixture.baseSha,
    releaseSha: fixture.releaseSha,
    expectedChanges: fixture.expectedChanges,
  });
}

test('ignores the exact reviewed release from repository and admin roots', () => {
  const fixture = createFixture();
  assert.equal(classify(fixture), true);
  assert.equal(classify(fixture, path.join(fixture.root, 'admin-app')), true);
});

test('ignores only an exact two-parent merge with the reviewed release tree', () => {
  const fixture = createFixture();
  git(fixture.root, 'switch', 'main');
  git(fixture.root, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
    'merge', '--no-ff', '--no-edit', fixture.releaseSha);
  assert.equal(classify(fixture), true);
});

for (const [name, relativePath] of [
  ['public', 'public.txt'],
  ['admin', 'admin-app/admin.txt'],
  ['unknown', 'unknown.txt'],
]) {
  test(`builds for a future ${name} change`, () => {
    const fixture = createFixture();
    writeFileSync(path.join(fixture.root, relativePath), `${name} change\n`);
    commit(fixture.root, `${name} change`);
    assert.equal(classify(fixture), false);
  });
}

test('builds when Git history or the comparison base is unavailable', () => {
  const fixture = createFixture();
  assert.equal(shouldIgnoreReviewedRelease({
    cwd: fixture.root,
    baseSha: '0'.repeat(40),
    releaseSha: fixture.releaseSha,
    expectedChanges: fixture.expectedChanges,
  }), false);
  assert.equal(shouldIgnoreReviewedRelease({
    cwd: tmpdir(),
    baseSha: fixture.baseSha,
    releaseSha: fixture.releaseSha,
    expectedChanges: fixture.expectedChanges,
  }), false);
});

test('builds for an altered approved manifest', () => {
  const fixture = createFixture();
  assert.equal(shouldIgnoreReviewedRelease({
    cwd: fixture.root,
    baseSha: fixture.baseSha,
    releaseSha: fixture.releaseSha,
    expectedChanges: ['M\tpublic.txt'],
  }), false);
});
