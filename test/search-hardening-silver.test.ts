import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {searchHomepage,interpretHomepageQuery} from '../src/lib/homepage-search';
import {sourceEvidence,supportedSourceConcept} from '../src/lib/search-evidence';
import {relatedItem,relationProof,ageEvidence} from '../src/lib/search-relations';
import {compileSearchEvidence} from '../src/lib/search-evidence-build';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const D='reports/search-phase3-hardening-2026-10-22/';
const cards=read(D+'evidence-cards.json'),rows=read('reports/search-founder-review-2026-10-21/read-only-catalog-projection.json').rows;
const card=(slug:string)=>cards.find((c:any)=>c.dataset.productSlug===slug);
for(const slug of ['damski-srebaren-komplekt-arc','srebaren-komplekt-rayska-perla']){
 test(`silver-components-v2: generic silver + actual earrings component ${slug}`,()=>{
  const c=card(slug);assert.equal(c.dataset.materials,'');
  assert.ok(searchHomepage([c],'сребро').cards.includes(c));assert.ok(searchHomepage([c],'сребърни обеци').cards.includes(c));
  assert.ok(relatedItem(c,'earrings',['Сребро']));
  assert.ok(sourceEvidence(c).some((r:any)=>r.kind==='material'&&r.concept==='Сребро'&&r.status==='approved'&&r.scope==='component'));
  for(const r of relationProof(c,'contains_item','earrings')){assert.equal(r.scope,'component');const row=rows.find((p:any)=>p.slug===slug);assert.equal(row[r.field].slice(r.start,r.start+r.text.length),r.text);}
 });
 test(`silver-components-v2: manual stored material/type/category remain strict ${slug}`,()=>{
  const c=card(slug);for(const manual of [{materials:['Сребро']},{productType:'Обеци'},{category:'cosmetics'}])assert.equal(searchHomepage([c],'сребърни обеци',manual).cards.length,0);
  assert.equal(searchHomepage([c],'златни обеци').cards.length,0);assert.equal(searchHomepage([c],'сребърни обеци до 1 евро').cards.length,0);
 });
 test(`silver-components-v2: stale and missing proof cannot activate ${slug}`,()=>{
  const c=card(slug);for(const changes of [{sourceEvidence:''},{productName:'stale title'},{productId:'different-product'}])assert.equal(searchHomepage([{dataset:{...c.dataset,...changes}}],'сребърни обеци').cards.length,0);
 });
}
for(const slug of ['obeci-peperudi-on-a-date','zlatni-obetsi-halki-florin-ot-zhalto-zlato-14k-s-tsirkoni'])test(`silver-components-v2: confirmed non-silver negative ${slug}`,()=>assert.equal(searchHomepage([card(slug)],'сребърни обеци').cards.length,0));
test('silver-components-v2: missing material with silver color cannot establish material',()=>{const c=card('obeci-rouz');assert.equal(searchHomepage([{dataset:{...c.dataset,sourceEvidence:'',materials:'',colors:'Сребрист'}}],'сребърни обеци').cards.length,0);});
test('silver-components-v2: main before related, no duplicate and no removals among main',()=>{const r=searchHomepage(cards,'сребърни обеци').cards;assert.equal(r.length,26);assert.equal(new Set(r.map((c:any)=>c.dataset.productId)).size,26);for(const c of r.slice(22))assert.ok(relatedItem(c,'earrings',['Сребро']));});

for(const scope of ['main','variant'])test(`silver v2 rejects wrong included-item scope: ${scope}`,()=>{const c=card('damski-srebaren-komplekt-arc'),e=JSON.parse(c.dataset.sourceEvidence);for(const r of e.relations)if(r.kind==='contains_item')r.scope=scope;assert.equal(relatedItem({dataset:{...c.dataset,sourceEvidence:JSON.stringify(e)}},'earrings',['Сребро']),false);});
test('silver v2 rejects material on another component',()=>{const c=card('damski-srebaren-komplekt-arc'),e=JSON.parse(c.dataset.sourceEvidence);for(const r of e.relations)if(r.kind==='contains_item'&&r.concept==='earrings')r.materials=[];assert.equal(relatedItem({dataset:{...c.dataset,sourceEvidence:JSON.stringify(e)}},'earrings',['Сребро']),false);});
