import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/scripts/save-discoverability.js', import.meta.url), 'utf8');
const HINT = 'bulgaritam_save_hint_seen_v1';
const SAVED = 'bulgaritam_saved_boards_v1';

function environment({ touch = true, storage = new Map(), storageDenied = false, saved = false } = {}) {
  const listeners = new Map();
  const timers = new Map();
  let timerId = 0;
  const makeElement = () => {
    const events = new Map(), attributes = new Map(), classes = new Set();
    return {
      events, attributes, dataset: {}, hidden: true, isConnected: true,
      classList: { contains: x => classes.has(x), add: x => classes.add(x) },
      setAttribute: (k,v) => attributes.set(k,v), removeAttribute: k => attributes.delete(k),
      getAttribute: k => attributes.get(k) ?? null,
      addEventListener: (k,fn) => events.set(k,fn),
      getBoundingClientRect: () => ({ top: 200, bottom: 238, width: 38 }),
      matches: () => false, contains: () => false,
    };
  };
  const button = makeElement(); button.setAttribute('aria-pressed', String(saved));
  const feedback = makeElement(), close = makeElement();
  feedback.querySelector = () => close;
  const buttons = [button];
  const media = { matches: touch, addEventListener() {} };
  let intersection;
  let blocked = false;
  const add = (name,fn) => { const list = listeners.get(name) || []; list.push(fn); listeners.set(name,list); };
  const emit = (name,event={}) => (listeners.get(name) || []).forEach(fn => fn(event));
  const context = {
    window: { matchMedia: () => media, addEventListener: add, setTimeout: (fn,ms) => {timers.set(++timerId,{fn,ms});return timerId;} },
    document: {
      visibilityState: 'visible', addEventListener: add,
      querySelectorAll: () => buttons,
      querySelector: selector => selector.startsWith('#save-modal') && blocked ? {} : null,
      getElementById: () => feedback,
    },
    localStorage: {
      getItem: k => { if(storageDenied) throw Error('denied'); return storage.get(k) ?? null; },
      setItem: (k,v) => {if(storageDenied) throw Error('denied');storage.set(k,v);},
    },
    IntersectionObserver: class {
      constructor(fn) { intersection=this;this.callback=fn;this.observed=new Set(); }
      observe(el) {this.observed.add(el);} disconnect(){this.observed.clear();}
    },
    clearTimeout: id => timers.delete(id), requestAnimationFrame: fn => fn(), innerHeight: 844,
  };
  context.window.IntersectionObserver = context.IntersectionObserver;
  vm.runInNewContext(source,context);
  return {
    button, feedback, close, storage, buttons, emit, intersection, timers,
    block(value){blocked=value;},
    enter(){intersection.callback([{target:button,isIntersecting:true,intersectionRatio:1}]);},
    expire(ms){for(const [id,timer] of [...timers])if(timer.ms===ms){timers.delete(id);timer.fn();}},
    makeElement,
  };
}

test('touch hint is persisted once, expires, and stays absent on next page load', () => {
  const e=environment();e.enter();assert.equal(e.button.attributes.has('data-save-hint'),true);
  assert.equal(e.storage.get(HINT),'1');e.expire(5500);assert.equal(e.button.attributes.has('data-save-hint'),false);
  e.enter();assert.equal(e.button.attributes.has('data-save-hint'),false);
  const next=environment({storage:e.storage});next.enter();assert.equal(next.button.attributes.has('data-save-hint'),false);
});

test('existing saved products, saved button, desktop and blocked storage do not receive hint', () => {
  for(const opts of [{storage:new Map([[SAVED,JSON.stringify({items:{all:[{id:'prior'}]}})]])},{saved:true},{touch:false},{storageDenied:true}]){
    const e=environment(opts);e.enter();assert.equal(e.button.attributes.has('data-save-hint'),false);
  }
});

test('hint waits for a covering dialog to close without needing a new intersection', () => {
  const e=environment();e.block(true);e.enter();assert.equal(e.storage.has(HINT),false);
  e.block(false);e.emit('click');assert.equal(e.button.attributes.has('data-save-hint'),true);
});

test('only successful save confirmation shows feedback; focus pauses dismissal', () => {
  const e=environment();e.emit('bulgaritam:saved');assert.equal(e.feedback.hidden,true);
  e.emit('bulgaritam:save-confirmed');assert.equal(e.feedback.hidden,false);assert.equal(e.storage.get(HINT),'1');
  e.feedback.events.get('focusin')();e.expire(8000);assert.equal(e.feedback.hidden,false);
  e.feedback.events.get('focusout')({relatedTarget:null});e.expire(8000);assert.equal(e.feedback.hidden,true);
});

test('lazy appended cards receive labels and saved wording without child mutations', () => {
  const e=environment({touch:false});assert.equal(e.button.dataset.saveLabel,'Запази');
  const next=e.makeElement();next.setAttribute('aria-pressed','true');e.buttons.push(next);
  e.emit('bulgaritam:products-appended');assert.equal(next.dataset.saveLabel,'Запазено');
  assert.equal(next.classList.contains('save-discoverable'),true);
});

test('saving in another tab suppresses onboarding immediately', () => {
  const e=environment();e.enter();e.storage.set(SAVED,JSON.stringify({items:{all:[{id:'other'}]}}));
  e.emit('storage',{key:SAVED});assert.equal(e.button.attributes.has('data-save-hint'),false);
});
