// Run after the production-equivalent build. All external browser traffic is mocked.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
const root=path.resolve('dist');
let server,browser,origin;
before(async()=>{
  await fs.access(path.join(root,'index.html'));
  server=http.createServer(async(req,res)=>{try{
    let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));
    if(!file.startsWith(root+path.sep)) throw Error();
    const data=await fs.readFile(file);
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/html');res.end(data);
  }catch{res.writeHead(404);res.end('not found');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,...(process.env.DEALS_BROWSER_CHANNEL?{channel:process.env.DEALS_BROWSER_CHANNEL}:{})});
});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
async function context(t,options={}){
  const c=await browser.newContext(options);t.after(()=>c.close());
  await c.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  return c;
}
async function dismiss(p){const b=p.getByRole('button',{name:'Само необходими',exact:true});if(await b.isVisible())await b.click();}
test('main routes render desktop/mobile without script errors or horizontal overflow',async t=>{
 const slug=(await fs.readdir(path.join(root,'p')))[0], brand=(await fs.readdir(path.join(root,'brand')))[0];
 for(const width of [390,1280]){
  const c=await context(t,{viewport:{width,height:900}}),p=await c.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  for(const route of ['/', '/namaleniya/', '/partnyori/', '/za-nas/', `/p/${slug}/`, `/brand/${brand}/`, '/k/bulgarski-drehi/']){
   const response=await p.goto(origin+route);assert.equal(response.status(),200,route);await dismiss(p);
   assert.ok(await p.locator('h1').count(),route);
   assert.equal(await p.locator('link[rel="canonical"]').count(),1,route);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`${route} width ${width}`);
  }
  assert.deepEqual(errors,[]);
 }
});
test('Load Random, pagination, sorting and filters retain unique products',async t=>{
 const c=await context(t),p=await c.newPage();await p.goto(origin+'/');await dismiss(p);
 const cards=p.locator('#grid li.card:visible');
 await p.waitForFunction(()=>document.querySelectorAll('#grid li.card:not([hidden])').length>0);
 const before=await cards.count();const more=p.locator('#feedLoadMore');
 if(await more.isVisible()){await more.click();await p.waitForFunction(n=>document.querySelectorAll('#grid li.card:not([hidden])').length>n,before);}
 const slugs=await cards.evaluateAll(nodes=>nodes.map(n=>n.dataset.productSlug));assert.equal(new Set(slugs).size,slugs.length);
 await p.locator('#filtersToggle').click();await p.locator('#filtersModal').waitFor({state:'visible'});await p.locator('#filtersApply').click();
 await p.locator('#sortSelect').selectOption('price-asc');assert.ok(await cards.count());
});
test('no JavaScript preserves SEO links and never shows exact manual references or active deals',async t=>{
 const c=await context(t,{javaScriptEnabled:false}),p=await c.newPage();
 await p.goto(origin+'/namaleniya/');assert.ok(await p.locator('h1').innerText());assert.equal(await p.locator('#dealGrid li:visible').count(),0);
 assert.ok(await p.locator('a[href^="/p/"]').count());
 const products=await fs.readdir(path.join(root,'p'));
 for(const slug of products){const html=await fs.readFile(path.join(root,'p',slug,'index.html'),'utf8');if(!/<div\b[^>]*\bdata-manual-price-gate(?:=|\s|>)/.test(html))continue;
  await p.goto(origin+`/p/${slug}/`);assert.equal(await p.locator('[data-manual-price-reference-amount]:visible').count(),0);assert.ok(await p.locator('[data-reference-fallback]:visible').count());return;
 }
 // Absence of qualifying references is legitimate; templates are also covered by the unit expiry tests.
});
test('built product removes manual reference at its original expiry without a rebuild',async t=>{
 const products=await fs.readdir(path.join(root,'p'));
 let fixture;
 for(const slug of products){const html=await fs.readFile(path.join(root,'p',slug,'index.html'),'utf8');const gate=html.match(/<div\b[^>]*\bdata-manual-price-gate(?:=|\s|>)[^>]*>/);if(gate){fixture={slug,expires:gate[0].match(/data-expires-at="([^"]+)"/)[1]};break;}}
 assert.ok(fixture,'Production snapshot contains eligible manual references');
 const c=await context(t),p=await c.newPage();await p.clock.install({time:new Date(Date.parse(fixture.expires)-1000)});
 await p.goto(origin+`/p/${fixture.slug}/`);await p.locator('[data-reference-live] [data-manual-price-reference-amount]').waitFor({state:'visible'});
 await p.clock.fastForward(1001);
 assert.equal(await p.locator('[data-reference-live] [data-manual-price-reference-amount]').count(),0);
 assert.equal(await p.locator('[data-reference-fallback]').isVisible(),true);
});
test('static discovery pages partition the full catalog without duplicates or omissions',async()=>{
 const home=await fs.readFile(path.join(root,'index.html'),'utf8');
 const expected=Number(home.match(/data-total-items="(\d+)"/)[1]);
 const pages=[home,...await Promise.all((await fs.readdir(path.join(root,'page'))).map(n=>fs.readFile(path.join(root,'page',n,'index.html'),'utf8')))];
 const slugs=pages.flatMap(html=>[...html.matchAll(/<li\b[^>]*data-product-slug="([^"]+)"/g)].map(m=>m[1]));
 assert.equal(slugs.length,expected);assert.equal(new Set(slugs).size,expected);
});
