// Compile the real fetch/normalization pipeline and pages against synthetic Baserow rows.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { build } from 'astro';
import { chromium } from 'playwright';
let dir,server,browser,origin;
const variations=[
 {no_site:false,brand_url:'https://example.test/shop'},
 {no_site:true,instagram_url:'https://instagram.com/example'},
 {no_site:true,facebook_url:'https://facebook.com/example'},
 {no_site:true,email:'brand@example.test'},
 {no_site:true,instagram_url:'https://instagram.com/example',facebook_url:'https://facebook.com/example',email:'brand@example.test'},
 {no_site:true,address:'ул. Пример 12, София',physical_address_type:'Магазин'},
 {no_site:true},
 {no_site:false,brand_url:''},
];
const brands=variations.map((v,i)=>({id:i+1,is_active:true,brand_slug:`brand-${i}`,brand_name:`Бранд ${i}`,description_bg:[0,3].includes(i)?'':'История на бранда.',...v}));
const products=brands.map((b,i)=>({id:i+1,'id 2':String(i+1),name_bg:`Продукт ${i}`,slug:`product-${i}`,brand_ref:[{id:b.id}],category:'Облекло',subcategory:'Дамско облекло',product_type:'Рокли',image_urls:'https://example.test/image.jpg',is_active:true,product_url:'https://example.test/product',short_desc_bg:'Описание на продукта.'}));
before(async()=>{
 const root=path.resolve('.');dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'bulgaritam-no-site-')));
 await fs.cp('src',path.join(dir,'src'),{recursive:true,filter:s=>!s.startsWith('src/pages')||s==='src/pages'||s.startsWith('src/pages/p')||s.startsWith('src/pages/brand')});
 // Remove unrelated pages whose names share the prefix p/b.
 for(const name of await fs.readdir(path.join(dir,'src/pages')))if(!['p','brand'].includes(name))await fs.rm(path.join(dir,'src/pages',name),{recursive:true});
 await fs.cp('admin-app/src/lib',path.join(dir,'admin-app/src/lib'),{recursive:true});
 await fs.symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir');
 await fs.writeFile(path.join(dir,'package.json'),'{"type":"module"}');
 await fs.writeFile(path.join(dir,'src/pages/index.astro'),`---\nimport BaseLayout from '../layouts/BaseLayout.astro';import Card from '../components/HomepageProductCard.astro';import {loadProducts} from '../lib/products';const products=await loadProducts();\n---\n<BaseLayout><h1>Тест</h1><ul>{products.map((product,index)=><Card product={product} index={index}/>)}</ul></BaseLayout>`);
 await fs.writeFile(path.join(dir,'src/pages/landing.astro'),`---\nimport Landing from '../components/SeoProductLanding.astro';import {loadProducts} from '../lib/products';const products=await loadProducts();\n---\n<Landing landing={{h1:'Тест',intro:['Тест'],categoryKey:'clothing'}} canonicalPath="/landing/" products={products}/>`);
 await build({root:pathToFileURL(dir+'/'),configFile:false,publicDir:path.join(root,'public'),cacheDir:dir+'/.astro/',outDir:dir+'/dist/',site:'https://bulgaritam.bg',trailingSlash:'always',logLevel:'error',vite:{plugins:[{name:'fixture-baserow',enforce:'pre',transform(code,id){
 if(!/\/src\/lib\/(products|brands)\.ts$/.test(id))return;
 const mock=`const fetch = async (url) => ({ok:true,json:async()=>({results:String(url).includes('/1133942/')?${JSON.stringify(brands)}:${JSON.stringify(products)},next:null})});\n`;
 return mock+code.replace(/const BASEROW_API_TOKEN = [^;]+;/,'const BASEROW_API_TOKEN = "fixture-only";');
 }}]}});
 server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname;const f=path.join(dir,'dist',p,p.endsWith('/')?'index.html':'');const data=await fs.readFile(f);res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(data);}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({headless:true,...(process.env.DEALS_BROWSER_CHANNEL?{channel:process.env.DEALS_BROWSER_CHANNEL}:{})});
});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));if(dir)await fs.rm(dir,{recursive:true,force:true});});
for(const width of [390,1280]) test(`all eight scenarios: cards, detail, profiles at ${width}px`,{timeout:60000},async()=>{
 const context=await browser.newContext({viewport:{width,height:900},permissions:['clipboard-read','clipboard-write']});
 await context.addInitScript(()=>localStorage.setItem('bulgaritam_cookie_consent_v1',JSON.stringify({necessary:true,analytics:true})));
 const externalRequests=[];context.on('request',request=>{if(request.url().startsWith('mailto:'))externalRequests.push(request.url());});
 await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.fulfill({status:200,body:'{}'}));
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['/','/landing/']){
 await page.goto(origin+route);
 for(let i=0;i<8;i++){
 const card=page.locator(`[data-product-slug="product-${i}"]`).first();
 const cta=card.locator('a.cta-out');
 if(i===6){assert.equal(await cta.count(),0);continue;}
 assert.equal(await cta.getAttribute('href'),i>0&&i<7?`/p/product-${i}/`:'https://example.test/product');
 if(i>0&&i<7){assert.equal(await cta.textContent().then(s=>s.trim()),'Направи запитване');assert.equal(await cta.getAttribute('target'),null);}
 }
 }
 for(let i=0;i<8;i++){
 await page.goto(`${origin}/p/product-${i}/`);
 assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),`https://bulgaritam.bg/p/product-${i}/`);
 const opener=page.getByRole('button',{name:'Направи запитване',exact:true});
 if(i>0&&i<6){
 await opener.click();const dialog=page.getByRole('dialog');await dialog.waitFor({state:'visible'});
 const events=()=>page.evaluate(()=>window.dataLayer.filter(x=>x.event));
 assert.equal((await events()).filter(x=>x.event==='inquiry_open').length,1);
 assert.equal((await events()).filter(x=>x.event==='outbound_product_click').length,0);
 assert.equal(await dialog.locator('[data-inquiry-contact]').count(),i===4?3:1);
 const opened=(await events()).find(x=>x.event==='inquiry_open');assert.equal(opened.product_id,String(i+1));assert.equal(opened.brand_id,String(i+1));assert.equal(opened.page_path,`/p/product-${i}/`);
 for(let tab=0;tab<6;tab++){await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(d=>d.contains(document.activeElement)),true);}
 if(i===4){await fs.mkdir('reports/no-site-screenshots',{recursive:true});await page.screenshot({path:`reports/no-site-screenshots/inquiry-${width}.png`});}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 if(i===3){const beforeUrl=page.url(),beforePages=context.pages().length;assert.equal(await dialog.locator('a[href^="mailto:"]').count(),0);assert.ok((await dialog.textContent()).includes(`Запитване за продукт: Продукт ${i}`));await dialog.getByRole('button',{name:'Копирай имейл',exact:true}).click();await page.getByText('Копирано!',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'brand@example.test');assert.equal((await events()).filter(x=>x.event==='outbound_product_click').length,0);assert.equal(page.url(),beforeUrl);assert.equal(context.pages().length,beforePages);await dialog.getByRole('button',{name:'Копирай тема',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),`Запитване за продукт: Продукт ${i}`);}
 else {const link=dialog.locator('a').first();await link.evaluate(a=>a.addEventListener('click',e=>e.preventDefault()));await link.click();assert.equal((await events()).filter(x=>x.event==='outbound_product_click').length,1);}
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await opener.evaluate(e=>e===document.activeElement),true);
 await opener.click();await dialog.getByRole('button',{name:'Затвори',exact:true}).click();
 const schema=await page.locator('script[type="application/ld+json"]').textContent();assert.ok(!schema.includes('"offers"'));
 }else {assert.equal(await opener.count(),0);if(i===0||i===7)assert.equal(await page.locator('a.btn').getAttribute('href'),'https://example.test/product');}
 if(i===5){const html=await fs.readFile(path.join(dir,'dist/p/product-5/index.html'),'utf8');assert.ok(html.includes('destination='));assert.ok(html.includes('Купи на място'));}
 await page.goto(`${origin}/brand/brand-${i}/`);
 assert.equal(await page.locator('a.visit').count(),i===0?1:0);
 if([1,4].includes(i))assert.equal(await page.locator('a.ig[href*="instagram"]').count(),2);
 if([2,4].includes(i))assert.equal(await page.locator('a.ig[href*="facebook"]').count(),2);
 if(i===3||i===4){const beforeUrl=page.url(),beforePages=context.pages().length;assert.equal(await page.locator('.brand-hero-actions a[href^="mailto:"], .brand-actions a[href^="mailto:"]').count(),0);const copy=page.getByRole('button',{name:'Копирай имейл',exact:true}).filter({visible:true});await copy.click();await page.getByText('Копирано!',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'brand@example.test');assert.equal(page.url(),beforeUrl);assert.equal(context.pages().length,beforePages);}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 }
 assert.deepEqual(externalRequests,[]);assert.deepEqual(errors,[]);await context.close();
});
test('inquiry interaction respects analytics refusal',async()=>{
 const context=await browser.newContext();await context.addInitScript(()=>localStorage.setItem('bulgaritam_cookie_consent_v1',JSON.stringify({necessary:true,analytics:false})));
 await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const page=await context.newPage();await page.goto(origin+'/p/product-1/');await page.getByRole('button',{name:'Направи запитване',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.dataLayer.filter(x=>x.event==='inquiry_open').length),0);await context.close();
});
