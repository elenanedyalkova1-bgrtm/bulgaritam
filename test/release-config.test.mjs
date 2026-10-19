import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('both Vercel roots disable Git deployment only for the preparation branch', () => {
  for (const file of ['vercel.json', 'admin-app/vercel.json']) {
    const config=JSON.parse(fs.readFileSync(file,'utf8'));
    assert.deepEqual(config.git.deploymentEnabled, {'codex/consolidated-production-release':false});
    assert.equal(config.ignoreCommand,undefined,'Existing project guards must not be overridden');
  }
});
