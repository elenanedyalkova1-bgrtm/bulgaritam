import type { Product } from "./products";

export type CuratedTagPage = {
  label: string;
  slug: string;
  productCount: number;
  products: Product[];
  intro: string[];
  sections: Array<{ title: string; paragraphs: string[] }>;
  title: string;
  description: string;
  categories: Array<{ label: string; href: string }>;
  kicker: string;
  searchIntent: string;
  themeLabel: string;
};

export const normalizeProductTag = (value: string) => String(value ?? "").trim();

export const slugifyBg = (value: string) => String(value ?? "").trim().toLowerCase();

export function getCuratedTagPages(_products: Product[]): CuratedTagPage[] {
  return [];
}

export function getCuratedTagPageBySlug(_products: Product[], _slug: string) {
  return null;
}

export function getCuratedTagsForProduct(_product: Product, _products: Product[], _limit = 4) {
  return [];
}
