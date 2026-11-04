// Exercise the actual Baserow-built candidate locally; never open external contact destinations.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'playwright';
const root=path.resolve('dist');
let server,browser,origin,audit;
before(async()=>{
 audit=JSON.parse(await fs.readFile('reports/no-site-release-catalog.json','utf8'));
 server=http.createServer(async(req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(!file.startsWith(root+path.sep))throw Error('Invalid path');
  const data=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);
 }catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,...(process.env.DEALS_BROWSER_CHANNEL?{channel:process.env.DEALS_BROWSER_CHANNEL}:{})});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
test('every new catalog route has generated identity, canonical and usable CTA',async()=>{
 assert.deepEqual(audit.duplicate_product_slugs,[],'Catalog slugs must be unique');
 for(const [slug,id] of [['roklya-dark-allure-dress','1235'],['roklya-dark-allure-dress-1232','1232']]){const html=await fs.readFile(path.join(root,'p',slug,'index.html'),'utf8');const main=html.match(/<main[^>]*data-page-product[^>]*>/)?.[0]||'';assert.ok(main.includes(`data-product-id="${id}"`),`Distinct Goud identity ${id}`);}
 for(const product of audit.new_products){
  const html=await fs.readFile(path.join(root,'p',product.slug,'index.html'),'utf8');
  assert.ok(html.includes(`https://bulgaritam.bg/p/${product.slug}/`),product.slug);
  assert.match(html,/<h1\b/,product.slug);assert.match(html,/<img\b/,product.slug);
  assert.ok(product.outbound_valid,product.slug);
  if(product.no_site){assert.ok(html.includes('data-inquiry-open'),product.slug);assert.ok(!/"offers"\s*:/.test(html),product.slug);}
 }
 for(const brand of audit.new_brands)await fs.access(path.join(root,'brand',brand.slug,'index.html'));
 assert.deepEqual(audit.missing_build_paths,[]);
});
for(const width of [390,1280])test(`live catalog inquiry, profile, cards and website purchase at ${width}px`,async t=>{
 const context=await browser.newContext({viewport:{width,height:900},permissions:['clipboard-read','clipboard-write']});t.after(()=>context.close());
 await context.addInitScript(()=>localStorage.setItem('bulgaritam_cookie_consent_v1',JSON.stringify({necessary:true,analytics:true})));
 await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.fulfill({status:200,body:'{}'}));
 const page=await context.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const products=audit.new_products.filter(p=>p.no_site);assert.ok(products.length>0);
 for(const product of products){
  await page.goto(`${origin}/p/${product.slug}/`);
  const open=page.getByRole('button',{name:'Направи запитване',exact:true});await open.click();
  const dialog=page.getByRole('dialog');await dialog.waitFor({state:'visible'});
  assert.equal(await dialog.locator('a[href^="mailto:"]').count(),0);
  const email=dialog.locator('[data-copy-email]');assert.equal(await email.count(),1);
  const expected=await email.getAttribute('data-copy-email'),beforeUrl=page.url(),beforePages=context.pages().length;
  await email.click();await dialog.getByText('Копирано!',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expected);
  assert.equal(page.url(),beforeUrl);assert.equal(context.pages().length,beforePages);
  const events=await page.evaluate(()=>window.dataLayer.filter(e=>e.event));assert.equal(events.filter(e=>e.event==='outbound_product_click').length,0);
  assert.equal(events.filter(e=>e.event==='inquiry_contact_click'&&e.contact_method==='email').length,1);
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.ok(await open.evaluate(e=>document.activeElement===e));
 }
 for(const brand of audit.new_brands){
  await page.goto(`${origin}/brand/${brand.slug}/`);
  if(brand.no_site){
   assert.equal(await page.locator('a.visit').count(),0);
   const copy=page.getByRole('button',{name:'Копирай имейл',exact:true}).filter({visible:true});const expected=await copy.getAttribute('data-copy-email');await copy.click();await page.getByText('Копирано!',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expected);
   for(const product of products){const card=page.locator(`[data-product-slug="${product.slug}"]`).first();const cta=card.locator('a.cta-out');assert.equal(await cta.getAttribute('href'),`/p/${product.slug}/`);assert.equal(await cta.innerText(),'Направи запитване');}
  }else {const website=page.locator('a.visit').filter({visible:true});assert.equal(await website.count(),1);assert.match(await website.getAttribute('href'),/^https?:\/\//);}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),brand.slug);
 }
 const normal=audit.new_products.find(p=>!p.no_site);await page.goto(`${origin}/p/${normal.slug}/`);assert.equal(await page.locator('[data-inquiry-open]').count(),0);assert.match(await page.locator('a.btn').getAttribute('href'),/^https?:\/\//);assert.equal(await page.locator('a.btn').getAttribute('target'),'_blank');
 assert.deepEqual(errors,[]);
});
