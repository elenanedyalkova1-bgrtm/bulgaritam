export const now = Date.parse('2026-10-19T09:00:00.000Z');
export function deal(id = 1, overrides = {}) {
  return { entity_type: 'observed_product', entity_id: String(id), title: `Продукт ${id}`, brand_id: id,
    brand: `Бранд ${id}`, image_url: 'https://brand.test/image.jpg', current_price: 40, regular_price: 50,
    currency: 'EUR', discount_percent: 20, latest_checked_at: new Date(now - 3_600_000).toISOString(),
    destination_type: 'external', destination_url: `https://brand.test/product/${id}`, outbound_url: `https://brand.test/product/${id}`,
    internal_slug: null, deal_category: 'Козметика', giftable: false, materials: ['Памук'], ingredients: ['Роза'],
    search_text: `продукт ${id} бранд ${id}`, ...overrides };
}
export const internalDeal = deal(2, { entity_type: 'catalog_product', destination_type: 'internal', internal_slug: 'test-product', destination_url: '/p/test-product/' });
export const payload = (deals = [deal()], overrides = {}) => ({ version: 1, count: deals.length, deals, stale: false, generated_at: new Date(now).toISOString(), ...overrides });
