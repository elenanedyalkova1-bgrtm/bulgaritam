import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source = readFileSync(new URL('../src/components/SeoProductLanding.astro', import.meta.url), 'utf8');
const loadMoreSource = source.slice(source.indexOf('    const loadMore = async'), source.indexOf('\n    // A history return'));
function harness({fail=false, count=48, totalPages=3}={}) {
  const frames=[], requests=[];
  const context={pageOrder:[1,2,3],appendInProgress:false,autoLoadPaused:false,restoringFeed:false,visibleCount:48,loadedThroughPage:1,totalPages,
    getFilteredCards:()=>Array(count).fill({}),getBatchSize:()=>8,
    feedStatus:{textContent:''},feedLoadMore:{hidden:false,textContent:'Покажи още'},
    feedSentinel:{hidden:false,getBoundingClientRect:()=>({top:100,bottom:110})},
    window:{innerHeight:844},requestAnimationFrame:fn=>frames.push(fn),
    loadStaticPage:async page=>{requests.push(page);if(fail)throw Error('Pagination 503');context.loadedThroughPage=page;count+=48;return true;},
    updateFeedVisibility:()=>{context.feedSentinel.hidden=count<=context.visibleCount&&context.loadedThroughPage>=totalPages;},
  };
  runInNewContext(loadMoreSource+'\nthis.loadMore=loadMore;',context);
  return {context,frames,requests};
}
test('failed page fetch stops automatic retries and retains displayed products',async()=>{
 const h=harness({fail:true});await h.context.loadMore();
 assert.equal(h.requests.length,1);assert.equal(h.frames.length,0);
 assert.equal(h.context.visibleCount,48);assert.equal(h.context.loadedThroughPage,1);
 assert.equal(h.context.appendInProgress,false);assert.equal(h.context.autoLoadPaused,true);
 assert.equal(h.context.feedLoadMore.hidden,false);
});
test('manual retry can recover without resetting loaded products',async()=>{
 const h=harness({fail:true});await h.context.loadMore();
 h.context.loadStaticPage=async page=>{h.requests.push(page);h.context.loadedThroughPage=page;h.context.getFilteredCards=()=>Array(96).fill({});};
 await h.context.loadMore();assert.equal(h.context.visibleCount,56);assert.equal(h.context.autoLoadPaused,false);
});
test('successful pages retain automatic infinite scrolling',async()=>{
 const h=harness();await h.context.loadMore();assert.equal(h.context.visibleCount,56);assert.equal(h.frames.length,1);
});
test('exhausted feed hides sentinel and does not create a frame loop',async()=>{
 const h=harness({totalPages:1});await h.context.loadMore();assert.equal(h.frames.length,0);assert.equal(h.requests.length,0);
});

const historySource=source.slice(source.indexOf('    // A history return'),source.indexOf('\n    refinementInputs.forEach((input) => {\n      input.addEventListener'));
function historyHarness(type, saved, fail=false) {
 const loads=[],scrolls=[],listeners={};
 const scroller={scrollHeight:20000,scrollTop:0,scrollTo:({top})=>scrolls.push(top)};
 const inputs=[{dataset:{filterGroup:'price'},value:'100+',checked:false}];
 const context={pageOrder:[1,2,3],initialPage:1,initialCards:[],assignDiscoveryRanks(){},ensureAllStaticPages:async()=>{},window:{location:{pathname:'/gifts/',search:''},innerHeight:844,addEventListener:(name,fn)=>listeners[name]=fn},
  document:{body:scroller,documentElement:{scrollHeight:844}},sessionStorage:{getItem:()=>JSON.stringify(saved),setItem(){}},
  performance:{getEntriesByType:()=>[{type}]},parseJson:JSON.parse,loadedStaticPages:new Set([1]),totalPages:3,
  loadStaticPage:async page=>{if(page===1)return false;loads.push(page);if(fail)throw Error('offline');},supportedSorts:new Set(['featured','price-asc']),
  normalizeFacetValue:(group,value)=>value,refinements:{open:false},selectedSort:'featured',landingSortSelect:{value:'featured'},refinementInputs:inputs,filtersTouched:false,visibleCount:8,
  allCards:Array(144).fill({}),getBatchSize:()=>8,commitSeoDiscoveryState(){},updateFeedVisibility(){return[];},
  requestAnimationFrame:fn=>fn(),restoringFeed:true,autoLoadPaused:false,
  feedSentinel:{hidden:true},feedStatus:{textContent:''},feedLoadMore:{hidden:true,textContent:''},loadMore(){},
 };
 runInNewContext(historySource.replace('    initializeFeed();','    this.ready = initializeFeed();'),context);
 return {context,loads,scrolls,inputs};
}
const saved={filtersOpen:true,pages:[1,2,3],visibleCount:112,selectedSort:'price-asc',filtersTouched:true,filters:[{group:'price',value:'100+'}],scrollTop:25000};
test('cold Back restores loaded extent, filters, sort and scroll after masonry',async()=>{
 const h=historyHarness('back_forward',saved);await h.context.ready;
 assert.deepEqual(h.loads,[2,3]);assert.equal(h.context.visibleCount,112);
 assert.equal(h.context.selectedSort,'price-asc');assert.equal(h.inputs[0].checked,true);
 assert.equal(h.context.refinements.open,true);
 assert.deepEqual(h.scrolls,[25000]);assert.equal(h.context.restoringFeed,false);
});
for(const type of ['navigate','reload'])test(type+' does not restore stale history UI',async()=>{
 const h=historyHarness(type,saved);await h.context.ready;
 assert.deepEqual(h.loads,[]);assert.deepEqual(h.scrolls,[]);assert.equal(h.context.visibleCount,8);
});
test('failed history fetch does not leave scrolling locked or retry in a loop',async()=>{
 const h=historyHarness('back_forward',saved,true);await h.context.ready;
 assert.equal(h.context.restoringFeed,false);assert.equal(h.context.autoLoadPaused,true);
 assert.equal(h.context.feedLoadMore.hidden,false);assert.deepEqual(h.scrolls,[]);
});
