import type { Product } from "./products";
import { getTaxonomyForProduct } from "./taxonomy";

export type PublicBrowseSubcategory = {
  key: string;
  label: string;
  labelEn: string;
  values: string[];
};

export type PublicBrowseCategory = {
  key: string;
  label: string;
  labelEn: string;
  legacyCategories: string[];
  subcategories: PublicBrowseSubcategory[];
};

// Mirrors the controlled Baserow `gift_occasion` options. Public filtering uses
// structured values only; the labels are never inferred from product copy.
export const PUBLIC_GIFT_OCCASIONS = [
  "Рожден ден",
  "Сватба",
  "Новородено",
  "Коледа",
  "Кръщене",
  "Нов дом",
  "Свети Валентин",
] as const;

export const PUBLIC_BROWSE_CATEGORIES: PublicBrowseCategory[] = [
  {
    key: "accessories", label: "Аксесоари", labelEn: "Accessories", legacyCategories: ["Аксесоари"],
    subcategories: [
      { key: "accessories_jewelry", label: "Бижута", labelEn: "Jewelry", values: ["Бижута"] },
      { key: "accessories_bags", label: "Чанти и портфейли", labelEn: "Bags & wallets", values: ["Чанти и портфейли"] },
      { key: "accessories_belts", label: "Колани и харнеси", labelEn: "Belts & harnesses", values: ["Колани и харнеси"] },
      { key: "accessories_headwear", label: "Шапки и аксесоари за коса", labelEn: "Hats & hair accessories", values: ["Шапки и аксесоари за коса"] },
      { key: "accessories_other", label: "Други аксесоари", labelEn: "Other accessories", values: ["Аксесоари за четене", "Ежедневни аксесоари"] },
    ],
  },
  {
    key: "kids", label: "Деца и бебе", labelEn: "Kids & baby", legacyCategories: ["Деца", "Деца и бебе"],
    subcategories: [
      { key: "kids_care", label: "Бебешка грижа", labelEn: "Baby care", values: ["Бебешка грижа"] },
      { key: "kids_textiles", label: "Бебешки текстил и комплекти", labelEn: "Baby textiles & sets", values: ["Бебешки текстил", "Бебешки комплекти"] },
      { key: "kids_furniture", label: "Детски мебели и аксесоари", labelEn: "Kids furniture & accessories", values: ["Детски мебели", "Бебешки аксесоари"] },
      { key: "kids_toys", label: "Играчки", labelEn: "Toys", values: ["Играчки"] },
      { key: "kids_books", label: "Детски книги и дневници", labelEn: "Kids books & journals", values: ["Книги и дневници"] },
    ],
  },
  {
    key: "home", label: "Дом и интериор", labelEn: "Home & interior", legacyCategories: ["Дом и интериор"],
    subcategories: [
      { key: "home_decor", label: "Декорация и изкуство", labelEn: "Decor & art", values: ["Декорация"] },
      { key: "home_fragrance", label: "Аромати за дома", labelEn: "Home fragrance", values: ["Аромати за дома"] },
      { key: "home_textiles", label: "Домашен текстил", labelEn: "Home textiles", values: ["Домашен текстил"] },
      { key: "home_kitchen", label: "Кухня и трапезария", labelEn: "Kitchen & dining", values: ["Кухня и трапезария"] },
      { key: "home_lighting", label: "Осветление", labelEn: "Lighting", values: ["Осветление"] },
      { key: "home_cleaning", label: "Почистване", labelEn: "Cleaning", values: ["Почистване"] },
    ],
  },
  {
    key: "pets", label: "Домашни любимци", labelEn: "Pets", legacyCategories: ["Домашни любимци"],
    subcategories: [{ key: "pets_care", label: "Грижа и хигиена", labelEn: "Care & hygiene", values: ["Грижа и хигиена"] }],
  },
  {
    key: "books", label: "Книги, игри и творчество", labelEn: "Books, games & creativity", legacyCategories: ["Забавление", "Книги, игри и творчество"],
    subcategories: [
      { key: "books_journals", label: "Книги и дневници", labelEn: "Books & journals", values: ["Книги", "Книги и дневници"] },
      { key: "books_paper", label: "Планери и хартиени продукти", labelEn: "Planners & paper goods", values: ["Книги и планери", "Албуми и хартиени продукти"] },
      { key: "books_games", label: "Настолни и образователни игри", labelEn: "Board & educational games", values: ["Настолни игри"] },
      { key: "books_creative", label: "Творчески комплекти", labelEn: "Creative kits", values: [] },
    ],
  },
  {
    key: "health", label: "Здраве и грижа", labelEn: "Health & care", legacyCategories: ["Здраве и грижа"],
    subcategories: [
      { key: "health_tea", label: "Чай и билки", labelEn: "Tea & herbs", values: ["Чай и билки"] },
      { key: "health_supplements", label: "Добавки и екстракти", labelEn: "Supplements & extracts", values: ["Добавки и екстракти"] },
      { key: "health_local", label: "Локална грижа", labelEn: "Local care", values: ["Локална грижа"] },
    ],
  },
  {
    key: "cosmetics", label: "Козметика", labelEn: "Cosmetics", legacyCategories: ["Козметика"],
    subcategories: [
      { key: "cosmetics_face", label: "Грижа за лицето", labelEn: "Face care", values: ["Грижа за лицето"] },
      { key: "cosmetics_body", label: "Грижа за тялото", labelEn: "Body care", values: ["Грижа за тялото"] },
      { key: "cosmetics_hair", label: "Грижа за косата", labelEn: "Hair care", values: ["Грижа за косата"] },
      { key: "cosmetics_lips", label: "Грижа за устните", labelEn: "Lip care", values: ["Грижа за устните"] },
      { key: "cosmetics_makeup", label: "Грим", labelEn: "Makeup", values: ["Грим"] },
      { key: "cosmetics_perfume", label: "Парфюми", labelEn: "Perfume", values: ["Парфюми"] },
      { key: "cosmetics_sets", label: "Козметични комплекти", labelEn: "Cosmetic sets", values: ["Козметични комплекти"] },
    ],
  },
  {
    key: "clothing", label: "Облекло", labelEn: "Clothing", legacyCategories: ["Облекло"],
    subcategories: [
      { key: "clothing_women", label: "Дамско облекло", labelEn: "Women", values: ["Дамско облекло"] },
      { key: "clothing_men", label: "Мъжко облекло", labelEn: "Men", values: ["Мъжко облекло"] },
      { key: "clothing_kids", label: "Детско облекло", labelEn: "Kids clothing", values: ["Детско облекло"] },
    ],
  },
];

const normalize = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("bg");
const subcategoryEntries = PUBLIC_BROWSE_CATEGORIES.flatMap((category) =>
  category.subcategories.flatMap((subcategory) =>
    subcategory.values.map((value) => ({ category, subcategory, value: normalize(value) }))
  )
);

const legacySubcategoryMap: Record<string, [string, string]> = {
  clothing_women: ["clothing", "clothing_women"], clothing_men: ["clothing", "clothing_men"], kids_clothing: ["clothing", "clothing_kids"],
  home_decor: ["home", "home_decor"], home_textiles: ["home", "home_textiles"], home_kitchen: ["home", "home_kitchen"], home_cleaning: ["home", "home_cleaning"],
  kids_toys: ["kids", "kids_toys"], kids_books: ["kids", "kids_books"], kids_cosmetics: ["kids", "kids_care"], kids_furniture_textiles: ["kids", "kids_furniture"],
  health_tea_herbs: ["health", "health_tea"], health_supplements: ["health", "health_supplements"],
  cosmetics_face: ["cosmetics", "cosmetics_face"], cosmetics_body: ["cosmetics", "cosmetics_body"], cosmetics_hair: ["cosmetics", "cosmetics_hair"], cosmetics_makeup: ["cosmetics", "cosmetics_makeup"],
  accessories_jewelry: ["accessories", "accessories_jewelry"], accessories_bags: ["accessories", "accessories_bags"], accessories_belts: ["accessories", "accessories_belts"], accessories_headwear: ["accessories", "accessories_headwear"],
  fun_books: ["books", "books_journals"], fun_games: ["books", "books_games"], fun_hobby: ["books", "books_creative"], pets_care: ["pets", "pets_care"],
};

export function getPublicBrowseForProduct(product: Product) {
  const structured = subcategoryEntries.find((entry) => entry.value === normalize(product.subcategory));
  if (structured) return { categoryKey: structured.category.key, subcategoryKey: structured.subcategory.key };

  if (!product.subcategory) {
    const legacy = getTaxonomyForProduct(product);
    const mapped = legacy.subcategoryKeys.map((key) => legacySubcategoryMap[key]).find(Boolean);
    if (mapped) return { categoryKey: mapped[0], subcategoryKey: mapped[1] };
  }

  const category = PUBLIC_BROWSE_CATEGORIES.find((entry) => entry.legacyCategories.some((value) => normalize(value) === normalize(product.category)));
  return { categoryKey: category?.key || "", subcategoryKey: "" };
}

export function getAvailablePublicBrowse(products: Product[]) {
  const contexts = products.map((product) => ({ product, ...getPublicBrowseForProduct(product) }));
  return PUBLIC_BROWSE_CATEGORIES.map((category) => ({
    key: category.key,
    label: category.label,
    labelEn: category.labelEn,
    count: contexts.filter((item) => item.categoryKey === category.key).length,
    subcategories: category.subcategories.map((subcategory) => ({
      key: subcategory.key,
      label: subcategory.label,
      labelEn: subcategory.labelEn,
      count: contexts.filter((item) => item.subcategoryKey === subcategory.key).length,
    })).filter((subcategory) => subcategory.count > 0),
  })).filter((category) => category.count > 0);
}
