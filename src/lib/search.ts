const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sht",
  ъ: "a",
  ь: "y",
  ю: "yu",
  я: "ya",
};

const BG_SUFFIXES = [
  "овете",
  "евете",
  "анията",
  "ението",
  "енията",
  "ищата",
  "овци",
  "евци",
  "ите",
  "ове",
  "еве",
  "ата",
  "ята",
  "ият",
  "ият",
  "ния",
  "ният",
  "ната",
  "ното",
  "ните",
  "ски",
  "ска",
  "ско",
  "чен",
  "чна",
  "чно",
  "чни",
  "ен",
  "на",
  "но",
  "ни",
  "ът",
  "та",
  "то",
  "те",
  "ия",
  "ие",
  "а",
  "я",
  "и",
  "е",
  "о",
  "у",
];

const SPECIAL_EQUIVALENTS: Array<[RegExp, string[]]> = [
  [/^памуч/, ["памук"]],
  [/^pamuch/, ["pamuk"]],
  [/^ленен/, ["лен"]],
  [/^lenen/, ["len"]],
  [/^вълнен/, ["вълна"]],
  [/^valnen|^vulnen/, ["valna"]],
];

const SEMANTIC_GROUPS = [
  ["gift", "gifts", "подарък", "подаръци"],
  ["baby", "babies", "бебе", "бебешки", "бебешко"],
  ["kid", "kids", "children", "дете", "деца", "детски", "детско"],
  ["clothing", "apparel", "outfit", "outfits", "облекло", "дреха", "дрехи"],
  ["cotton", "памук", "памучен", "памучна", "памучно"],
  ["linen", "лен", "ленен", "ленена"],
  ["wool", "вълна", "вълнен", "вълнена"],
  ["night", "нощен", "нощна", "нощно"],
  ["day", "дневен", "дневна", "дневно"],
  ["cream", "крем"],
  ["serum", "серум"],
  ["shampoo", "шампоан"],
  ["mask", "маска"],
  ["soap", "sapun", "сапун"],
  ["body", "тяло"],
  ["face", "лице"],
  ["hair", "коса"],
  ["lip", "lips", "устни"],
  ["candle", "candles", "свещ", "свещи"],
  ["bag", "bags", "чанта", "чанти"],
  ["earring", "earrings", "обеци"],
  ["jewelry", "бижута", "бижу"],
  ["dress", "рокля", "рокли"],
  ["shirt", "shirts", "риза", "ризи"],
  ["tshirt", "t-shirt", "tshirt", "tee", "тениска", "тениски"],
  ["home", "дом"],
  ["interior", "интериор"],
  ["decor", "dekor", "декор"],
  ["cleaning", "почистване"],
  ["book", "books", "книга", "книги"],
  ["toy", "toys", "играчка", "играчки"],
  ["tea", "чай"],
  ["herbs", "herb", "билки", "билка"],
  ["supplement", "supplements", "добавка", "добавки"],
  ["extract", "extracts", "екстракт", "екстракти", "тинктура"],
  ["sport", "sports", "спорт"],
  ["cosmetics", "козметика"],
  ["natural", "натурален", "натурална", "натурално"],
  ["organic", "органичен", "органична", "органично", "bio", "био"],
  ["eco", "еко", "sustainable", "устойчив", "reusable", "многократен", "biodegradable", "биоразградим"],
];

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/['"`´’‘]/g, "")
    .replace(/[.,/#!$%^*;:{}=\-_~()@\[\]+<>?\\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const transliterateBulgarianToLatin = (value: string) =>
  Array.from(value)
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join("");

const tokenize = (value: string) =>
  normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const expandToken = (token: string) => {
  const forms = new Set<string>();
  const normalized = normalizeText(token);
  if (!normalized) return forms;

  forms.add(normalized);

  if (normalized.length >= 4) forms.add(normalized.slice(0, 4));
  if (normalized.length >= 6) forms.add(normalized.slice(0, 5));

  for (const suffix of BG_SUFFIXES) {
    if (normalized.length - suffix.length < 3) continue;
    if (normalized.endsWith(suffix)) {
      forms.add(normalized.slice(0, -suffix.length));
    }
  }

  for (const [pattern, equivalents] of SPECIAL_EQUIVALENTS) {
    if (pattern.test(normalized)) {
      equivalents.forEach((equivalent) => forms.add(equivalent));
    }
  }

  for (const group of SEMANTIC_GROUPS) {
    if (group.includes(normalized)) {
      group.forEach((equivalent) => forms.add(equivalent));
    }
  }

  return forms;
};

const collectTokenForms = (value: string) => {
  const forms = new Set<string>();
  tokenize(value).forEach((token) => {
    expandToken(token).forEach((form) => forms.add(form));
  });
  return forms;
};

export const buildSearchDocument = (...values: unknown[]) => {
  const forms = new Set<string>();
  const normalized = normalizeText(values.flat().join(" "));
  const transliterated = transliterateBulgarianToLatin(normalized);

  collectTokenForms(normalized).forEach((form) => forms.add(form));
  collectTokenForms(transliterated).forEach((form) => forms.add(form));

  return Array.from(forms).join(" ");
};

export const buildSearchGroups = (value: unknown) => {
  const normalized = normalizeText(value);
  const transliterated = transliterateBulgarianToLatin(normalized);
  const rawTokens = unique([...tokenize(normalized), ...tokenize(transliterated)]);

  return rawTokens.map((token) => Array.from(expandToken(token)));
};

export const matchesSearchValueAgainstDocument = (document: string, value: unknown) => {
  const groups = buildSearchGroups(value);
  if (!groups.length) return true;
  const docTokens = new Set(String(document || "").split(/\s+/).filter(Boolean));

  return groups.every((group) =>
    group.some((token) => {
      if (!token) return false;
      if (token.length < 3) return false;
      if (docTokens.has(token)) return true;
      for (const docToken of docTokens) {
        if (docToken.startsWith(token)) return true;
      }
      return false;
    })
  );
};

const unique = <T,>(values: T[]) => Array.from(new Set(values));
