import { deriveDealFacets } from "../lib/deal-facets.mjs";

const grid = document.querySelector<HTMLElement>("#dealGrid[data-deals-endpoint]");

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
      const caption = document.createElement("span"); caption.textContent = label; wrapper.append(input, caption); return wrapper;
    }));
    group.hidden = values.length === 0;
  }
}

function renderDeal(template: HTMLElement, deal: any, index: number) {
  const card = template.cloneNode(true) as HTMLElement; const external = deal.destination_type === "external";
  Object.assign(card.dataset, { entityType: deal.entity_type, entityId: deal.entity_id, destinationType: deal.destination_type, productId: deal.entity_id,
    productName: deal.title, brandId: String(deal.brand_id || ""), brandName: deal.brand, productUrl: deal.outbound_url, productType: deal.product_type || "", dealCategory: deal.deal_category || "", giftable: deal.giftable ? "1" : "0",
    materials: (deal.materials || []).join("|"), ingredients: (deal.ingredients || []).join("|"), search: deal.search_text || `${deal.title} ${deal.brand}`.toLocaleLowerCase("bg"),
    discountCurrent: String(deal.current_price), currentPrice: String(deal.current_price), checkedAt: deal.latest_checked_at,
    discountPercent: String(deal.discount_percent), discountFacets: JSON.stringify([...(deal.materials || []), ...(deal.ingredients || [])]), discountRowId: deal.entity_id, position: String(index + 1) });
  card.hidden = false; card.style.removeProperty("display");
  card.querySelectorAll("[data-deal-link='card']").forEach((node) => setLink(node, deal.destination_url, external));
  setLink(card.querySelector("[data-deal-link='outbound']"), deal.outbound_url, true);
  const image = card.querySelector<HTMLImageElement>(".thumb-img"); if (image) { image.src = deal.image_url; image.alt = deal.title; image.loading = index < 4 ? "eager" : "lazy"; }
  const title = card.querySelector(".card-titlelink"); if (title) title.textContent = deal.title;
  const brand = card.querySelector(".card-sub"); if (brand) brand.textContent = deal.brand;
  const regular = card.querySelector(".discount-price__regular"); if (regular) regular.textContent = money(deal.regular_price, deal.currency);
  const current = card.querySelector(".discount-price__current"); if (current) current.textContent = money(deal.current_price, deal.currency);
  const badge = card.querySelector(".discount-price__badge"); if (badge) badge.textContent = `−${Math.round(deal.discount_percent)}%`;
  const price = card.querySelector(".discount-price");
  if (price) price.setAttribute("aria-label", `Редовна цена ${money(deal.regular_price, deal.currency)}; текуща цена ${money(deal.current_price, deal.currency)}; намаление −${Math.round(deal.discount_percent)}%`);
  const fresh = card.querySelector(".deal-freshness"); if (fresh) fresh.textContent = freshness(deal.latest_checked_at);
  const value=card.querySelector<HTMLElement>("[data-deal-category-value]"); if(value)value.dataset.dealCategoryValue=deal.deal_category||"";
  const badgeContainer=card.querySelector<HTMLElement>(".card-badges");
  card.querySelector("[data-deal-category-badge]")?.remove(); card.querySelector("[data-deal-gift-badge]")?.remove();
  if(badgeContainer&&deal.deal_category){const badge=document.createElement("span");badge.className="cat";badge.dataset.dealCategoryBadge="";badge.textContent=deal.deal_category;badgeContainer.prepend(badge);}
  if(badgeContainer&&deal.giftable===true){const gift=document.createElement("span");gift.className="cat cat--gift";gift.dataset.dealGiftBadge="";gift.textContent="Подарък";badgeContainer.append(gift);}
  if(badgeContainer)badgeContainer.hidden=!badgeContainer.children.length;
  return card;
}

if (grid?.dataset.dealsEndpoint) {
  const template = grid.querySelector<HTMLElement>("[data-masonry-card]");
  if (template) fetch(grid.dataset.dealsEndpoint, { headers: { Accept: "application/json" }, credentials: "omit" })
    .then((response) => { if (!response.ok) throw new Error(`Deals endpoint ${response.status}`); return response.json(); })
    .then((payload) => {
      if (payload?.version !== 1 || !Array.isArray(payload.deals)) throw new Error("Invalid deals payload");
      refreshDealFacetOptions(document, payload.deals);
      const cards = payload.deals.map((deal: any, index: number) => renderDeal(template, deal, index));
      grid.replaceChildren(...cards); grid.dataset.dealsGeneratedAt = String(payload.generated_at || ""); grid.dataset.dealsStale = payload.stale ? "true" : "false";
      document.dispatchEvent(new CustomEvent("bulgaritam:deals-refreshed", { detail: { count: cards.length, stale: Boolean(payload.stale) } }));
    }).catch(() => { grid.dataset.dealsFallback = "static-snapshot"; });
}
