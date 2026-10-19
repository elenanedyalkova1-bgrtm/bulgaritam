// Static fallback is safe without JS. Historical amounts live only in inert
// templates until the browser checks their original verification/expiry dates.
export function referenceIsFresh(verifiedAt, expiresAt, now = Date.now()) {
  const verified = Date.parse(verifiedAt), expires = Date.parse(expiresAt);
  return Number.isFinite(now) && Number.isFinite(verified) && Number.isFinite(expires)
    && verified <= now && expires - verified === 90 * 86400000 && now <= expires;
}
export function initializeManualPriceGates(doc = document, win = window) {
  const gates = [...doc.querySelectorAll('[data-manual-price-gate]')];
  if (!gates.length) return;
  let timer;
  const check = () => {
    win.clearTimeout(timer);
    const now = Date.now();
    let next = Infinity;
    for (const gate of gates) {
      const live = gate.querySelector('[data-reference-live]');
      const fallback = gate.querySelector('[data-reference-fallback]');
      const template = gate.querySelector('[data-reference-template]');
      const fresh = !doc.hidden && referenceIsFresh(gate.dataset.verifiedAt, gate.dataset.expiresAt, now);
      if (fresh) {
        if (!live.childElementCount) live.append(template.content.cloneNode(true));
        fallback.hidden = true;
        next = Math.min(next, Date.parse(gate.dataset.expiresAt) - now + 1);
      } else {
        live.replaceChildren();
        fallback.hidden = false;
      }
    }
    if (Number.isFinite(next)) timer = win.setTimeout(check, Math.min(next, 60000));
  };
  doc.addEventListener('visibilitychange', check);
  win.addEventListener('pageshow', check);
  check();
}
