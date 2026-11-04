import test from 'node:test';
import assert from 'node:assert/strict';
import { brandContactFields, contactMethods, contactQualityIssue } from '../src/lib/brand-contact';
import { resolvePublishableOffer } from '../src/lib/verified-offer';
import { sanitizeAnalyticsEvent } from '../admin-app/src/lib/analytics-ingestion';

test('Brands normalization keeps no_site authoritative and maps the existing contact fields',()=>{
  assert.equal(brandContactFields({brand_url:''}).no_site,false);
  assert.equal(brandContactFields({no_site:'true'}).no_site,false);
  const b=brandContactFields({no_site:true,facebook_url:'https://facebook.com/example',address:'ул. Пример 12',physical_address_type:'Магазин'});
  assert.equal(b.no_site,true);assert.equal(contactMethods(b).store,'ул. Пример 12');
});
for (const [name,fields,expected] of [
 ['website',{no_site:false},[]],
 ['instagram',{no_site:true,instagram_url:'https://instagram.com/example'},['instagram']],
 ['facebook',{no_site:true,facebook_url:'https://facebook.com/example'},['facebook']],
 ['email',{no_site:true,email:'brand@example.test'},['email']],
 ['multiple',{no_site:true,instagram_url:'https://instagram.com/example',facebook_url:'https://facebook.com/example',email:'brand@example.test'},['instagram','facebook','email']],
 ['retail',{no_site:true,address_bg:'ул. Пример 12',physical_address_type:'Магазин'},['store']],
 ['no contacts',{no_site:true},[]],
 ['empty website',{no_site:false,website_url:''},[]],
] as const) test(name,()=>{
 const contacts=contactMethods(fields);
 assert.deepEqual(['instagram','facebook','email','store'].filter(k=>contacts[k as keyof typeof contacts]),expected);
 assert.equal(contacts.available,expected.length>0);
 assert.equal(Boolean(contactQualityIssue(fields)),fields.no_site && expected.length===0);
});
test('invalid contacts and non-retail addresses never become actions',()=>{
 for(const type of ['', 'Офис','Работилница','Производство','Ателие']) assert.equal(contactMethods({physical_address_type:type,address_bg:'ул. Пример 12'}).available,false);
 assert.equal(contactMethods({instagram_url:'javascript:alert(1)',facebook_url:'https://facebook.com.evil.test/example',email:'not email'}).available,false);
 assert.equal(contactMethods({physical_address_type:'Шоурум',address_bg:'ул. Пример 12'}).available,true);
 assert.equal(contactMethods({physical_address_type:'Магазин',address_bg:'няма'}).available,false);
});
test('no-site products cannot publish an online Offer even with stale verified fields',()=>{
 assert.equal(resolvePublishableOffer({no_site:true,offer_price_status:'verified_current'}),null);
});
test('inquiry events survive ingestion with identifiers and no contact PII',()=>{
 for(const event_name of ['inquiry_open','inquiry_contact_click','physical_store_click']){
 const event=sanitizeAnalyticsEvent({event_name,product_id:'12',brand_id:'34',contact_method:'email',page_path:'/p/example/',email:'secret@example.test'});
 assert.ok(event); assert.equal(event.metadata.contact_method,'email');assert.equal(event.metadata.page_path,'/p/example/');assert.equal(event.metadata.email,undefined);
 }
});

test('Brands.email passes through shared normalization without depending on no_site or website',()=>{
 for(const no_site of [true,false]){
 const brand=brandContactFields({no_site,email:'  hello@example.test  ',brand_url:''});
 assert.equal(brand.email,'hello@example.test');assert.equal(brand.no_site,no_site);assert.equal(contactMethods(brand).email,'hello@example.test');
 }
 assert.equal(contactMethods(brandContactFields({no_site:true,email:'invalid'})).email,'');
});
