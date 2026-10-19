import { deriveDealFacets } from "../lib/deal-facets.mjs";

import { CONSUMER_DEALS_ENDPOINT, DEAL_MAX_AGE_MS, DEAL_REFRESH_MS, DEAL_TIMEOUT_MS, observationIsFresh, validateDealsPayload } from "../lib/consumer-deals-client.mjs";

const money = (amount: number, currency: string) => new Intl.NumberFormat("bg-BG", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
const freshness = (checked: string) => {
  const age = Math.max(0, (Date.now() - Date.parse(checked)) / 3_600_000);
  return age < 24 ? "Проверено днес" : Math.floor(age / 24) === 1 ? "Проверено преди 1 ден" : `Проверено преди ${Math.floor(age / 24)} дни`;
};
const setLink = (node: Element | null, href: string, external: boolean) => { if (!(node instanceof HTMLAnchorElement)) return; node.href = href; if (external) { node.target = "_blank"; node.rel = "noopener noreferrer"; } else { node.removeAttribute("target"); node.removeAttribute("rel"); } };

export function refreshDealFacetOptions(root: ParentNode, deals: any[]) {
  const facets = deriveDealFacets(deals);
  for (const kind of ["category", "brand", "material", "ingredient"] as const) {
    const group = root.querySelector<HTMLElement>(`[data-deal-facet-group="${kind}"]`);
    const container = root.querySelector<HTMLElement>(`[data-deal-facet-options="${kind}"]`);
    if (!group || !container) continue;
    const inputName = kind;
    const selected = new Set(Array.from(container.querySelectorAll<HTMLInputElement>(`input[name="${inputName}"]:checked`)).map((input) => input.value));
    const values = facets[kind];
    container.replaceChildren(...values.map(([value, label]) => {
      const wrapper = document.createElement("label"); wrapper.className = "filter-option filter-option--checkbox";
      const input = document.createElement("input"); input.type = "checkbox"; input.name = inputName; input.value = value; input.checked = selected.has(value);
      const caption = document.createElement("span"); caption.textContent = label;
      // Keep Astro's scoped filter styles on elements created after hydration.
      for (const attribute of Array.from(container.attributes)) {
        if (attribute.name.startsWith("data-astro-cid-")) {
          for (const node of [wrapper, input, caption]) node.setAttribute(attribute.name, attribute.value);
        }
      }
      wrapper.append(input, caption); return wrapper;
    }));
    group.hidden = values.length === 0;
  }
}

function renderDeal(template: HTMLElement, deal: any, index: number) {
  const card = template.cloneNode(true) as HTMLElement; const external = deal.destination_type === "external";
  Object.assign(card.dataset, { entityType: deal.entity_type, entityId: deal.entity_id, destinationType: deal.destination_type, productId: deal.entity_id,
    productSlug: deal.internal_slug || "", analyticsKind: "deal", listContext: "consumer_deals", listName: "Намаления", sourcePage: "namaleniya",
    productName: deal.title, brandId: String(deal.brand_id || ""), brandName: deal.brand, productUrl: deal.outbound_url, productType: deal.product_type || "", dealCategory: deal.deal_category || "", categoryKey: deal.deal_category || "", giftable: deal.giftable ? "1" : "0",
    materials: (deal.materials || []).join("|"), ingredients: (deal.ingredients || []).join("|"), search: deal.search_text || `${deal.title} ${deal.brand}`.toLocaleLowerCase("bg"),
    discountCurrent: String(deal.current_price), currentPrice: String(deal.current_price), checkedAt: deal.latest_checked_at,
    discountPercent: String(deal.discount_percent), discountFacets: JSON.stringify([...(deal.materials || []), ...(deal.ingredients || [])]), discountRowId: deal.entity_id, position: String(index + 1) });
  card.removeAttribute("data-discovery-state-id");
  card.style.removeProperty("--masonry-span");
  card.hidden = false; card.style.removeProperty("display");
  card.querySelectorAll("[data-deal-link='card']").forEach((node) => setLink(node, deal.destination_url, external));
  setLink(card.querySelector("[data-deal-link='outbound']"), deal.outbound_url, true);
  const image = card.querySelector<HTMLImageElement>(".thumb-img"); if (image) { image.src = deal.image_url; image.alt = deal.title; image.loading = index < 4 ? "eager" : "lazy"; image.fetchPriority = index < 4 ? "high" : "auto"; }
  const title = card.querySelector(".card-titlelink"); if (title) title.textContent = deal.title;
  const brand = card.querySelector(".card-sub"); if (brand) brand.textContent = deal.brand;
  const regular = card.querySelector(".discount-price__regular"); if (regular) regular.textContent = money(deal.regular_price, deal.currency);
  const current = card.querySelector(".discount-price__current"); if (current) current.textContent = money(deal.current_price, deal.currency);
  const badge = card.querySelector(".discount-price__badge"); if (badge) badge.textContent = `−${Math.round(deal.discount_percent)}%`;
  const price = card.querySelector(".discount-price");
  if (price instanceof HTMLElement) price.hidden = false;
  if (price) price.setAttribute("aria-label", `Редовна цена ${money(deal.regular_price, deal.currency)}; текуща цена ${money(deal.current_price, deal.currency)}; намаление −${Math.round(deal.discount_percent)}%`);
  const fresh = card.querySelector(".deal-freshness"); if (fresh) fresh.textContent = freshness(deal.latest_checked_at);
  const value=card.querySelector<HTMLElement>("[data-deal-category-value]"); if(value)value.dataset.dealCategoryValue=deal.deal_category||"";
  const badgeContainer=card.querySelector<HTMLElement>(".card-badges");
  const categoryBadge = card.querySelector<HTMLElement>("[data-deal-category-badge]");
  const giftBadge = card.querySelector<HTMLElement>("[data-deal-gift-badge]");
  if (categoryBadge) { if (deal.deal_category) categoryBadge.textContent = deal.deal_category; else categoryBadge.remove(); }
  if (giftBadge && !(deal.giftable===true)) giftBadge.remove();
  // Reuse the template's scoped badge elements instead of creating unstyled spans.
  if (badgeContainer && !badgeContainer.children.length) badgeContainer.remove();
  return card;
}

export function initializeConsumerDeals() {
  const grid = document.querySelector<HTMLElement>("#dealGrid[data-deals-endpoint]");
  const template = document.querySelector<HTMLTemplateElement>("#dealCardTemplate")?.content.querySelector<HTMLElement>("[data-masonry-card]");
  const live = document.querySelector<HTMLElement>("#dealsLive");
  const fallback = document.querySelector<HTMLElement>("#dealsFallback");
  const status = document.querySelector<HTMLElement>("#dealsStatus");
  const retry = document.querySelector<HTMLButtonElement>("#dealsRetry");
  if (!grid || !template || !live || !fallback || !status || !retry) return;
  if (grid.dataset.dealsInitialized) return;
  grid.dataset.dealsInitialized = "true";
  let current: any[] = [];
  let generatedAt = "";
  let request: AbortController | null = null;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const announce = () => document.dispatchEvent(new CustomEvent("bulgaritam:deals-refreshed", { detail: { count: current.length } }));
  const fail = () => {
    current = []; generatedAt = "";
    clearTimeout(expiryTimer);
    grid.replaceChildren(); grid.dataset.dealsState = "error";
    grid.removeAttribute("data-deals-generated-at");
    live.hidden = true; fallback.hidden = false; retry.hidden = false;
    status.textContent = "Не можем да потвърдим актуалните намаления. Опитайте отново.";
    announce();
  };
  const scheduleExpiry = () => {
    clearTimeout(expiryTimer);
    if (!current.length) return;
    const next = Math.min(...current.map((deal) => Date.parse(deal.latest_checked_at) + DEAL_MAX_AGE_MS));
    expiryTimer = setTimeout(recheckFreshness, Math.max(1, Math.min(60_000, next - Date.now())));
  };
  const commit = (deals: any[], generated: string) => {
    // Prepare everything before replacing the current DOM; never partially render a response.
    const cards = deals.map((deal, index) => renderDeal(template, deal, index));
    refreshDealFacetOptions(document, deals);
    current = deals; generatedAt = generated;
    grid.replaceChildren(...cards); grid.dataset.dealsGeneratedAt = generatedAt;
    grid.dataset.dealsState = deals.length ? "ready" : "empty";
    live.hidden = !deals.length || document.hidden;
    fallback.hidden = Boolean(deals.length); retry.hidden = true;
    status.textContent = deals.length ? "Намаленията са заредени от последните надеждни проверки." : "В момента няма активно проверени намаления.";
    announce(); scheduleExpiry();
  };
  function recheckFreshness() {
    if (disposed) return;
    const fresh = current.filter((deal) => observationIsFresh(deal.latest_checked_at));
    if (fresh.length !== current.length) commit(fresh, generatedAt);
    else scheduleExpiry();
  }
  const refresh = async () => {
    if (disposed || document.hidden || request) return;
    recheckFreshness();
    clearTimeout(refreshTimer);
    request = new AbortController();
    const controller = request;
    const timeout = setTimeout(() => controller.abort(), DEAL_TIMEOUT_MS);
    grid.setAttribute("aria-busy", "true"); retry.disabled = true;
    if (!current.length) { grid.dataset.dealsState = "loading"; status.textContent = "Проверяваме актуалните намаления…"; }
    try {
      if (grid.dataset.dealsEndpoint !== CONSUMER_DEALS_ENDPOINT) throw new Error("Unexpected deals endpoint");
      const response = await fetch(CONSUMER_DEALS_ENDPOINT, {
        headers: { Accept: "application/json" }, credentials: "omit", signal: controller.signal,
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Deals unavailable");
      const payload = await response.json();
      if (disposed || request !== controller) return;
      if (controller.signal.aborted) throw new Error("Deals timeout");
      const validated = validateDealsPayload(payload);
      commit(validated.deals, validated.generated_at);
    } catch {
      if (!disposed && request === controller) fail();
    } finally {
      clearTimeout(timeout);
      if (request === controller) {
        request = null; grid.removeAttribute("aria-busy"); retry.disabled = false;
        if (!disposed && !document.hidden) refreshTimer = setTimeout(refresh, DEAL_REFRESH_MS);
      }
    }
  };
  const onVisibility = () => {
    clearTimeout(refreshTimer);
    if (document.hidden) { live.hidden = true; return; }
    recheckFreshness(); live.hidden = !current.length;
    void refresh();
  };
  const onPageShow = (event: PageTransitionEvent) => {
    if (!event.persisted && !disposed) return;
    disposed = false; onVisibility();
  };
  const onPageHide = () => {
    disposed = true; request?.abort(); request = null;
    clearTimeout(expiryTimer); clearTimeout(refreshTimer); live.hidden = true;
  };
  retry.addEventListener("click", refresh);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("pagehide", onPageHide);
  void refresh();
}

initializeConsumerDeals();
