export type HomepageSettings = {
  rowId: number;
  heroUrl: string;
  heroAltBg: string;
  heroAltEn: string;
};

const API = "https://api.baserow.io/api";

export async function loadHomepageSettings(): Promise<HomepageSettings | null> {
  const token = import.meta.env.BASEROW_API_TOKEN;
  const tableId = import.meta.env.BASEROW_SITE_SETTINGS_TABLE_ID;
  if (!token || !tableId) return null;

  const response = await fetch(`${API}/database/rows/table/${tableId}/?user_field_names=true&size=20`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!response.ok) throw new Error(`Failed to fetch Site Settings: ${response.status}`);
  const data = await response.json();
  const row = (data.results || []).find((entry: any) => String(entry.key || entry.Name || "").trim() === "homepage");
  const file = Array.isArray(row?.hero_image) ? row.hero_image[0] : null;
  const heroUrl = String(file?.url || file?.thumbnails?.large?.url || "").trim();
  if (!row || !heroUrl) return null;

  return {
    rowId: Number(row.id),
    heroUrl,
    heroAltBg: String(row.hero_alt_bg || "Колаж с български модни и лайфстайл продукти").trim(),
    heroAltEn: String(row.hero_alt_en || "A collage of Bulgarian fashion and lifestyle products").trim(),
  };
}
