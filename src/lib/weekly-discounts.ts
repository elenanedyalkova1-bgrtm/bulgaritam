import { loadProducts, type Product } from "./products";
import { createGoogleSheetsHistory, evaluateDiscounts } from "./price-monitor/index.mjs";

const SOFIA_TIME_ZONE = "Europe/Sofia";

type WeekWindow = { week_start: string; week_end: string };
type DiscountEvaluation = {
  product_id: string;
  product_name: string;
  brand: string;
  product_url: string;
  weekly_discount_eligible: boolean;
  current_price: number | null;
  regular_price: number | null;
  currency: string | null;
  discount_amount: number | null;
  discount_percent: number | null;
  latest_checked_at: string | null;
  confidence: string | null;
  extraction_method: string | null;
  regular_price_method: string | null;
};

export type WeeklyDiscountProduct = DiscountEvaluation & { product: Product };

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SOFIA_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
});
const timeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SOFIA_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function parts(formatter: Intl.DateTimeFormat, value: Date) {
  return Object.fromEntries(formatter.formatToParts(value).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function localMidnightUtc(year: number, month: number, day: number) {
  const wallClock = Date.UTC(year, month - 1, day);
  let instant = wallClock;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const local = parts(timeFormatter, new Date(instant));
    const representedAsUtc = Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day), Number(local.hour), Number(local.minute), Number(local.second));
    const next = wallClock - (representedAsUtc - instant);
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant);
}

function shiftCalendarDate(year: number, month: number, day: number, days: number) {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

export function getSofiaWeekWindow(now = new Date()): WeekWindow {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error("A valid date is required for the Sofia week window");
  const local = parts(dateFormatter, now);
  const weekday = ({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 } as Record<string, number>)[local.weekday];
  if (weekday == null) throw new Error("Could not resolve Europe/Sofia weekday");
  const monday = shiftCalendarDate(Number(local.year), Number(local.month), Number(local.day), -weekday);
  const nextMonday = shiftCalendarDate(monday.year, monday.month, monday.day, 7);
  return {
    week_start: localMidnightUtc(monday.year, monday.month, monday.day).toISOString(),
    week_end: localMidnightUtc(nextMonday.year, nextMonday.month, nextMonday.day).toISOString(),
  };
}

export function joinWeeklyDiscountProducts(discounts: DiscountEvaluation[], products: Product[]): WeeklyDiscountProduct[] {
  const publicByRowId = new Map(products.map((product) => [String(product.row_id), product]));
  return discounts
    .filter((discount) => discount.weekly_discount_eligible === true)
    .map((discount) => ({ ...discount, product: publicByRowId.get(String(discount.product_id)) }))
    .filter((entry): entry is DiscountEvaluation & { product: Product } => Boolean(entry.product))
    .sort((a, b) => (Number(b.discount_percent) - Number(a.discount_percent))
      || a.product.brand_name.localeCompare(b.product.brand_name, "bg")
      || a.product.name_bg.localeCompare(b.product.name_bg, "bg")
      || String(a.product.row_id).localeCompare(String(b.product.row_id), "en", { numeric: true }));
}

type Dependencies = {
  readHistory?: () => Promise<unknown[]>;
  loadCatalog?: () => Promise<Product[]>;
  evaluate?: (rows: unknown[], window: WeekWindow) => DiscountEvaluation[];
};

async function readPriceHistory() {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || process.env;
  const createHistory = createGoogleSheetsHistory as unknown as (config: {
    spreadsheetId?: string; serviceAccountEmail?: string; privateKey?: string;
  }) => { getValues(range: string): Promise<{ values?: unknown[] }> };
  const history = createHistory({
    spreadsheetId: env.GOOGLE_PRICE_MONITOR_SPREADSHEET_ID,
    serviceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  });
  const response = await history.getValues("Price History!A2:Q");
  return response.values || [];
}

export async function loadWeeklyDiscountProducts(now = new Date(), dependencies: Dependencies = {}) {
  const window = getSofiaWeekWindow(now);
  const readHistory = dependencies.readHistory || readPriceHistory;
  const loadCatalog = dependencies.loadCatalog || loadProducts;
  const evaluate = dependencies.evaluate || evaluateDiscounts;
  const [rows, products] = await Promise.all([readHistory(), loadCatalog()]);
  const evaluated = evaluate(rows, window).filter((entry): entry is DiscountEvaluation => Boolean(entry));
  return { ...window, products: joinWeeklyDiscountProducts(evaluated, products) };
}

export function formatDiscountMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("bg-BG", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

export function formatDiscountPercent(value: number) {
  return `−${Math.round(value)}%`;
}
