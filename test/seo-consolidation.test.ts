import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SEO_INTENT_LANDINGS, SEO_LANDINGS, PUBLIC_LANDING_GRAPH,
  getProductsForIntentLanding, getProductsForLanding, getLandingPageHierarchy,
  getPublicLandingPathForStructuredTaxonomy, resolveSeoLandingForState,
} from '../src/lib/seo-landings';
import type { Product } from '../src/lib/products';
const fixture = (fields: Partial<Product>): Product => ({
  id: 'fixture', slug: 'fixture', name_bg: 'Чанта за жена', category: 'Аксесоари',
  subcategory: 'Чанти и портфейли', product_type: 'Чанти', audience: ['Жени'],
  materials: ['Естествена кожа'], tags: [], recipient: [], gift_occasion: [],
  attributes: [], recipient_age: [], recipient_gender: [], giftable: false,
  ...fields,
} as Product);
const intent = (key: string) => SEO_INTENT_LANDINGS.find(l=>l.key===key)!;
test('bags membership uses exact taxonomy, type, audience and material, never product wording', () => {
  assert.equal(intent('clothing_bags').categoryKey,'accessories');
  assert.equal(intent('clothing_bags').group,'discovery');
  assert.equal(intent('women_bags').group,'discovery');
  const products = [fixture({id:'woman'}), fixture({id:'man',audience:['Мъже']}),
    fixture({id:'textile',materials:['Памук']}), fixture({id:'backpack',product_type:'Раници'}),
    fixture({id:'keyring',subcategory:'Мъжки аксесоари',product_type:'Ключодържатели'}),
    fixture({id:'untyped',product_type:''}), fixture({id:'wrong-category',category:'Облекло'})];
  assert.deepEqual(getProductsForIntentLanding(products,intent('clothing_bags')).map(p=>p.id),['woman','man','textile']);
  assert.deepEqual(getProductsForIntentLanding(products,intent('women_bags')).map(p=>p.id),['woman','textile']);
  assert.deepEqual(getProductsForIntentLanding(products,intent('bg_leather_bags')).map(p=>p.id),['woman','man']);
  assert.equal(resolveSeoLandingForState(intent('clothing_bags').structuredState!)?.path,'/bulgarski-drehi/chanti/');
  assert.equal(getPublicLandingPathForStructuredTaxonomy(products[0],'product_type'),'/bulgarski-drehi/chanti/');
  assert.deepEqual(getLandingPageHierarchy('clothing_bags').breadcrumbs.map(b=>b.name),['Начало','Аксесоари','Чанти и портфейли','Чанти от български брандове']);
});
test('one woman birthday destination and distinct man occasion subset', () => {
  assert.ok(!SEO_INTENT_LANDINGS.some(l=>l.path==='/podarak-za-zhena-za-rozhden-den/'));
  assert.equal(resolveSeoLandingForState({giftable:['true'],recipient:['За жена'],gift_occasion:['Рожден ден']})?.path,'/podarak-za-rozhden-den-na-zhena/');
  const general = SEO_LANDINGS.find(l=>l.subcategoryKey==='gifts_for_him'&&!l.hidden)!;
  const products=[fixture({id:'birthday',giftable:true,recipient:['За мъж'],gift_occasion:['Рожден ден']}),fixture({id:'wedding',giftable:true,recipient:['За мъж'],gift_occasion:['Сватба']}),fixture({id:'untagged',giftable:true,recipient:['За мъж']})];
  assert.equal(getProductsForLanding(products,general).length,3);
  assert.deepEqual(getProductsForIntentLanding(products,intent('gift_man_birthday')).map(p=>p.id),['birthday']);
});
test('kids canonical retains taxonomy identity, parent, membership and filter routing', () => {
  const child = SEO_LANDINGS.find(l=>l.subcategoryKey==='kids_clothing'&&!l.hidden)!;
  const hierarchy=getLandingPageHierarchy(child);
  assert.equal(hierarchy.current.key,'kids_clothing');
  assert.equal(hierarchy.parent?.key,'kids');
  assert.equal(hierarchy.canonicalUrl,'/bulgarski-detski-drehi/');
  assert.equal(hierarchy.seoLanding.h1,'Български детски дрехи');
  assert.equal(PUBLIC_LANDING_GRAPH.filter(n=>n.canonicalUrl===hierarchy.canonicalUrl).length,1);
  const p=fixture({category:'Деца и бебе',subcategory:'Детско облекло',product_type:'Рокли'});
  assert.equal(getProductsForLanding([p],child).length,1);
  assert.equal(getPublicLandingPathForStructuredTaxonomy(p,'subcategory'),hierarchy.canonicalUrl);
  assert.equal(resolveSeoLandingForState({category:['Деца и бебе'],subcategory:['Детско облекло']})?.path,hierarchy.canonicalUrl);
});
