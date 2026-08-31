import type { Product } from "./products";
import { PRODUCT_TAXONOMY } from "../../admin-app/src/lib/product-taxonomy";

export type PublicBrowseSubcategory = {
  key: string;
  label: string;
  labelEn: string;
  value: string;
  productTypes: readonly string[];
};

export type PublicBrowseCategory = {
  key: string;
  emoji: string;
  label: string;
  labelEn: string;
  value: string;
  subcategories: PublicBrowseSubcategory[];
};

// Gift filters are intentionally independent from the product taxonomy.
export const PUBLIC_GIFT_OCCASIONS = [
  "Рожден ден", "Сватба", "Новородено", "Коледа", "Кръщене", "Нов дом", "Свети Валентин",
] as const;

const CATEGORY_UI: Record<string, { key: string; emoji: string; labelEn: string }> = {
  "Аксесоари": { key: "accessories", emoji: "👜", labelEn: "Accessories" },
  "Деца и бебе": { key: "kids", emoji: "👶", labelEn: "Kids & baby" },
  "Дом и интериор": { key: "home", emoji: "🏠", labelEn: "Home & interior" },
  "Домашни любимци": { key: "pets", emoji: "🐾", labelEn: "Pets" },
  "Книги, игри и творчество": { key: "books", emoji: "📚", labelEn: "Books, games & creativity" },
  "Здраве и грижа": { key: "health", emoji: "🌿", labelEn: "Health & care" },
  "Козметика": { key: "cosmetics", emoji: "💄", labelEn: "Cosmetics" },
  "Облекло": { key: "clothing", emoji: "👕", labelEn: "Clothing" },
  "Спорт и туризъм": { key: "sport", emoji: "🏕️", labelEn: "Sport & outdoors" },
  "Храна и напитки": { key: "food", emoji: "🍷", labelEn: "Food & drinks" },
};

// Keep keys already referenced by existing SEO pages stable. New structured
// browse-only nodes use their exact Baserow value as the internal key.
const SUBCATEGORY_KEYS: Record<string, string> = {
  "Бижута": "accessories_jewelry", "Чанти и портфейли": "accessories_bags",
  "Колани": "accessories_belts", "Аксесоари за коса": "accessories_headwear",
  "Бебешка грижа": "kids_care", "Бебешки текстил": "kids_textiles",
  "Детски мебели": "kids_furniture", "Играчки": "kids_toys", "Детско облекло": "kids_clothing",
  "Декорация": "home_decor", "Аромати за дома": "home_fragrance", "Домашен текстил": "home_textiles",
  "Кухня и трапезария": "home_kitchen", "Осветление": "home_lighting", "Почистване": "home_cleaning",
  "Грижа и хигиена": "pets_care", "Книги": "books_journals", "Албуми и хартиени продукти": "books_paper",
  "Настолни игри": "books_games", "Творчески комплекти": "books_creative",
  "Чай и билки": "health_tea", "Добавки и екстракти": "health_supplements",
  "Грижа за лицето": "cosmetics_face", "Грижа за косата": "cosmetics_hair",
  "Грижа за тялото": "cosmetics_body",
  "Грижа за устните": "cosmetics_lips", "Грим": "cosmetics_makeup", "Парфюми": "cosmetics_perfume",
  "Козметични комплекти": "cosmetics_sets", "Дамско облекло": "clothing_women", "Мъжко облекло": "clothing_men",
  "Обувки": "accessories_shoes", "Бельо": "clothing_lingerie",
};

const SUBCATEGORY_EN: Record<string, string> = {
  "Бижута": "Jewelry", "Чанти и портфейли": "Bags & wallets", "Булчински аксесоари": "Bridal accessories",
  "Аксесоари за коса": "Hair accessories", "Мъжки аксесоари": "Men's accessories", "Колани": "Belts",
  "Шапки": "Hats", "Шалове и кърпи": "Scarves", "Детско облекло": "Kids clothing",
  "Бебешка грижа": "Baby care", "Играчки": "Toys", "Бебешки текстил": "Baby textiles",
  "Бебешки и детски дневници": "Baby & kids journals", "Детски текстил": "Kids textiles", "Детски мебели": "Kids furniture",
  "Аромати за дома": "Home fragrance", "Почистване": "Cleaning", "Домашен текстил": "Home textiles",
  "Баня": "Bathroom", "Кухня и трапезария": "Kitchen & dining", "Декорация": "Decor", "Осветление": "Lighting",
  "Грижа и хигиена": "Care & hygiene", "Легла и текстил": "Beds & textiles", "Албуми и хартиени продукти": "Albums & paper goods",
  "Книги": "Books", "Творчески комплекти": "Creative kits", "Настолни игри": "Board games", "Дневници и планери": "Journals & planners",
  "Добавки и екстракти": "Supplements & extracts", "Чай и билки": "Tea & herbs", "Грижа за тялото": "Body care",
  "Парфюми": "Perfume", "Козметични комплекти": "Cosmetic sets", "Грижа за косата": "Hair care",
  "Грижа за лицето": "Face care", "Грим": "Makeup", "Грижа за устните": "Lip care",
  "Дамско облекло": "Women", "Мъжко облекло": "Men", "Бански": "Swimwear", "Унисекс облекло": "Unisex", "Чорапи": "Socks",
  "Обувки": "Shoes", "Бельо": "Underwear",
  "Туризъм и къмпинг": "Tourism & camping", "Фитнес и тренировки": "Fitness & training",
  "Мъжки бижута": "Men's jewelry", "Офис пространство": "Office", "Алкохолни напитки": "Alcoholic drinks",
};

export const PUBLIC_BROWSE_CATEGORIES: PublicBrowseCategory[] = Object.entries(PRODUCT_TAXONOMY).map(([categoryValue, tree]) => {
  const ui = CATEGORY_UI[categoryValue];
  return {
    key: ui.key, emoji: ui.emoji, label: categoryValue, labelEn: ui.labelEn, value: categoryValue,
    subcategories: Object.entries(tree).map(([value, productTypes]) => ({
      key: categoryValue === "Книги, игри и творчество" && value === "Декорация"
          ? "books_decor"
          : categoryValue === "Аксесоари" && value === "Мъжки бижута"
              ? "accessories_mens_jewelry"
              : SUBCATEGORY_KEYS[value] || value,
      label: value,
      labelEn: SUBCATEGORY_EN[value] || value,
      value,
      productTypes,
    })),
  };
});

const clean = (value: unknown) => String(value ?? "").trim();

export function getPublicBrowseForProduct(product: Product) {
  const category = PUBLIC_BROWSE_CATEGORIES.find((entry) => entry.value === clean(product.category));
  const subcategory = category?.subcategories.find((entry) => entry.value === clean(product.subcategory));
  return { categoryKey: category?.key || "", subcategoryKey: subcategory?.key || "" };
}

export function getAvailablePublicBrowse(products: Product[], includeEmpty = false) {
  const contexts = products.map((product) => ({ product, ...getPublicBrowseForProduct(product) }));
  return PUBLIC_BROWSE_CATEGORIES.map((category) => ({
    key: category.key, emoji: category.emoji, label: category.label, labelEn: category.labelEn,
    count: contexts.filter((item) => item.categoryKey === category.key).length,
    subcategories: category.subcategories.map((subcategory) => ({
      key: subcategory.key, label: subcategory.label, labelEn: subcategory.labelEn,
      productTypes: subcategory.productTypes,
      count: contexts.filter((item) => item.categoryKey === category.key && item.subcategoryKey === subcategory.key).length,
    })).filter((subcategory) => includeEmpty || subcategory.count > 0),
  })).filter((category) => includeEmpty || category.count > 0);
}
