// Historical Phase3-v1 contract: keep its source snapshot and expectations intact.
// Current runtime safety/contract coverage lives in search-hardening*.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {searchHomepage,interpretHomepageQuery} from '../reports/search-phase3-hardening-2026-10-22/baseline/homepage-search';
import {compileSearchEvidence} from '../reports/search-phase3-hardening-2026-10-22/baseline/search-evidence-build';
import {compileDiscoveryRelations} from '../reports/search-phase3-hardening-2026-10-22/baseline/search-relations-build';
import {discoveryRelations,relationProof,ageEvidence,requestedAgeFromFolded} from '../reports/search-phase3-hardening-2026-10-22/baseline/search-relations';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const dir='reports/search-discovery-phase3-2026-10-22/';
const cards=read(dir+'evidence-cards.json'), old=read(dir+'before-cards.json');
const rows=read('reports/search-founder-review-2026-10-21/read-only-catalog-projection.json').rows;
const card=(slug:string)=>cards.find((c:any)=>c.dataset.productSlug===slug);
const slugs=(cs:any[])=>cs.map(c=>c.dataset.productSlug);
const result=(q:string,manual?:any)=>searchHomepage(cards,q,manual).cards;
function synthetic(desc:string,changes:any={}) {
 const base=card('damski-set-boho-earth').dataset;
 const d={...base,productId:'new-test',productSlug:'new-test',productName:'Комплект риза и панталон',materials:'',colors:'',sourceEvidence:'',...changes};
 const binding=Object.fromEntries(['productId','productSlug','productName','productType','publicCategory','publicSubcategory','materials'].map(k=>[k,d[k]||'']));
 const p={id:d.productId,slug:d.productSlug,name_bg:d.productName,product_type:d.productType,materials:[],short_desc_bg:desc,long_desc_bg:desc,product_url:'https://example.invalid/product'};
 d.sourceEvidence=JSON.stringify(compileSearchEvidence(p as any,binding as any));return {dataset:d};
}
for(const [q,b,a] of [['обеци',32,39],['риза',30,37],['сребърни обеци',22,26],['памучна риза',18,21]] as const)
 test(`Phase 3 exact real recovery and old ordered prefix: ${q}`,()=>{const before=searchHomepage(old,q,undefined,{discoveryRelations:false}).cards,after=result(q);assert.equal(before.length,b);assert.equal(after.length,a);assert.deepEqual(slugs(after.slice(0,b)),slugs(before));assert.equal(new Set(slugs(after)).size,a);});
test('related component material does not become set-wide cotton proof',()=>{
 const c=card('komplekt-s-etno-motivi-kenarena-riza-pola-i-karpa');assert.ok(searchHomepage([c],'памучна риза').cards.includes(c));
 assert.equal(searchHomepage([c],'риза',{productType:'Ризи'}).cards.length,0);
 assert.equal(searchHomepage([c],'риза',{category:'cosmetics'}).cards.length,0);
 assert.equal(searchHomepage([c],'риза до 1 евро').cards.length,0);
 assert.equal(searchHomepage([c],'ленена риза').cards.length,0);
});
for(const desc of ['Комплектът включва риза по избор.','Комплектът включва боди тип риза.','Комплектът включва мотив като риза.','Комплектът включва риза. Ризата не е включена.'])
 test(`optional/comparison/excluded abstention: ${desc}`,()=>assert.equal(relationProof(synthetic(desc),'contains_item','shirt').length,0));
test('unseen aggregate generic includes creates component only',()=>{const c=synthetic('Комплектът включва риза и панталон.');assert.ok(relationProof(c,'contains_item','shirt').length);assert.equal(relationProof(c,'contains_item','shirt')[0].scope,'component');assert.equal(searchHomepage([c],'памучна риза').cards.length,0);});
test('negative chains retain source provenance',()=>{for(const slug of ['vodni-koncheta','mini-kapchitsi','srebaren-komplekt-rayska-perla'])assert.ok(discoveryRelations(card(slug)).some(r=>r.concept==='chain'&&r.polarity==='negative'));assert.ok(!slugs(result('верижка')).includes('srebaren-komplekt-rayska-perla'));});
test('source offsets point to exact original source text',()=>{for(const c of cards){const r=rows.find((r:any)=>r.slug===c.dataset.productSlug);for(const claim of discoveryRelations(c)){if(['name_bg','short_desc_bg','long_desc_bg'].includes(claim.field))assert.equal(r[claim.field].slice(claim.start,claim.start+claim.text.length),claim.text);}}});
test('birthday union retains old20; giftability strict; English equivalent',()=>{assert.equal(result('подарък за рожден ден').length,69);assert.deepEqual(slugs(result('birthday gift')).sort(),slugs(result('подарък за рожден ден')).sort());for(const c of result('birthday gift'))assert.equal(c.dataset.giftable,'1');});
test('offered white is a variant; manual stored color stays strict',()=>{const c=card('album-za-momche-raketa');assert.ok(searchHomepage([c],'бял албум').cards.includes(c));assert.ok(relationProof(c,'offered_variant','Бял').length);assert.equal(searchHomepage([c],'бял албум',{colors:['Бял']}).cards.length,0);});
for(const desc of ['Предлага се в бял цвят на кутията.','Предлага се в син цвят на подплатата.','Бял декоративен мотив.'])
 test(`not a whole-product offered color: ${desc}`,()=>assert.equal(discoveryRelations(synthetic(desc)).filter(r=>r.kind==='offered_variant').length,0));
test('typed age parser units/ranges/thresholds, not arbitrary numbers',()=>{assert.equal(requestedAgeFromFolded('na 6 mesetsa')?.age.unit,'months');assert.deepEqual(requestedAgeFromFolded('ot 3 do 7 godini')?.age,{min:3,max:7,unit:'years'});assert.equal(requestedAgeFromFolded('nad 6 godini')?.age.minInclusive,false);assert.equal(requestedAgeFromFolded('razmer 50'),undefined);const q=interpretHomepageQuery('подарък за дете от 3 до 7 години');assert.equal(q.maxPriceEur,undefined);assert.equal(q.requestedAge?.max,7);});
test('strict source threshold, ranges, months and size abstention',()=>{
 const c=synthetic('Подходящ за деца над 6 години.');assert.equal(ageEvidence(c,{min:6,max:6,unit:'years'},[]),'contradicted');assert.equal(ageEvidence(c,{min:7,max:7,unit:'years'},[]),'supported');
 const mixed=synthetic('Подходящ за деца на възраст от 3 месеца до 12 години.');assert.equal(ageEvidence(mixed,{min:6,max:6,unit:'months'},[]),'supported');
 const size=synthetic('Предлага се в размери за възраст от 6 месеца до 12 години.');assert.equal(ageEvidence(size,{min:6,max:6,unit:'years'},[]),'unknown');
});
test('canonical ages only, no gender inference or decimal repair',()=>{const c={dataset:{...card('damski-set-boho-earth').dataset,sourceEvidence:'',recipientAge:'20.25',recipients:'За жена'}};assert.equal(ageEvidence(c,{min:20,max:20,unit:'years'},['За жена']),'unknown');c.dataset.recipientAge='50';assert.equal(ageEvidence(c,{min:50,max:50,unit:'years'},['За жена']),'supported');assert.equal(ageEvidence(c,{min:60,max:60,unit:'years'},['За жена']),'contradicted');});
test('teacher synonyms preserve legacy adjacent results without gender/age',()=>{assert.equal(result('подарък за учител').length,3);assert.equal(result('подарък за учителка').length,3);assert.equal(result('teacher').length,3);const q=interpretHomepageQuery('teacher');assert.deepEqual(q.recipients,[]);assert.equal(q.requestedAge,undefined);assert.equal(relationProof(synthetic('Създадено от учителка.'),'role','Учителка').length,0);});
for(const q of ['skincare','handmade','housewarming','подарък за майка ми','подарък за мама на 60 години'])
 test(`protected exact ordered results: ${q}`,()=>assert.deepEqual(slugs(result(q)),slugs(searchHomepage(old,q,undefined,{discoveryRelations:false}).cards)));

for(const desc of ['Производителят предлага подаръчна опаковка.','Включва подаръци като стикери.','За декорация на подаръци.'])
 test(`gift purpose excludes incidental evidence: ${desc}`,()=>{const p={id:'x',slug:'x',name_bg:'Артикул',product_type:'Комплект',short_desc_bg:desc,long_desc_bg:desc,gift_occasion:'Рожден ден'};const rs=compileDiscoveryRelations(p as any,{} as any);assert.ok(!rs.some(r=>r.kind==='occasion'&&r.status==='approved'));});

test('conditional inclusion is not an included item',()=>assert.equal(relationProof(synthetic('Комплектът може да включва риза.'),'contains_item','shirt').length,0));
test('silver-colored component is not a silver material claim',()=>{const c=synthetic('Комплектът включва сребърно оцветени обеци.',{publicCategory:'accessories',productType:'Комплекти бижута'});assert.ok(!relationProof(c,'contains_item','earrings').some(r=>r.materials?.includes('Сребро')));});
test('missing provenance binding and stale product binding cannot activate relations',()=>{const c=synthetic('Комплектът включва риза.');const e=JSON.parse(c.dataset.sourceEvidence);delete e.binding;assert.equal(discoveryRelations({dataset:{...c.dataset,sourceEvidence:JSON.stringify(e)}}).length,0);assert.equal(discoveryRelations({dataset:{...c.dataset,productName:'Different'}}).length,0);});
test('negated occasion does not activate source occasion',()=>assert.equal(relationProof(synthetic('Подарък, но не за кръщене.'),'occasion','Кръщене').length,0));
test('negated offered color abstains rather than proving the wrong option',()=>assert.equal(relationProof(synthetic('Предлага се в син цвят, но не в бял.'),'offered_variant','Бял').length,0));
test('negated teacher purpose cannot activate role',()=>assert.equal(relationProof(synthetic('Артикулът е не за учителка.'),'role','Учителка').length,0));
test('negated age suitability is not positive age proof',()=>assert.equal(ageEvidence(synthetic('Не е подходящ за деца над 6 години.'),{min:7,max:7,unit:'years'},[]),'unknown'));
