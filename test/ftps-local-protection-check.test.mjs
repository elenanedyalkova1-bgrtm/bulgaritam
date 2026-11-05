import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('each FTPS phase downloads protected hosting config to its own local file',()=>{
 const workflow=fs.readFileSync(new URL('../.github/workflows/publish-public.yml',import.meta.url),'utf8');
 const destinations=[...workflow.matchAll(/get \/\.htaccess -o (\/tmp\/[^\s]+)/g)].map(match=>match[1]);
 assert.equal(destinations.length,3);
 assert.equal(new Set(destinations).size,3,'lftp refuses to overwrite an earlier phase local file');
 assert.ok(destinations.includes('/tmp/live-htaccess'));
 assert.match(workflow,/run: test -s \/tmp\/live-htaccess/);
 assert.doesNotMatch(workflow,/(?:put|rm|mv)[^\n]*\/\.htaccess/,'remote protected config must not be written or removed');
});
