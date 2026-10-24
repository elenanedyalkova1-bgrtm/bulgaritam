import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { atomicUploadCommands, createIncrementalPlan, ensureRemoteDirectoryCommands, writeLftpCommands, deploymentPhases, verifyDeploymentPhase } from "../scripts/plan-incremental-ftps-deploy.mjs";

const response = (body, status = 200) => new Response(body, { status });

function simulateDirectoryGuard(commands, { directoryExists, mkdirSucceeds }) {
  let previousSucceeded = true;
  for (const command of commands) {
    if (command.startsWith("cd ") && command.includes(" || mkdir ")) {
      previousSucceeded = directoryExists || mkdirSucceeds;
      continue;
    }
    if (!previousSucceeded) throw new Error("lftp cmd:fail-exit");
    previousSucceeded = true;
  }
}

test("remote directory guard proceeds when the directory already exists", () => {
  const commands = ensureRemoteDirectoryCommands("/brand/160-candles");
  assert.deepEqual(commands, [
    'cd "/brand/160-candles" || mkdir -p "/brand/160-candles"',
    'cd "/"',
  ]);
  assert.doesNotThrow(() => simulateDirectoryGuard(commands, { directoryExists: true, mkdirSucceeds: false }));
});

test("remote directory guard fails when an absent directory cannot be created", () => {
  const commands = ensureRemoteDirectoryCommands("/brand/forbidden");
  assert.throws(
    () => simulateDirectoryGuard(commands, { directoryExists: false, mkdirSucceeds: false }),
    /lftp cmd:fail-exit/,
  );
});

test("changed file uses lftp 4.9.2 local-first put syntax then atomic rename", () => {
  const commands = atomicUploadCommands(
    "dist/bizhuta-s-hematit/index.html",
    "/bizhuta-s-hematit/index.html.upload-9",
    "/bizhuta-s-hematit/index.html",
  );
  assert.deepEqual(commands, [
    'put "dist/bizhuta-s-hematit/index.html" -o "/bizhuta-s-hematit/index.html.upload-9"',
    'mv "/bizhuta-s-hematit/index.html.upload-9" "/bizhuta-s-hematit/index.html"',
  ]);
  assert.doesNotMatch(commands.join("\n"), /(?:^|\n)(?:rm|rm -f) .*bizhuta-s-hematit\/index\.html(?:$|\n)/);
});

test("failed temporary upload stops before rename and never deletes the valid final file", () => {
  const commands = atomicUploadCommands("dist/index.html", "/index.html.upload-9", "/index.html");
  const executed = [];
  assert.throws(() => {
    for (const command of commands) {
      if (executed.length && executed.at(-1) === "failed") throw new Error("lftp cmd:fail-exit");
      executed.push(command.startsWith("put ") ? "failed" : command);
    }
  }, /lftp cmd:fail-exit/);
  assert.deepEqual(executed, ["failed"]);
  assert.equal(commands.some(command => command.startsWith("rm ") || command.startsWith("rm -f ")), false);
});

test("incremental plan hashes remote content, uploads only differences and deletes only stale generated routes", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "deploy-plan-"));
  fs.mkdirSync(path.join(root, "p", "current"), { recursive: true }); fs.mkdirSync(path.join(root, "_astro"), { recursive: true });
  fs.writeFileSync(path.join(root, "index.html"), "same"); fs.writeFileSync(path.join(root, "_astro", "app.svg"), "new-js");
  fs.writeFileSync(path.join(root, ".htaccess"), "hosting-owned");
  fs.writeFileSync(path.join(root, "p", "current", "index.html"), "new-page");
  fs.writeFileSync(path.join(root, "deploy-manifest.json"), JSON.stringify({ commit: "abc", product_paths: ["/p/current/"], brand_paths: [] }));
  const remote = new Map([["/index.html", "same"], ["/_astro/app.svg", "old-js"], ["/p/current/index.html", "new-page"],
    ["/deploy-manifest.json", JSON.stringify({ product_paths: ["/p/current/", "/p/stale/"], brand_paths: [] })]]);
  const fetchImpl = async url => remote.has(new URL(url).pathname) ? response(remote.get(new URL(url).pathname)) : response("", 404);
  const plan = await createIncrementalPlan({ distDir: root, origin: "https://example.test", fetchImpl, concurrency: 2 });
  assert.deepEqual(plan.changed, ["_astro/app.svg", "deploy-manifest.json"]); assert.deepEqual(plan.new, []);
  assert.ok(plan.unchanged.includes("index.html")); assert.ok(plan.unchanged.includes("p/current/index.html"));
  assert.deepEqual(plan.stale, ["p/stale/index.html"]);
  assert.equal(plan.unchanged.includes(".htaccess"), false);
  const commands = path.join(root, "commands.lftp"); const state = path.join(root, "state.json");
  writeLftpCommands(plan, { distDir: root, output: commands, stateOutput: state, runId: "7" });
  const script = fs.readFileSync(commands, "utf8");
  assert.match(script, /app\.svg\.upload-7/); assert.doesNotMatch(script, /put .*index\.html\.upload-7.*index\.html/);
  assert.match(script, /rm -f "\/p\/stale\/index\.html"/); assert.doesNotMatch(script, /mirror --delete|rm -rf/);
});

test("trusted completed state makes a second identical run upload nothing", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "deploy-idempotent-")); fs.writeFileSync(path.join(root, "index.html"), "same");
  fs.writeFileSync(path.join(root, "deploy-manifest.json"), JSON.stringify({ commit: "abc", product_paths: [], brand_paths: [] }));
  const firstFetch = async url => new URL(url).pathname === "/deploy-manifest.json" ? response(fs.readFileSync(path.join(root, "deploy-manifest.json"))) : response(new URL(url).pathname === "/index.html" ? "same" : "", new URL(url).pathname === "/index.html" ? 200 : 404);
  const first = await createIncrementalPlan({ distDir: root, origin: "https://example.test", fetchImpl: firstFetch });
  const secondFetch = async url => new URL(url).pathname === "/.bulgaritam-deploy-state.json" ? response(JSON.stringify(first.state)) : response(fs.readFileSync(path.join(root, new URL(url).pathname)));
  const second = await createIncrementalPlan({ distDir: root, origin: "https://example.test", fetchImpl: secondFetch });
  assert.equal(second.used_remote_state, true); assert.equal(second.changed.length, 0); assert.equal(second.new.length, 0); assert.equal(second.stale.length, 0);
  assert.equal(second.unchanged.length, second.total);
});

function fixturePlan() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-phases-'));
  const files = {'index.html':'new HTML', 'page/2/index.html':'new page', '_astro/new.hash1234.js':'new JS', '_astro/style.hash1234.css':'new CSS', 'images/hero.svg':'new image', 'deploy-manifest.json':'{}'};
  for (const [file,bytes] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),bytes); }
  return {root,files};
}

test('new JS/CSS and replaced non-code assets precede every document; manifest/state finalize last',()=>{
 const {root}=fixturePlan();const plan={changed:['index.html','images/hero.svg','deploy-manifest.json'],new:['page/2/index.html','_astro/new.hash1234.js','_astro/style.hash1234.css'],stale:['p/stale/index.html'],state:{files:{}}};
 assert.deepEqual(deploymentPhases(plan),{assets:['_astro/new.hash1234.js','_astro/style.hash1234.css','images/hero.svg'],documents:['index.html','page/2/index.html'],finalize:['deploy-manifest.json']});
 for(const phase of ['assets','documents','finalize']){
  const output=path.join(root,phase+'.lftp');writeLftpCommands(plan,{distDir:root,output,stateOutput:path.join(root,'state.json'),phase});const script=fs.readFileSync(output,'utf8');
  if(phase==='assets'){assert.match(script,/new\.hash1234\.js/);assert.doesNotMatch(script,/index\.html|deploy-manifest|rm -f/);}
  if(phase==='documents')assert.doesNotMatch(script,/_astro|deploy-manifest|bulgaritam-deploy-state|rm -f/);
  if(phase==='finalize'){assert.ok(script.indexOf('rm -f')<script.indexOf('deploy-manifest.json'));assert.ok(script.indexOf('deploy-manifest.json')<script.indexOf('bulgaritam-deploy-state'));assert.doesNotMatch(script,/rm -f .*_astro/);}
 }
});

test('same cached JS/CSS URL cannot be replaced with different code bytes',async()=>{
 for(const file of ['_astro/app.hash1234.js','_astro/style.hash1234.css','product-discovery.js']){
  const {root}=fixturePlan();fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),'new bytes');
  await assert.rejects(createIncrementalPlan({distDir:root,origin:'https://example.test',fetchImpl:async url=>new URL(url).pathname==='/'+file?response('old bytes'):response('',404)}),/fingerprint\/version/);
 }
});

test('completed state is not trusted after partial document failure; rollback probes actual bytes',async()=>{
 const {root}=fixturePlan();const first=await createIncrementalPlan({distDir:root,origin:'https://example.test',fetchImpl:async()=>response('',404)});
 const remote=new Map(Object.entries(fixturePlan().files).map(([f,v])=>['/'+f,v]));remote.set('/index.html','partially published different HTML');remote.set('/.bulgaritam-deploy-state.json',JSON.stringify(first.state));
 const rollback=await createIncrementalPlan({distDir:root,origin:'https://example.test',fetchImpl:async url=>response(remote.get(new URL(url).pathname))});
 assert.ok(rollback.changed.includes('index.html'));assert.ok(rollback.unchanged.includes('_astro/new.hash1234.js'));
});

test('verification checks canonical served bytes, rejects stale HTTP200/404 and changed local input',async()=>{
 const {root,files}=fixturePlan();const plan=await createIncrementalPlan({distDir:root,origin:'https://example.test',fetchImpl:async()=>response('',404)});
 const served=async url=>response(files[new URL(url).pathname.slice(1)]);
 assert.equal((await verifyDeploymentPhase(plan,'assets',{distDir:root,fetchImpl:served})).verified,3);
 assert.equal((await verifyDeploymentPhase(plan,'documents',{distDir:root,fetchImpl:served})).verified,2);
 await assert.rejects(verifyDeploymentPhase(plan,'assets',{distDir:root,fetchImpl:async()=>response('stale cached content')}),/verification failed/);
 await assert.rejects(verifyDeploymentPhase(plan,'assets',{distDir:root,fetchImpl:async()=>response('',404)}),/verification failed/);
 fs.writeFileSync(path.join(root,'_astro/new.hash1234.js'),'changed after plan');
 await assert.rejects(verifyDeploymentPhase(plan,'assets',{distDir:root,fetchImpl:served}),/Local file changed/);
});

test('asset upload or byte-verification failure prevents document and marker publication',async()=>{
 const {root}=fixturePlan();const plan=await createIncrementalPlan({distDir:root,origin:'https://example.test',fetchImpl:async()=>response('',404)});let documentsPublished=false,markerPublished=false;
 async function pipeline(upload){await upload();await verifyDeploymentPhase(plan,'assets',{distDir:root,fetchImpl:async()=>response('bad cached bytes')});documentsPublished=true;markerPublished=true;}
 await assert.rejects(pipeline(async()=>{throw Error('temporary upload failed');}),/upload failed/);assert.equal(documentsPublished,false);assert.equal(markerPublished,false);
 await assert.rejects(pipeline(async()=>{}),/verification failed/);assert.equal(documentsPublished,false);assert.equal(markerPublished,false);
});

test('workflow uses separate verified phases rather than executing the combined compatibility script',()=>{
 const workflow=fs.readFileSync(new URL('../.github/workflows/publish-public.yml',import.meta.url),'utf8');
 const phases=['source /tmp/deploy-assets.lftp','--verify-phase=assets','source /tmp/deploy-documents.lftp','--verify-phase=documents','source /tmp/deploy-finalize.lftp'];
 const positions=phases.map(s=>workflow.indexOf(s));assert.ok(positions.every(i=>i>=0));assert.deepEqual(positions,[...positions].sort((a,b)=>a-b));assert.doesNotMatch(workflow,/source \/tmp\/incremental-deploy\.lftp/);
});

test('even an invalid supplied plan cannot delete retained cached code assets',()=>{
 const {root}=fixturePlan();const plan={changed:[],new:[],stale:['_astro/old.hash1234.js'],state:{files:{}}};
 assert.throws(()=>writeLftpCommands(plan,{distDir:root,output:path.join(root,'bad.lftp'),stateOutput:path.join(root,'state.json')}),/retain cached assets/);
});

test('partial upload of changed same-URL code cannot disguise a cache-incompatible replacement',async()=>{
 const {root,files}=fixturePlan();const first=await createIncrementalPlan({distDir:root,origin:'https://example.test',fetchImpl:async()=>response('',404)});
 fs.writeFileSync(path.join(root,'_astro/new.hash1234.js'),'different JS at same URL');
 await assert.rejects(createIncrementalPlan({distDir:root,origin:'https://example.test',fetchImpl:async url=>new URL(url).pathname==='/.bulgaritam-deploy-state.json'?response(JSON.stringify(first.state)):response(new URL(url).pathname==='/_astro/new.hash1234.js'?'different JS at same URL':files[new URL(url).pathname.slice(1)])}),/fingerprint\/version/);
});

test('previously tracked legacy icons remain available for cached clients and rollback', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-retain-legacy-icons-'));
  fs.writeFileSync(path.join(root, 'deploy-manifest.json'), '{}');
  const tracked = { version: 1, files: {
    'favicon.png': 'old', 'favicon-48x48.png': 'old', 'mstile-150x150.png': 'old',
    '.htaccess': 'protected', 'unrelated.png': 'protected',
  } };
  const plan = await createIncrementalPlan({ distDir: root, origin: 'https://example.test', fetchImpl: async url =>
    new URL(url).pathname === '/.bulgaritam-deploy-state.json' ? response(JSON.stringify(tracked)) : response('', 404) });
  assert.deepEqual(plan.stale, []);
  const output = path.join(root, 'finalize.lftp');
  writeLftpCommands(plan, { distDir: root, output, stateOutput: path.join(root, 'state.json'), phase: 'finalize' });
  assert.doesNotMatch(fs.readFileSync(output, 'utf8'), /^rm /m);
});
