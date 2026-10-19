import assert from 'node:assert/strict';
import test from 'node:test';
import { getRelevantLandingsForProduct, getLandingGraphNode, getProductsForIntentLanding, getProductsForLanding, serializeSeoLandingState } from '../src/lib/seo-landings';
import { normalizeProductType } from '../admin-app/src/lib/product-taxonomy';
import { PUBLIC_BROWSE_CATEGORIES } from '../src/lib/public-browse-taxonomy';
import type { Product } from '../src/lib/products';
const product = (fields: Partial<Product> = {}) => ({id:'fixture',slug:'fixture',name_bg:'Ленена рокля подарък за жена',category:'Спорт и туризъм',subcategory:'Туризъм и къмпинг',product_type:'Плажни и туристически кърпи',giftable:false,materials:['Полиестер'],attributes:[],audience:[],recipient:[],recipient_age:[],recipient_gender:[],gift_occasion:[],tags:[],...fields}) as Product;
test('taxonomy-only towel receives its canonical sports selection without title inference',()=>{
 const p=product();const links=getRelevantLandingsForProduct(p,4,[p]);
 assert.deepEqual(links.map(l=>'path' in l?l.path:''),['/k/sport/']);
});
test('unknown taxonomy is not assigned selections from persuasive title keywords',()=>{
 const p=product({category:'Unknown',subcategory:'',product_type:''});
 assert.deepEqual(getRelevantLandingsForProduct(p,4,[p]),[]);
});
test('related selections are deduplicated, compact and use actual destination membership',()=>{
 const p=product({category:'Облекло',subcategory:'Дамско облекло',product_type:'Рокли',materials:['Лен'],audience:['Жени']});
 const links=getRelevantLandingsForProduct(p,20,[p]);
 assert.ok(links.length>0&&links.length<=4);
 assert.equal(new Set(links.map(l=>'path' in l?l.path:'')).size,links.length);
 for(const l of links){const n=getLandingGraphNode(l)!;assert.ok(n);assert.equal('path' in l?l.path:'',n.canonicalUrl);assert.equal((n.pageType==='intent'?getProductsForIntentLanding([p],n.landing as any):getProductsForLanding([p],n.landing as any)).length,1);}
});
test('legacy jacket values normalize consistently while coats remain distinct',()=>{
 assert.equal(normalizeProductType('Палта и якета'),'Якета');
 assert.equal(normalizeProductType('ПАЛТА И ЯКЕТА'),'Якета');
 assert.equal(normalizeProductType('Палта'),'Палта');
 assert.equal(serializeSeoLandingState({product_type:['Палта и якета']}),serializeSeoLandingState({product_type:['Якета']}));
 const types=PUBLIC_BROWSE_CATEGORIES.flatMap(c=>c.subcategories.flatMap(s=>s.productTypes));
 assert.ok(types.includes('Палта'));assert.ok(types.includes('Якета'));assert.ok(!types.includes('Палта и якета'));
});
