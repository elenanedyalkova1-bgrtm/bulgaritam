export type PublicFilterContext = "gift" | "clothing" | "jewelry" | "shoes" | "cosmetics_face" | "cosmetics_hair" | "cosmetics" | "default";

const FILTER_ORDER: Record<PublicFilterContext, readonly string[]> = {
  gift: ["price", "gift_occasion", "attributes", "recipient", "role_interest", "recipient_age", "recipient_gender", "wedding_anniversary_type", "color", "material", "type"],
  clothing: ["price", "color", "material", "clothing_style", "type", "sleeve", "season"],
  jewelry: ["price", "type", "material", "color", "gemstone", "jewelry_detail"],
  shoes: ["price", "type", "color", "material", "clothing_style", "season"],
  cosmetics_face: ["price", "type", "skin_type", "skin_need", "ingredient", "attributes"],
  cosmetics_hair: ["price", "type", "hair_need", "ingredient", "attributes"],
  cosmetics: ["price", "type", "ingredient", "attributes"],
  default: ["price", "type", "attributes", "color", "material"],
};

export function orderPublicFilters<T extends { group: string }>(filters: readonly T[], context: PublicFilterContext): T[] {
  const order = FILTER_ORDER[context];
  const rank = new Map(order.map((key, index) => [key, index]));
  return filters
    .map((filter, index) => ({ filter, index }))
    .sort((a, b) => (rank.get(a.filter.group) ?? order.length) - (rank.get(b.filter.group) ?? order.length) || a.index - b.index)
    .map(({ filter }) => filter);
}
