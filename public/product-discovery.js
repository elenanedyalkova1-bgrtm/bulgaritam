/* One session plan over disjoint static pages, never a fresh shuffle per fetch.
 * Pages remain crawlable; JS progressively enhances their deterministic HTML.
 */
(() => {
  let seed;
  try {
    const saved = sessionStorage.getItem('bulgaritam:discovery-seed:v1');
    seed = saved === null ? undefined : Number(saved);
  } catch {}
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    seed = globalThis.crypto?.getRandomValues
      ? crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 0x100000000);
    try { sessionStorage.setItem('bulgaritam:discovery-seed:v1', String(seed)); } catch {}
  }
  window.bulgaritamDiscoveryPlan = (totalPages, singlePageCount = 48) => {
    let state = seed;
    const shuffle = (items) => {
      for (let i = items.length - 1; i > 0; i--) {
        state += 0x6D2B79F5;
        let value = Math.imul(state ^ (state >>> 15), 1 | state);
        value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
        const j = Math.floor(((value ^ (value >>> 14)) >>> 0) / 0x100000000 * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    };
    const pages = shuffle(Array.from({ length: totalPages }, (_, i) => i + 1));
    // Only a one-page collection needs a card permutation. Multi-page feeds use
    // the single page permutation above and the diversified static card order.
    const positions = totalPages === 1 ? shuffle(Array.from({ length: singlePageCount }, (_, i) => i)) : null;
    return { pages, rank: (page, index) => pages.indexOf(page) * 48 + (positions ? positions.indexOf(index) : index) };
  };
})();
