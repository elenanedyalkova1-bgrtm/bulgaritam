export type GiftTarget = "her" | "him" | "child" | "baby" | "wedding";

type GiftProductLike = {
  tags?: string[] | string;
};

type GiftMeta = {
  giftable: boolean;
  gift_targets: GiftTarget[];
  gift_match_score: number;
};

const GIFT_INTENT_TERMS = ["gift", "gifts", "подарък", "подаръци", "комплект", "сет", "set", "bundle"];
const GIFT_PRIORITY_TERMS = ["комплект", "сет", "set", "bundle"];

const HER_TERMS = ["жена", "за нея", "за жена", "дамски", "beauty", "козметика", "бижута"];
const HIM_TERMS = ["мъж", "за него", "за мъж", "men"];
const CHILD_TERMS = ["дете", "деца", "детски", "детско", "kids", "kid", "children", "child"];
const CHILD_STRONG_TERMS = ["за дете", "за деца", "детски", "детско", "kids", "kid", "children", "child"];
const BABY_TERMS = ["бебе", "бебешки", "бебешко", "baby", "newborn", "новородено"];
const WEDDING_TERMS = ["сватба", "сватбен", "младоженци", "wedding", "булка", "кумове"];
const HANDMADE_GIFT_TERMS = ["ръчна изработка", "ръчно изработен", "ръчно изработена", "handmade", "hand crafted"];

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .trim();

const normalizePhrase = (value: unknown) =>
  normalize(value)
    .replace(/[\/_,;:.!?()[\]{}"'`´’“”]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const unique = <T,>(values: T[]) => Array.from(new Set(values));

const getTagList = (value: string[] | string | undefined) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizePhrase(item)).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => normalizePhrase(item))
    .filter(Boolean);
};

const tagsIncludeTerm = (tags: string[], term: string) => {
  const normalizedTerm = normalizePhrase(term);
  if (!normalizedTerm) return false;
  return tags.some((tag) => tag === normalizedTerm || tag.includes(normalizedTerm));
};

const countMatchedTerms = (tags: string[], terms: string[]) =>
  unique(
    terms.filter((term) => tagsIncludeTerm(tags, term)).map((term) => normalizePhrase(term))
  ).length;

export const getGiftMeta = (product: GiftProductLike): GiftMeta => {
  const tags = getTagList(product.tags);
  const intentMatches = countMatchedTerms(tags, GIFT_INTENT_TERMS);

  if (!intentMatches) {
    return {
      giftable: false,
      gift_targets: [],
      gift_match_score: 0,
    };
  }

  const gift_targets: GiftTarget[] = [];

  const hasHer = countMatchedTerms(tags, HER_TERMS) > 0;
  const hasHim = countMatchedTerms(tags, HIM_TERMS) > 0;
  const hasChild = countMatchedTerms(tags, CHILD_TERMS) > 0;
  const hasChildStrong = countMatchedTerms(tags, CHILD_STRONG_TERMS) > 0;
  const hasBaby = countMatchedTerms(tags, BABY_TERMS) > 0;
  const hasWedding = countMatchedTerms(tags, WEDDING_TERMS) > 0;

  if (hasHer) gift_targets.push("her");
  if (hasHim) gift_targets.push("him");
  if (hasBaby) gift_targets.push("baby");
  if (hasChild && (!hasBaby || hasChildStrong)) gift_targets.push("child");
  if (hasWedding) gift_targets.push("wedding");

  const priorityMatches = countMatchedTerms(tags, GIFT_PRIORITY_TERMS);
  const handmadeMatches = countMatchedTerms(tags, HANDMADE_GIFT_TERMS);

  return {
    giftable: true,
    gift_targets: unique(gift_targets),
    gift_match_score: intentMatches + priorityMatches * 2 + handmadeMatches,
  };
};

export const sortGiftProducts = <T extends GiftMeta & { created_at?: string; name_bg?: string }>(products: T[]) =>
  [...products].sort((a, b) => {
    if (b.gift_match_score !== a.gift_match_score) return b.gift_match_score - a.gift_match_score;

    const ad = a.created_at ? Date.parse(a.created_at) : 0;
    const bd = b.created_at ? Date.parse(b.created_at) : 0;
    if (ad && bd && ad !== bd) return bd - ad;

    return String(a.name_bg || "").localeCompare(String(b.name_bg || ""), "bg");
  });

export const GIFT_FILTERS: Array<{ key: GiftTarget; label: string; labelEn: string }> = [
  { key: "her", label: "За жена", labelEn: "For women" },
  { key: "him", label: "За мъж", labelEn: "For men" },
  { key: "child", label: "За дете", labelEn: "For child" },
  { key: "baby", label: "За бебе", labelEn: "For baby" },
  { key: "wedding", label: "За сватба", labelEn: "For wedding" },
];
