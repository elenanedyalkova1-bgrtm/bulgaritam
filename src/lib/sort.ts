export type SortKey = "new" | "price_asc";

/**
 * Sorts products without mutating the original array.
 * - "new": newest first (created_at preferred, fallback to row_index)
 * - "price_asc": lowest price_min_eur first (fallback Infinity)
 */
export function sortProducts<T extends {
  created_at?: string;            // add this column later if possible
  row_index?: number;             // fallback (sheet order)
  price_min_eur?: number | null;
}>(items: T[], sort: SortKey): T[] {
  const arr = [...items];

  if (sort === "price_asc") {
    arr.sort((a, b) => {
      const ap = a.price_min_eur ?? Number.POSITIVE_INFINITY;
      const bp = b.price_min_eur ?? Number.POSITIVE_INFINITY;
      if (ap !== bp) return ap - bp;
      return newestScore(b) - newestScore(a);
    });
    return arr;
  }

  // default: newest
  arr.sort((a, b) => newestScore(b) - newestScore(a));
  return arr;
}

function newestScore(x: { created_at?: string; row_index?: number }) {
  if (x.created_at) return Date.parse(x.created_at) || 0;
  if (typeof x.row_index === "number") return x.row_index;
  return 0;
}
