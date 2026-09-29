export function buildDealCard(evaluation, entity = {}) {
  if (!evaluation?.weekly_discount_eligible) return null;
  const internal = evaluation.entity_type === "catalog_product" || entity.bulgaritam_product_id != null;
  const destinationUrl = internal ? entity.internal_url : entity.canonical_url || entity.source_url || evaluation.product_url;
  if (!destinationUrl || !entity.title || !entity.image_url) return null;
  return {
    entity_type: evaluation.entity_type, entity_id: evaluation.entity_id, image: entity.image_url, product_title: entity.title,
    brand: evaluation.brand, current_price: evaluation.current_price, regular_price: evaluation.regular_price,
    discount_percent: evaluation.discount_percent, availability: entity.availability || null,
    destination_type: internal ? "internal" : "external", destination_url: destinationUrl,
    destination_label: internal ? "Виж продукта" : "Към магазина", last_verified_at: evaluation.last_verified_at,
  };
}
