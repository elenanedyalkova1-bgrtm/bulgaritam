import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {searchHomepage,interpretHomepageQuery} from '../src/lib/homepage-search';
import {compileSearchEvidence} from '../src/lib/search-evidence-build';
import {relationProof,relatedItem,ageEvidence,discoveryRelations,requestedAgesFromFolded} from '../src/lib/search-relations';
import type {SearchRelationOptions,RelationFeatures} from '../src/lib/search-relation-policy';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const D='reports/search-phase3-hardening-2026-10-22/';
const cards=read(D+'evidence-cards.json'),before=read(D+'before-evidence-cards.json');
const card=(s:string)=>cards.find((c:any)=>c.dataset.productSlug===s);
const ids=(cs:any[])=>cs.map(c=>c.dataset.productSlug);
function synthetic(text:string,changes:any={}) {
 const d={...card('damski-set-boho-earth').dataset,productId:'unseen-hardening',productSlug:'unseen-hardening',productName:'Комплект с риза и обеци',materials:'',colors:'',searchRaw:text,...changes};
 const binding=Object.fromEntries(['productId','productSlug','productName','productType','publicCategory','publicSubcategory','materials'].map(k=>[k,d[k]||'']));
 d.sourceEvidence=JSON.stringify(compileSearchEvidence({id:d.productId,row_id:999999,slug:d.productSlug,name_bg:d.productName,product_type:d.productType,short_desc_bg:text,long_desc_bg:text,materials:[],gift_occasion:'Рожден ден'} as any,binding as any));return {dataset:d};
}
for(const text of ['Комплектът включва обеци и медальон, а верижката не е включена.','Комплектът включва обеци; верижката не е включена.'])
 test(`mixed scopes: ${text}`,()=>{const c=synthetic(text);assert.ok(relatedItem(c,'earrings'));assert.ok(discoveryRelations(c).some(r=>r.concept==='chain'&&r.polarity==='negative'));});
for(const text of ['Комплектът включва риза, която се закупува отделно.','Комплектът включва риза, която се продава отделно.','Комплектът може да включва риза.','Комплектът включва боди тип риза.'])
 test(`no included proof: ${text}`,()=>assert.equal(relatedItem(synthetic(text),'shirt'),false));
for(const text of ['Предлага се със сертификат и подаръчна кутия.','Включва подарък за любим човек.','Включва бонус подарък за любим човек.','Стикери за декорация на подаръци.'])
 test(`incidental gift abstention: ${text}`,()=>assert.equal(relationProof(synthetic(text),'occasion','Рожден ден').length,0));
test('main gift box and an independent gift recommendation are retained',()=>{assert.ok(relationProof(synthetic('Подаръчна кутия с козметични продукти.',{productName:'Подаръчна кутия Лято'}),'occasion','Рожден ден').length);assert.ok(relationProof(synthetic('Подходящ е за подарък за мъж и може да бъде поръчан с подаръчна опаковка.'),'occasion','Рожден ден').length);});
for(const text of ['Артикулът не се препоръчва за учителка.','Не е подходящ за учителка.','Не за учителка.'])
 test(`negative role and legacy fallback: ${text}`,()=>{const c=synthetic(text);assert.equal(searchHomepage([c],'teacher').cards.length,0);assert.equal(searchHomepage([{dataset:{...c.dataset,sourceEvidence:''}}],'teacher').cards.length,0);});
test('negated white option does not suppress supported blue or prove white',()=>{const c=synthetic('Предлага се в син цвят, но не и в бял.');assert.ok(relationProof(c,'offered_variant','Син').length);assert.equal(relationProof(c,'offered_variant','Бял').length,0);assert.equal(searchHomepage([c],'бял').cards.length,0);assert.equal(searchHomepage([c],'син').cards.length,1);assert.equal(searchHomepage([c],'син',{colors:['Син']}).cards.length,0);});
test('multiple ages retain both constraints and explicitly surface ambiguity',()=>{const q=interpretHomepageQuery('подарък за дете на 3 години на 7 години');assert.deepEqual(q.ageConditions?.map(a=>a.min),[3,7]);assert.ok(q.deferred);assert.equal(searchHomepage(cards,q.originalQuery).cards.length,0);const and=interpretHomepageQuery('подарък за дете на 3 години и на 7 години');assert.equal(and.ageConditions?.length,2);assert.equal(and.deferred,undefined);});
test('source overlap by default, explicit all ages needs containment',()=>{const c=synthetic('Подходящ за деца от 5 до 10 години.');const overlap=interpretHomepageQuery('подарък за дете от 3 до 7 години'),all=interpretHomepageQuery('подарък за дете за всички възрасти от 3 до 7 години');assert.equal(overlap.maxPriceEur,undefined);assert.equal(ageEvidence(c,overlap.requestedAge!,[]),'supported');assert.equal(ageEvidence(c,all.requestedAge!,[]),'unknown');assert.equal(all.requestedAge?.coverage,'all');});
test('canonical metadata overlap is not invented all-age suitability',()=>{const c={dataset:{recipientAge:'3|7',recipients:'За дете'}};assert.equal(ageEvidence(c,{min:3,max:7,unit:'years',coverage:'overlap'},['За дете']),'supported');assert.equal(ageEvidence(c,{min:3,max:7,unit:'years',coverage:'all'},['За дете']),'unknown');});
test('disputed age4 remains unresolved even with stored4; other ages retained',()=>{const c=card('skrech-kniga-s-predizvikatelstva-za-detsa');assert.equal(ageEvidence(c,{min:4,max:4,unit:'years'},[]),'unknown');assert.equal(ageEvidence({dataset:{...c.dataset,recipientAge:'4'}},{min:4,max:4,unit:'years'},['За дете']),'unknown');assert.equal(ageEvidence(c,{min:5,max:5,unit:'years'},[]),'supported');assert.ok(searchHomepage([c],'книга').cards.includes(c));});
test('strict >6, not >=6; no source proof from sizes',()=>{const c=card('cherno-more');assert.equal(ageEvidence(c,{min:6,max:6,unit:'years'},[]),'contradicted');assert.equal(ageEvidence(c,{min:7,max:7,unit:'years'},[]),'supported');const s=card('detska-severnyashka-riza');assert.equal(ageEvidence(s,{min:6,max:6,unit:'years'},[]),'unknown');assert.ok(searchHomepage([s],'детска риза').cards.includes(s));});
test('newborn/baby up-to range, months vs years and no adult inference',()=>{const c=card('meriboo-komplekt-komfort-ot-sertificirano-merino-mini-cozy');assert.equal(ageEvidence(c,{min:6,max:6,unit:'months'},[]),'supported');assert.equal(ageEvidence(c,{min:6,max:6,unit:'years'},[]),'contradicted');assert.equal(ageEvidence(c,{min:50,max:50,unit:'years'},['За жена']),'unknown');});
test('20.25 stays noncanonical; threshold query has no arbitrary120 upper bound',()=>{assert.equal(ageEvidence({dataset:{recipientAge:'20.25',recipients:'За жена'}},{min:20,max:20,unit:'years'},['За жена']),'unknown');assert.equal(requestedAgesFromFolded('nad 6 mesetsa')[0].age.max,null);});
test('explicit negative age cannot be overridden by canonical metadata',()=>{const c=synthetic('Не е подходящ за деца над 6 години.',{recipientAge:'7',recipients:'За дете'});assert.equal(ageEvidence(c,{min:7,max:7,unit:'years'},['За дете']),'contradicted');});
for(const feature of ['includedItems','occasions','ages','offeredVariants','roles'] as const)
 test(`feature isolation: ${feature}`,()=>{
  const options={features:{[feature]:false}};
  const protectedQueries:any={includedItems:['обеци',32],occasions:['подарък за рожден ден',20],ages:['подарък за дете на 3 години',0],offeredVariants:['бял албум',3],roles:['teacher',0]};
  const [q,count]=protectedQueries[feature];assert.equal(searchHomepage(cards,q,{},options).cards.length,count);
  for(const other of ['includedItems','occasions','ages','offeredVariants','roles'] as const){if(other===feature)continue;const [query]=protectedQueries[other];assert.deepEqual(ids(searchHomepage(cards,query,{},options).cards),ids(searchHomepage(cards,query).cards));}
 });
test('global rollback has priority over individual enables and matches Phase2.5 all261',()=>{for(const r of read('reports/search-discovery-phase3-2026-10-22/before-261-results.json'))assert.deepEqual(ids(searchHomepage(cards,r.query,{}, {discoveryRelations:false,features:{includedItems:true}}).cards),r.allRankedSlugs,r.query);});
test('accepted silver v2:26 results, same component proof, stored facets unchanged',()=>{assert.equal(searchHomepage(cards,'сребърни обеци').cards.length,26);for(const slug of ['damski-srebaren-komplekt-arc','srebaren-komplekt-rayska-perla']){const c=card(slug);assert.ok(relatedItem(c,'earrings',['Сребро']));assert.equal(searchHomepage([c],'сребърни обеци',{materials:['Сребро']}).cards.length,0);assert.equal(searchHomepage([c],'сребърни обеци',{productType:'Обеци'}).cards.length,0);assert.equal(searchHomepage([c],'сребърни обеци до 1 евро').cards.length,0);}});
test('birthday keeps all48 source-supported additions, drops packaging proof and improves theme rank',()=>{const prior=read('reports/search-phase3-release-validation-2026-10-22/birthday-49-labels.json');const result=searchHomepage(cards,'подарък за рожден ден').cards;for(const p of prior.filter((p:any)=>p.label!=='Insufficient evidence'))assert.ok(ids(result).includes(p.slug),p.slug);assert.equal(result[0].dataset.productId,'6');assert.ok(!ids(result).includes('kolie-ot-rozovo-i-byalo-zlato-14k-s-diamanti-0-14ct-vs-g'));});
for(const q of ['подарък за майка ми','подарък за мама на 60 години','skincare','handmade','ръчна изработка','подарък за нов дом'])
 test(`protected exact Phase3 behavior: ${q}`,()=>{const b=read(D+'before-query-comparison.json').find((r:any)=>r.query===q);if(b)assert.deepEqual(ids(searchHomepage(cards,q).cards),b.after);});

test('negative role cannot hide behind a positive legacy tag in the same raw clause',()=>{const c=synthetic('Артикулът не се препоръчва за учителка.');c.dataset.sourceEvidence='';c.dataset.searchRaw='подарък-за-учител Артикулът не се препоръчва за учителка.';assert.equal(searchHomepage([c],'teacher').cards.length,0);});
test('cross-sentence separate-purchase qualifier invalidates an include claim',()=>assert.equal(relatedItem(synthetic('Комплектът включва риза. Ризата се закупува отделно.'),'shirt'),false));

for(const text of ['Предлага се с подаръчна опаковка за рожден ден.','Комплектът включва картичка за рожден ден.','Включва бонус подарък за рожден ден.','Артикулът не се препоръчва за рожден ден.'])
 test(`explicit occasion is not packaging/incidental proof: ${text}`,()=>assert.equal(relationProof(synthetic(text),'occasion','Рожден ден').length,0));

test('canonical occasion provenance preserves original field separators',()=>{const d=card('damski-set-boho-earth').dataset;const e=compileSearchEvidence({id:'separators',row_id:999999,name_bg:'Подаръчен комплект',slug:'separators',short_desc_bg:'Подходящ е за подарък.',gift_occasion:'Рожден ден, 8 март,Коледа',materials:[]} as any,{...Object.fromEntries(['productId','productSlug','productName','productType','publicCategory','publicSubcategory','materials'].map(k=>[k,d[k]||''])),productId:'separators'} as any);for(const r of e.relations.filter(r=>r.field==='gift_occasion'))assert.equal(r.text,'Рожден ден, 8 март,Коледа');});
