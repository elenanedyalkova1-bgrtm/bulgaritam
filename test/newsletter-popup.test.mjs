import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/layouts/BaseLayout.astro',import.meta.url),'utf8');
const script=source.match(/<script is:inline define:vars=\{\{ newsletterEndpoint, suppressNewsletterAutoOpen \}\}>([\s\S]*?)<\/script>/)[1];
function setup({dismissed=false,suppressed=false,discount=false}={}){
 const timers=new Map(),storage=new Map(dismissed?[['bulgaritam_newsletter_dismissed_v1','1']]:[]),listeners={},requests=[];
 let timerId=0;
 const element=()=>({handlers:{},addEventListener(n,f){this.handlers[n]=f;},classList:{add(){},remove(){}},focus(){}});
 const email=element(),preferences=[discount,false,false].map(checked=>({...element(),checked,setCustomValidity(v){this.error=v;}}));
 const submit=element(),status=element(),manual=element(),close=element();
 const form={...element(),querySelectorAll:()=>preferences,querySelector:s=>s.includes('submit')?submit:status,reportValidity:()=>!preferences[0].error,reset(){}};
 const modal={...element(),hidden:true,querySelector:s=>s==='form'?form:email,querySelectorAll:()=>[close],removeAttribute(){this.hidden=false;},setAttribute(){this.hidden=true;}};
 const document={getElementById:()=>modal,activeElement:element(),documentElement:{classList:{add(){},remove(){}}},querySelectorAll:()=>[manual],addEventListener:(n,f)=>listeners[n]=f};
 const context={document,sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},newsletterEndpoint:'https://test.invalid/newsletter',suppressNewsletterAutoOpen:suppressed,
  window:{setTimeout(fn,ms){timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id)},
  FormData:class{get(k){return k==='name'?'Test':k==='email'?'test@example.com':null;}has(k){return preferences[['preference_discounts','preference_discoveries','preference_for_brands'].indexOf(k)]?.checked||false;}},
  fetch:async(url,init)=>{requests.push(JSON.parse(init.body));return{ok:true,json:async()=>({accepted:true})};},
 };
 runInNewContext(script,context);
 return{timers,storage,modal,manual,close,form,preferences,requests,fire(){const t=[...timers.values()].find(t=>t.ms===25000);assert.ok(t);t.fn();}};
}
test('automatic popup is scheduled at 25 seconds, not 15',()=>{const h=setup();assert.deepEqual([...h.timers.values()].map(t=>t.ms),[25000]);assert.equal(h.modal.hidden,true);h.fire();assert.equal(h.modal.hidden,false);});
test('existing session dismissal and partner suppression prevent automatic opening',()=>{for(const opts of [{dismissed:true},{suppressed:true}])assert.equal(setup(opts).timers.size,0);});
test('manual opening cancels timer; dismissal persists and cannot reopen automatically',()=>{const h=setup();h.manual.handlers.click();assert.equal(h.modal.hidden,false);assert.ok(![...h.timers.values()].some(t=>t.ms===25000));h.close.handlers.click();assert.equal(h.modal.hidden,true);assert.equal(h.storage.get('bulgaritam_newsletter_dismissed_v1'),'1');});
test('timer checks suppression again before opening',()=>{const h=setup();h.storage.set('bulgaritam_newsletter_dismissed_v1','1');h.fire();assert.equal(h.modal.hidden,true);});
test('discount version submits only the visible selected primary topic by default',async()=>{const h=setup({discount:true});await h.form.handlers.submit({preventDefault(){}});assert.deepEqual(h.requests,[{name:'Test',email:'test@example.com',discounts_opt_in:true,new_finds_opt_in:false,brand_insights_opt_in:false}]);assert.equal(h.storage.get('bulgaritam_newsletter_dismissed_v1'),'1');assert.ok(![...h.timers.values()].some(t=>t.ms===25000));});
test('generic version requires an explicit topic choice',async()=>{const h=setup();await h.form.handlers.submit({preventDefault(){}});assert.equal(h.requests.length,0);h.preferences[1].checked=true;h.preferences[1].handlers.change();await h.form.handlers.submit({preventDefault(){}});assert.equal(h.requests[0].discounts_opt_in,false);assert.equal(h.requests[0].new_finds_opt_in,true);assert.equal(h.requests[0].brand_insights_opt_in,false);});
