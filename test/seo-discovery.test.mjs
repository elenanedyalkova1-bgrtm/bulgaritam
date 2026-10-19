import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/components/SeoProductLanding.astro', import.meta.url), 'utf8');
const loader = source.slice(source.indexOf('    let loadedThroughPage ='), source.indexOf('    const cardFacetKey ='));
const initialize = source.slice(source.indexOf('        // Keep SSR usable'), source.indexOf('        if (selectedSort !== "featured")'));
async function harness(seed, total = 127, fail = () => false) {
  let nodes = [];
  const card = (slug) => ({dataset:{productSlug:String(slug),position:String(slug+1)},style:{}, remove(){nodes=nodes.filter(n=>n!==this);}});
  const pages=Array.from({length:Math.ceil(total/48)},(_,p)=>Array.from({length:Math.min(48,total-p*48)},(_,i)=>card(p*48+i)));
  nodes=[...pages[0]];
  const requests=[];
  const context=vm.createContext({allCards:[...nodes],window:{location:{pathname:'/test/'},dispatchEvent(){}},CustomEvent:class{},
    sessionStorage:{getItem:()=>String(seed)},
    feedSection:{dataset:{currentPage:'1',totalPages:pages.length,totalItems:total,collectionPath:'/test/'}},
    grid:{querySelectorAll:()=>nodes,appendChild:n=>nodes.push(n)},
    document:{importNode:n=>{const copy=card(Number(n.dataset.productSlug));copy.dataset={...n.dataset};return copy;}},
    DOMParser:class{parseFromString(text){return{querySelectorAll:()=>pages[Number(text)-1]};}},
    fetch:async url=>{const page=Number(url.match(/page\/(\d+)/)?.[1]||1);requests.push(page);if(fail(page))throw Error('offline');return{ok:true,text:async()=>String(page)};},
  });
  vm.runInContext(fs.readFileSync(new URL('../public/product-discovery.js',import.meta.url),'utf8'),context);
  const api=await vm.runInContext(`(async()=>{${loader}\n${initialize}\nreturn {cards:()=>[...allCards].sort((a,b)=>Number(a.dataset.featuredIndex)-Number(b.dataset.featuredIndex)),next:()=>loadStaticPage(pageOrder[loadedThroughPage]),all:ensureAllStaticPages};})()`,context);
  return {api,requests};
}
test('SEO discovery changes opening products by session, keeps stable prefixes and exact membership',async()=>{
  const a=await harness(3),b=await harness(987);
  const ids=h=>Array.from(h.api.cards(),n=>n.dataset.productSlug);
  assert.notDeepEqual(ids(a),ids(b));
  const prefix=ids(a);
  await a.api.next();assert.deepEqual(ids(a).slice(0,prefix.length),prefix);
  await Promise.all([a.api.all(),a.api.all()]);
  assert.equal(ids(a).length,127);assert.equal(new Set(ids(a)).size,127);
  assert.deepEqual(ids(a).slice(0,prefix.length),prefix);
});
test('SEO failed entry retains SSR and recovers all products without duplicates',async()=>{
  let offline=true;
  const h=await harness(3,127,()=>offline);
  assert.equal(h.api.cards().length,48);
  const prefix=Array.from(h.api.cards(),n=>n.dataset.productSlug);
  offline=false;await h.api.all();
  assert.equal(new Set(h.api.cards().map(n=>n.dataset.productSlug)).size,127);
  assert.deepEqual(Array.from(h.api.cards().slice(0,48),n=>n.dataset.productSlug),prefix);
});
