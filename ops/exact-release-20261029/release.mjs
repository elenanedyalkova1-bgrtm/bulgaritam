import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createIncrementalPlan,writeLftpCommands,verifyDeploymentPhase} from '../../scripts/plan-incremental-ftps-deploy.mjs';
const dir=path.dirname(new URL(import.meta.url).pathname);
const work=path.resolve(process.env.RELEASE_WORK || '.exact-release');
const dist=path.join(work,'dist');
const origin='https://bulgaritam.bg';
const commit='b629cd7d1a5a30e2efc9063128e773d8e49888da';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const save=(name,value)=>fs.writeFileSync(path.join(work,name),JSON.stringify(value,null,2)+'\n');
const approved=read(path.join(dir,'incremental-plan.json'));
const evidence=read(path.join(dir,'artifact-final-verification.json'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const request=async(url)=>{
 const r=await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(60000)});
 assert(r.ok,`HTTP ${r.status}: ${url}`);return r;
};
async function each(items,worker,limit=10){let cursor=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(cursor<items.length){const i=cursor++;await worker(items[i]);}}));}
async function stale(){
 assert.equal(evidence.stale_rows.length,22);
 assert.deepEqual(evidence.stale_rows.map(x=>x.path).sort(),approved.stale);
 assert(process.env.BASEROW_API_TOKEN,'Baserow read access required');
 const results=[];
 await each(evidence.stale_rows,async x=>{
  const r=await fetch(`https://api.baserow.io/api/database/rows/table/906650/${x.id}/?user_field_names=true`,{headers:{Authorization:`Token ${process.env.BASEROW_API_TOKEN}`},signal:AbortSignal.timeout(60000)});
  assert(r.ok,`Baserow GET ${x.id}: HTTP ${r.status}`);const row=await r.json();
  assert.equal(row.id,x.id);assert.equal(row.slug,x.path.split('/')[1]);
  assert.equal(row.is_active,x.is_active,`Inactive value changed for ${x.id}`);
  assert.equal(row.is_active,'false');
  results.push({id:row.id,path:x.path,is_active:row.is_active});
 },4);
 save('stale-readcheck.json',{checked_at:new Date().toISOString(),count:results.length,items:results.sort((a,b)=>a.id-b.id)});
 console.log('PASS: exact 22 approved products remain inactive; GET only.');
}
async function preflight(){
 fs.mkdirSync(work,{recursive:true});
 const manifest=read(path.join(dist,'deploy-manifest.json'));assert.equal(manifest.commit,commit);
 assert.equal(hash(fs.readFileSync(path.join(dist,'index.html'))),manifest.index_sha256);
 for(const name of ['live-state-before.json','live-manifest-before.json']){
  const remote=name.includes('state')?'/.bulgaritam-deploy-state.json':'/deploy-manifest.json';
  const actual=Buffer.from(await(await request(origin+remote)).arrayBuffer());
  assert.equal(hash(actual),hash(fs.readFileSync(path.join(dir,name))),`Origin baseline changed: ${remote}`);
 }
 const fresh=await createIncrementalPlan({distDir:dist,origin,concurrency:12});
 for(const key of ['origin','used_remote_state','total','unchanged','changed','new','stale'])assert.deepEqual(fresh[key],approved[key],`Plan changed: ${key}`);
 assert.deepEqual(fresh.state.files,approved.state.files,'Artifact file hashes changed');
 const rollback=await createIncrementalPlan({distDir:path.join(work,'rollback'),origin,concurrency:12});
 assert.equal(rollback.total,1790);assert.equal(rollback.unchanged.length,1790);
 for(const key of ['changed','new','stale'])assert.equal(rollback[key].length,0,`Rollback baseline differs: ${key}`);
 save('rollback-origin-check.json',{checked_at:new Date().toISOString(),verified:1790});
 await stale();
 // Keep the approved completed-state bytes, including its audited timestamp.
 fresh.state=approved.state;save('plan.json',fresh);
 for(const phase of ['assets','documents','finalize'])writeLftpCommands(fresh,{distDir:dist,output:path.join(work,phase+'.lftp'),stateOutput:path.join(work,'completed-state.json'),phase,runId:`exact-${process.env.GITHUB_RUN_ID || 'local'}`});
 // Audit the generated commands: no hosting-owned files, no unexpected removals.
 for(const phase of ['assets','documents','finalize']){
  const text=fs.readFileSync(path.join(work,phase+'.lftp'),'utf8');assert(!text.includes('.htaccess'));
  const removals=text.split('\n').filter(x=>x.startsWith('rm '));
  assert.deepEqual(removals,phase==='finalize'?approved.stale.map(x=>`rm -f "/${x}"`):[]);
 }
 save('preflight.json',{checked_at:new Date().toISOString(),commit,artifact_sha256:'08bb5ce1eac73faa45cb3873f0d7a8af02d7ee4f2c23a8cb729904cd4d4ea1bf',total:fresh.total,transfers:fresh.changed.length+fresh.new.length,stale:fresh.stale.length,rollback_verified:1790});
 console.log('PASS: exact artifact, origin baseline, forward plan, rollback and inactive routes.');
}
async function postflight(){
 const plan=read(path.join(work,'plan.json'));
 await each(Object.entries(plan.state.files),async([file,expected])=>{
  const bytes=Buffer.from(await(await request(new URL('/'+file,origin))).arrayBuffer());
  assert.equal(hash(bytes),expected,`Published bytes mismatch: ${file}`);
 });
 const stateBytes=Buffer.from(await(await request(origin+'/.bulgaritam-deploy-state.json')).arrayBuffer());
 assert.equal(hash(stateBytes),hash(fs.readFileSync(path.join(work,'completed-state.json'))),'Completed state differs');
 const manifest=await(await request(origin+'/deploy-manifest.json')).json();assert.equal(manifest.commit,commit);
 const retired=[];
 await each(approved.stale,async file=>{
  const r=await fetch(origin+'/'+file,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(60000)});
  assert([404,410].includes(r.status),`Retired file not removed: ${file} HTTP ${r.status}`);
  retired.push({path:file,status:r.status});
 });
 const images=[];
 for(const item of evidence.items){
  const r=await request(origin+item.path);const html=await r.text();
  // URLs containing ampersands are escaped in generated HTML.
  const escaped=item.hero_src.replaceAll('&','&amp;');
  assert(html.includes(item.hero_src)||html.includes(escaped),`Missing expected image: ${item.id}`);
  const img=await request(item.hero_src);const bytes=Buffer.from(await img.arrayBuffer());
  const image=bytes[0]===0xff&&bytes[1]===0xd8 || bytes.subarray(1,4).toString()==='PNG' || bytes.subarray(0,6).toString().startsWith('GIF8') || bytes.subarray(8,12).toString()==='WEBP' || bytes.subarray(4,8).toString()==='ftyp' || bytes.toString('utf8',0,200).includes('<svg');
  assert(image && bytes.length>100,`Invalid image bytes: ${item.id}`);
  images.push({id:item.id,path:item.path,image_url:item.hero_src,status:img.status,bytes:bytes.length});
 }
 assert.equal(images.length,14);await stale();
 const result={checked_at:new Date().toISOString(),commit,managed_files_verified:Object.keys(plan.state.files).length,uploaded_files:plan.changed.length+plan.new.length,completion_state_uploads:1,removed_files:retired.length,preserved_routes:13,images_verified:images.length,manifest_and_completed_state:'exact',retired,images};
 save('postflight.json',result);console.log(JSON.stringify({...result,retired:undefined,images:undefined}));
}
const mode=process.argv[2];
if(mode==='preflight')await preflight();
else if(mode==='stale')await stale();
else if(['assets','documents'].includes(mode))console.log(JSON.stringify(await verifyDeploymentPhase(read(path.join(work,'plan.json')),mode,{distDir:dist,origin,concurrency:12})));
else if(mode==='postflight')await postflight();
else throw Error('Unsupported release operation');
