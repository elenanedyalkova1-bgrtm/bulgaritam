import { evaluateDiscounts } from "./discount-evaluator.mjs";

const time = (value) => {
  const parsed = Date.parse(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

export function buildDiscountReport(rows, { week_start, week_end } = {}) {
  const evaluated = evaluateDiscounts(rows, { week_start, week_end });
  const start = time(week_start); const end = time(week_end);
  const inWindow = (item) => {
    const checked = time(item.latest_checked_at);
    return checked != null && checked >= start && checked < end;
  };
  const activeSales = evaluated.filter((item) => item.active_sale);
  const grouped = new Map();
  for (const item of activeSales) {
    const extraction_method = item.extraction_method || "";
    const regular_price_method = item.regular_price_method || "";
    const key = `${extraction_method}\u0000${regular_price_method}`;
    if (!grouped.has(key)) grouped.set(key, { extraction_method, regular_price_method, count: 0 });
    grouped.get(key).count += 1;
  }
  const active_sale_methods = [...grouped.values()].sort((a, b) =>
    b.count - a.count || a.extraction_method.localeCompare(b.extraction_method) || a.regular_price_method.localeCompare(b.regular_price_method));
  const eligible_products = evaluated
    .filter((item) => item.weekly_discount_eligible)
    .map((item) => ({
      product_id: item.product_id, brand: item.brand, product_name: item.product_name, product_url: item.product_url,
      regular_price: item.regular_price, current_price: item.current_price, currency: item.currency,
      discount_amount: item.discount_amount, discount_percent: item.discount_percent,
      latest_checked_at: item.latest_checked_at, confidence: item.confidence,
      extraction_method: item.extraction_method, regular_price_method: item.regular_price_method,
    }))
    .sort((a, b) => b.discount_percent - a.discount_percent
      || a.brand.localeCompare(b.brand, "bg") || a.product_name.localeCompare(b.product_name, "bg")
      || a.product_id.localeCompare(b.product_id));
  return {
    evaluation_window: { week_start, week_end, interval: "[week_start, week_end)" },
    summary: {
      total_products_evaluated: evaluated.length,
      latest_reliable_observation_in_window: evaluated.filter(inWindow).length,
      active_sale_count: activeSales.length,
      weekly_discount_eligible_count: eligible_products.length,
      verified_price_drop_count: evaluated.filter((item) => item.verified_price_drop).length,
    },
    active_sale_methods,
    eligible_products,
  };
}
