import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseImageUrls } from '../src/lib/image-urls.mjs';

const wix='https://static.wixstatic.com/media/c5125c_1b527fc180f9423b89f9eba93f65a1ba~mv2.jpg/v1/fill/w_388,h_582,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/c5125c_1b527fc180f9423b89f9eba93f65a1ba~mv2.jpg';
const sellavi='https://cdn.sellavi.com/image/upload/if_ar_gt_2:1/c_mpad,h_504,w_450,q_100/c_fill,h_504,w_525/if_else/c_pad,h_504,q_100,w_450/if_end/bg/clients/103445/1c744aa96e55f2a857321e531f114cdfe7338fb5.jpeg';
const simple='https://example.test/gallery/second.jpg';
for (const [label,input,expected] of [
  ['Wix full transformation',wix,[wix]],
  ['Sellavi conditional transformation',sellavi,[sellavi]],
  ['Wix and Sellavi in one field',`${wix}, ${sellavi},${simple}`,[wix,sellavi,simple]],
  ['legacy comma-delimited HTTPS images',`  ${simple}, https://example.test/third.png `,[simple,'https://example.test/third.png']],
  ['HTTP and protocol-relative entries',`http://example.test/a.jpg,//example.test/b.png`,['http://example.test/a.jpg','//example.test/b.png']],
  ['root-relative local images','/images/a.avif, /images/b.jpg',['/images/a.avif','/images/b.jpg']],
  ['local and remote images',`/images/a.avif,${wix}` ,['/images/a.avif',wix]],
  ['literal commas in path and query','https://example.test/image,portrait.jpg?crop=1,2,3',['https://example.test/image,portrait.jpg?crop=1,2,3']],
  ['percent-encoded commas stay encoded','https://example.test/image%2Cportrait.jpg, '+simple,['https://example.test/image%2Cportrait.jpg',simple]],
  ['quoted entries preserve URL-like query text',`"https://example.test/a.jpg?text=one,https://example.test/inside", "${wix}"`,['https://example.test/a.jpg?text=one,https://example.test/inside',wix]],
  ['empty entries and trailing separators',`, ${simple},, ${wix},, `,[simple,wix]],
  ['line-separated images',`${wix}\r\n${simple}`,[wix,simple]],
  ['duplicates and ordering are preserved',`${simple},${simple}`,[simple,simple]],
  ['empty input','',[]],['null input',null,[]],
]) test(label,()=>assert.deepEqual(parseImageUrls(input),expected));

const root=fileURLToPath(new URL('../',import.meta.url));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');

test('health CLI probes complete first image, never CDN transformation fragments',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'image-urls-health-'));
 try {
  const preload=path.join(dir,'preload.mjs');
  await fs.writeFile(preload,`
    import assert from 'node:assert/strict';
    const images=${JSON.stringify([wix,sellavi,simple])};
    globalThis.fetch=async(url,options={})=>{
      assert.ok(!options.method||options.method==='GET','no writes');
      if(String(url).startsWith('https://api.baserow.io/'))return Response.json({next:null,results:images.map((image,id)=>({id,slug:'image-'+id,name_bg:'Image '+id,is_active:true,brand_name:'Fixture',product_url:'https://example.test/product',image_urls:image+', '+images[(id+1)%images.length]}))});
      if(String(url)==='https://example.test/product')return new Response('<html>Product</html>',{headers:{'content-type':'text/html'}});
      assert.ok(images.includes(String(url)),'truncated or unexpected URL: '+url);
      return new Response(Buffer.from('${png.toString('base64')}','base64'),{headers:{'content-type':'image/png'}});
    };
  `);
  const report=path.join(dir,'health.json');
  const child=spawnSync(process.execPath,['--import',preload,path.join(root,'scripts/check-product-health.mjs'),'--report='+report],{cwd:dir,env:{...process.env,BASEROW_API_TOKEN:'test-only'},encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);
  const result=JSON.parse(await fs.readFile(report,'utf8'));
  assert.equal(result.checked,3);assert.equal(result.healthy,3);assert.equal(result.confirmed_broken_images,0);assert.deepEqual(result.deactivated,[]);
 } finally {await fs.rm(dir,{recursive:true,force:true});}
});

test('real product loader preserves multi-images, local overrides, and publication eligibility',async()=>{
 const child=spawnSync(process.execPath,['--import',path.join(root,'admin-app/node_modules/tsx/dist/loader.mjs'),'--input-type=module','-e',`
   import assert from 'node:assert/strict';
   process.env.BASEROW_API_TOKEN='test-only';process.env.BASEROW_TABLE_ID='906650';process.env.BASEROW_BRANDS_TABLE_ID='1133942';delete process.env.PRODUCT_HEALTH_REPORT_PATH;
   const first=${JSON.stringify(wix)},second=${JSON.stringify(sellavi)};
   const rows=[
     {id:1,slug:'multiple',image_urls:first+', '+second,is_active:true},
     {id:2,slug:'byal-polar-damski',image_urls:first,is_active:true},
     {id:3,slug:'missing-image-unpublished',image_urls:'',is_active:true},
     {id:4,slug:'inactive-product',image_urls:first,is_active:false},
   ].map(r=>({...r,name_bg:r.slug,tags:'tag-one,tag-two',brand_ref:[{id:10}],brand_slug:'fixture'}));
   globalThis.fetch=async(url,options={})=>{
     assert.ok(!options.method||options.method==='GET');
     if(String(url).includes('/table/906650/'))return Response.json({next:null,results:rows});
     if(String(url).includes('/table/1133942/'))return Response.json({next:null,results:[{id:10,brand_slug:'fixture',is_active:true,name_bg:'Fixture'}]});
     throw Error('unexpected request');
   };
   const {loadProducts}=await import(${JSON.stringify(new URL('../src/lib/products.ts',import.meta.url).href)});
   const products=await loadProducts();assert.equal(products.length,2);
   const multi=products.find(p=>p.slug==='multiple');assert.deepEqual(multi.image_urls,[first,second]);assert.deepEqual(multi.tags,['tag-one','tag-two']);
   assert.deepEqual(products.find(p=>p.slug==='byal-polar-damski').image_urls,['/images/products/razgar/razgar-byal-polar-damski.avif']);
 `],{cwd:os.tmpdir(),env:{...process.env},encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);
});
