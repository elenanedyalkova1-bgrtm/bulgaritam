import { buildCatalogPriceMutation } from "../../../src/lib/verified-offer";

export type CatalogPriceCsvRow = { product_id: string; exact_price: string; currency: string; source_url?: string };
export type CatalogPriceImportItem = { line: number; product_id: number; product_name: string; mutation: Record<string, unknown> };

const text = (value: unknown) => String(value ?? "").trim();

export function parseCsvRows(input: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((values) => values.some((value) => text(value)));
}

export function parseCatalogPriceCsv(input: string): CatalogPriceCsvRow[] {
  const rows = parseCsvRows(input);
  if (!rows.length) throw new Error("CSV is empty.");
  const headers = rows[0].map((value) => text(value).toLowerCase());
  for (const required of ["product_id", "exact_price", "currency"]) if (!headers.includes(required)) throw new Error(`CSV header ${required} is required.`);
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, text(values[index])])) as CatalogPriceCsvRow);
}

export function planCatalogPriceImport(csv: string, products: Record<string, any>[], now: Date | number = new Date()) {
  let rows: CatalogPriceCsvRow[];
  try { rows = parseCatalogPriceCsv(csv); }
  catch (error) { return { valid: false, rows: 0, planned: [] as CatalogPriceImportItem[], errors: [{ line: 1, product_id: null, error: error instanceof Error ? error.message : String(error) }] }; }
  const byId = new Map(products.map((product) => [Number(product.id), product]));
  const seen = new Set<number>(); const planned: CatalogPriceImportItem[] = []; const errors: Array<{ line: number; product_id: number | null; error: string }> = [];
  rows.forEach((row, index) => {
    const line = index + 2; const productId = Number(text(row.product_id));
    if (!Number.isInteger(productId) || productId <= 0) { errors.push({ line, product_id: null, error: "product_id must be a positive Baserow row ID." }); return; }
    if (seen.has(productId)) { errors.push({ line, product_id: productId, error: "Duplicate product_id in import." }); return; }
    seen.add(productId);
    const product = byId.get(productId);
    if (!product) { errors.push({ line, product_id: productId, error: "Product ID does not exist in the fetched Baserow catalog." }); return; }
    try {
      const mutation = buildCatalogPriceMutation(product, { exact_price: row.exact_price, currency: row.currency, source_url: row.source_url }, "confirm", now);
      planned.push({ line, product_id: productId, product_name: text(product.name_bg), mutation });
    } catch (error) { errors.push({ line, product_id: productId, error: error instanceof Error ? error.message : String(error) }); }
  });
  return { valid: errors.length === 0, rows: rows.length, planned, errors };
}
