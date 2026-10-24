import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('both Vercel roots keep Git synchronization separate from deployments', () => {
  for (const file of ['vercel.json', 'admin-app/vercel.json']) {
    const config=JSON.parse(fs.readFileSync(file,'utf8'));
    assert.equal(config.git.deploymentEnabled, false, 'Both preview pushes and main merges must leave the live hotfix untouched');
    assert.equal(config.ignoreCommand,undefined,'Existing project guards must not be overridden');
  }
});
