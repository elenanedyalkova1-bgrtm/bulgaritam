import {
  relationProof,
  relatedItem,
  excludedItemTerms,
  requestedAgeFromFolded,
  ageEvidence,
  occasionEvidence,
  discoveryRelations,
  type RequestedAge,
} from "./search-relations";
import { occasionAliases } from "./search-relation-concepts";
import { supportedSourceConcept } from "./search-evidence";
/** Homepage-only strict retrieval. Stored taxonomy and shared SEO/brand search are unchanged. */
export type SearchCard = { dataset: Record<string, string | undefined> };
export type Evidence = "supported" | "contradicted" | "unknown";
const CYR = "абвгдежзийклмнопрстуфхцчшщъьюя";
const LAT = [
  "a",
  "b",
  "v",
  "g",
  "d",
  "e",
  "zh",
  "z",
  "i",
  "y",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "r",
  "s",
  "t",
  "u",
  "f",
  "h",
  "ts",
  "ch",
  "sh",
  "sht",
  "a",
  "y",
  "yu",
  "ya",
];
export const normalizeHomepageQuery = (v: unknown) =>
  String(v ?? "")
    .toLocaleLowerCase("bg")
    .replace(/(\d)[.,](?=\d)/g, "$1decimalpoint")
    .replace(/[^\p{L}\p{N}€%]+/gu, " ")
    .replace(/decimalpoint/g, ".")
    .replace(/\s+/g, " ")
    .trim();
export const fold = (v: unknown) =>
  Array.from(normalizeHomepageQuery(v), (c) => LAT[CYR.indexOf(c)] ?? c).join(
    "",
  );
const split = (v: unknown) =>
  String(v ?? "")
    .split("|")
    .map((v) => v.trim())
    .filter(Boolean);
const words = (v: unknown) => fold(v).split(" ").filter(Boolean);
const contains = (text: string, phrase: string) =>
  ` ${text} `.includes(` ${fold(phrase)} `);
const aliases = (list: string[]) => new Set(list.map(fold));
type Identity = {
  key: string;
  aliases: string[];
  types: string[];
  categories: string[];
};
// Lexical aliases resolve to existing Master v3 values, not new stored taxonomy.
const IDENTITIES: Identity[] = [
  {
    key: "earrings",
    aliases: ["обеци", "обеците", "обици", "обиците", "earring", "earrings"],
    types: ["Обеци"],
    categories: ["accessories"],
  },
  {
    key: "candle",
    aliases: ["свещ", "свещи", "свещта", "свещите", "candle", "candles"],
    types: ["Ароматни свещи"],
    categories: ["home"],
  },
  {
    key: "dress",
    aliases: [
      "рокля",
      "рокли",
      "роклята",
      "роклите",
      "рокличка",
      "роклички",
      "dress",
      "dresses",
    ],
    types: ["Рокли"],
    categories: ["clothing", "kids"],
  },
  {
    key: "bag",
    aliases: ["чанта", "чанти", "чантата", "чантите", "bag", "bags"],
    types: ["Чанти"],
    categories: ["accessories"],
  },
  {
    key: "table",
    aliases: ["маса", "маси", "масата", "масите", "table", "tables"],
    types: [],
    categories: ["home", "books"],
  },
  {
    key: "serum",
    aliases: ["серум", "серуми", "серумът", "serum", "serums"],
    types: ["Серуми за лице", "Серуми за коса", "Околоочни серуми"],
    categories: ["cosmetics"],
  },
  {
    key: "soap",
    aliases: ["сапун", "сапуни", "сапунът", "soap", "sapun"],
    types: ["Сапуни и душ гелове"],
    categories: ["cosmetics", "kids"],
  },
  {
    key: "cream",
    aliases: ["крем", "кремове", "кремът", "cream", "creams"],
    types: ["Кремове за лице", "Кремове за ръце", "Кремове и балсами за бебе"],
    categories: ["cosmetics", "kids"],
  },
  {
    key: "shirt",
    aliases: ["риза", "ризи", "ризата", "ризите", "shirt", "shirts"],
    types: ["Ризи", "Блузи и ризи"],
    categories: ["clothing", "kids"],
  },
  {
    key: "tshirt",
    aliases: ["тениска", "тениски", "тениската", "tshirt", "t shirt", "tee"],
    types: ["Тениски и потници"],
    categories: ["clothing", "kids"],
  },
  {
    key: "shampoo",
    aliases: ["шампоан", "шампоани", "шампоанът", "shampoo"],
    types: ["Шампоани"],
    categories: ["cosmetics"],
  },
  {
    key: "pajama",
    aliases: ["пижама", "пижами", "пижамата", "пижамите", "pajama", "pajamas"],
    types: ["Пижами и домашни комплекти"],
    categories: ["clothing", "kids"],
  },
  {
    key: "necklace",
    aliases: ["колие", "колиета", "колието", "necklace"],
    types: ["Колиета"],
    categories: ["accessories"],
  },
  {
    key: "ring",
    aliases: ["пръстен", "пръстени", "пръстенът", "ring"],
    types: ["Пръстени"],
    categories: ["accessories"],
  },
  {
    key: "toy",
    aliases: ["играчка", "играчки", "toy", "toys"],
    types: [
      "Образователни игри",
      "Плюшени играчки",
      "Ролеви и въображаеми игри",
    ],
    categories: ["kids", "pets"],
  },
  {
    key: "book",
    aliases: ["книга", "книги", "книгата", "book", "books"],
    types: ["Български автори", "Детски книги"],
    categories: ["books", "kids"],
  },
  {
    key: "vase",
    aliases: ["ваза", "вази", "vase"],
    types: [],
    categories: ["home"],
  },
];
const MATERIALS: [string, string[]][] = [
  [
    "Сребро",
    [
      "сребро",
      "сребърен",
      "сребърна",
      "сребърно",
      "сребърни",
      "сребърните",
      "silver",
    ],
  ],
  ["Злато", ["злато", "златен", "златна", "златно", "златни", "gold"]],
  ["Лен", ["лен", "ленен", "ленена", "ленено", "ленени", "linen"]],
  ["Памук", ["памук", "памучен", "памучна", "памучно", "памучни", "cotton"]],
  ["Естествена кожа", ["кожен", "кожена", "кожено", "кожени", "leather"]],
  [
    "Дърво",
    ["дърво", "дървен", "дървена", "дървено", "дървени", "wood", "wooden"],
  ],
  ["Вълна", ["вълна", "вълнен", "вълнена", "вълнено", "вълнени", "wool"]],
];
// Query-only inflections: never expand document evidence or existing ranking aliases.
// Finite reviewed paradigms, not suffix stripping or global transliteration changes.
const MATERIAL_QUERY_ALIASES: [string, string[]][] = [
  ["Лен", ["ленения", "лененият", "ленената", "лененото", "ленените"]],
  ["Памук", ["памучния", "памучният", "памучната", "памучното", "памучните"]],
  ["Дърво", ["дървения", "дървеният", "дървената", "дървеното", "дървените"]],
  ["Вълна", ["вълнения", "вълненият", "вълнената", "вълненото", "вълнените"]],
  ["Сребро", ["srebyrni"]],
  // Existing керамика/керамична lexical discovery stays unchanged.
  [
    "Керамика",
    [
      "керамичен",
      "керамично",
      "керамични",
      "керамичния",
      "керамичният",
      "керамичната",
      "керамичното",
      "керамичните",
      "ceramic",
    ],
  ],
];
const IDENTITY_QUERY_ALIASES: Record<string, string[]> = {
  earrings: ["обеца", "обецата", "обица", "обицата", "obeci"],
  tshirt: ["тениските"],
};
const COLORS: [string, string[]][] = [
  ["Черен", ["черен", "черна", "черно", "черни", "black"]],
  ["Червен", ["червен", "червена", "червено", "червени", "red"]],
  ["Бял", ["бял", "бяла", "бяло", "бели", "white"]],
  ["Зелен", ["зелен", "зелена", "зелено", "зелени", "green"]],
  ["Син", ["син", "синя", "синьо", "сини", "blue"]],
  ["Розов", ["розов", "розова", "розово", "розови", "pink"]],
  ["Бежов", ["бежов", "бежова", "бежово", "бежови", "beige"]],
  ["Жълт", ["жълт", "жълта", "жълто", "жълти", "yellow"]],
  ["Кафяв", ["кафяв", "кафява", "кафяво", "кафяви", "brown"]],
  ["Светлосин", ["светлосин", "светлосиня", "светлосини"]],
  ["Тъмносин", ["тъмносин", "тъмносиня", "тъмносини"]],
  ["Златист", ["златист", "златиста", "златисти"]],
  ["Сребрист", ["сребрист", "сребриста", "сребристи"]],
];
const ATTRS: [string, string[]][] = [
  [
    "Натурален",
    ["натурален", "натурална", "натурално", "натурални", "natural"],
  ],
  ["Ръчна изработка", ["handmade"]],
  ["Веган", ["веган", "vegan"]],
  ["Еко", ["еко", "eco"]],
  ["Био сертифициран", ["био сертифициран"]],
];
const AUDIENCES: [string, string, string[]][] = [
  [
    "woman",
    "За жена",
    ["жена", "жени", "дамска", "дамски", "дамско", "женски", "woman", "women"],
  ],
  ["man", "За мъж", ["мъж", "мъже", "мъжка", "мъжки", "мъжко", "man", "men"]],
  [
    "child",
    "За дете",
    ["дете", "деца", "детски", "детска", "children", "kids", "kid"],
  ],
  [
    "baby",
    "За бебе",
    ["бебе", "бебета", "бебешки", "бебешка", "baby", "babies"],
  ],
];
const STOP = aliases(["за", "от", "с", "на", "и", "ми", "до", "под", "нещо"]);
export type ShoppingQuery = {
  originalQuery: string;
  normalizedQuery: string;
  mode: "discovery" | "invalid" | "search";
  consumedSpans: {
    start: number;
    end: number;
    text: string;
    kind: string;
    value: string;
  }[];
  unresolvedTerms: string[];
  residualQuery: string;
  identities: Identity[];
  materials: string[];
  colors: string[];
  attributes: string[];
  recipients: string[];
  occasions: string[];
  labels: string[];
  audienceKeys: string[];
  subcategoryKeys: string[];
  giftable?: boolean;
  audienceKey?: string;
  categoryKey?: string;
  subcategoryKey?: string;
  productType?: string;
  maxPriceEur?: number;
  brandQuery?: string;
  skincare?: boolean;
  mother?: boolean;
  motherAge?: string;
  requestedAge?: RequestedAge;
  role?: string;
  discoveryRelations?: boolean;
  occasionLegacy?: Record<string, string[]>;
  housewarming?: boolean;
  deferred?: string;
  purity?: boolean;
  interpretationEvidence: string[];
};
export function interpretHomepageQuery(
  value: unknown,
  brands: string[] = [],
  options: { discoveryRelations?: boolean } = {},
): ShoppingQuery {
  const originalQuery = String(value ?? ""),
    normalizedQuery = normalizeHomepageQuery(value);
  const result: ShoppingQuery = {
    originalQuery,
    normalizedQuery,
    discoveryRelations: options.discoveryRelations !== false,
    mode: !originalQuery.trim()
      ? "discovery"
      : /[\p{L}\p{N}]/u.test(normalizedQuery)
        ? "search"
        : "invalid",
    consumedSpans: [],
    unresolvedTerms: [],
    residualQuery: "",
    identities: [],
    materials: [],
    colors: [],
    attributes: [],
    recipients: [],
    occasions: [],
    labels: [],
    audienceKeys: [],
    subcategoryKeys: [],
    interpretationEvidence: [],
  };
  let remaining = fold(normalizedQuery);
  const brandAlias: Record<string, string> = { meribu: "meriboo" };
  const exactBrand = brands.find(
    (b) => fold(b) === (brandAlias[remaining] || remaining),
  );
  if (exactBrand) {
    result.consumedSpans.push({
      start: 0,
      end: remaining.length,
      text: remaining,
      kind: "brand",
      value: exactBrand,
    });
    result.brandQuery = exactBrand;
    result.residualQuery = fold(exactBrand);
    result.unresolvedTerms = words(exactBrand);
    result.interpretationEvidence.push(
      "Exact catalog brand identity; brand tokens are not material claims.",
    );
    return result;
  }
  const consume = (re: RegExp, kind: string, canonical: string) => {
    remaining = remaining.replace(re, (text: string, offset: number) => {
      result.consumedSpans.push({
        start: offset,
        end: offset + text.length,
        text,
        kind,
        value: canonical,
      });
      return " ".repeat(text.length);
    });
  };
  const phrase = (v: string, kind: string, canonical: string) =>
    consume(
      new RegExp(
        `(?<![a-z0-9])${fold(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`,
        "g",
      ),
      kind,
      canonical,
    );
  // Consume typed recipient ages before budgets: "до 7 години" is not €7.
  // Mother-specific parsing remains authoritative and unchanged.
  if (result.discoveryRelations && !/(?:mayka|mama)/.test(remaining)) {
    const requested = requestedAgeFromFolded(remaining);
    if (requested) {
      result.requestedAge = requested.age;
      phrase(requested.text, "recipient_age", JSON.stringify(requested.age));
    }
  }
  // Offsets describe folded normalized text (not original UTF-16 positions).
  const budgets = [
    ...remaining.matchAll(
      /(?:^|\s)(?:do|pod)\s*(?:€\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:€|evro|eur)?(?=\s|$)/g,
    ),
  ];
  if (budgets.length) {
    result.maxPriceEur = Math.min(
      ...budgets.map((m) => Number(m[1].replace(",", "."))),
    );
    consume(
      /(?:^|\s)(?:do|pod)\s*(?:€\s*)?\d+(?:[.,]\d{1,2})?\s*(?:€|evro|eur)?(?=\s|$)/g,
      "budget",
      String(result.maxPriceEur),
    );
  }
  if (
    /suha kozha/.test(remaining) ||
    (!result.discoveryRelations && /na 3 godini/.test(remaining))
  ) {
    result.deferred =
      "Липсват проверени данни за типа кожа или възрастовата пригодност.";
  }
  for (const v of ["подарък", "подаръци", "gift", "gifts"])
    if (contains(remaining, v)) {
      result.giftable = true;
      phrase(v, "intent", "gift");
    }
  for (const v of ["майка ми", "майка", "мама"])
    if (contains(remaining, v)) {
      result.mother = true;
      result.giftable = true;
      phrase(v, "relationship", "mother");
    }
  for (const v of ["нов дом", "housewarming"])
    if (contains(remaining, v)) {
      result.housewarming = true;
      result.giftable = true;
      phrase(v, "legacy_evidence", "Нов дом");
    }
  for (const v of ["сватба", "сватбен", "сватбена", "сватбени"])
    if (contains(remaining, v)) {
      result.occasions.push("Сватба");
      result.giftable = true;
      phrase(v, "occasion", "Сватба");
    }
  if (result.discoveryRelations) {
    for (const [canonical, variants] of occasionAliases) {
      if (canonical === "housewarming") continue;
      for (const variant of variants)
        if (contains(remaining, variant)) {
          result.giftable = true;
          if (!result.occasions.includes(canonical))
            result.occasions.push(canonical);
          (result.occasionLegacy ||= {})[canonical] = canonical
            .toLocaleLowerCase("bg")
            .split(" ");
          phrase(variant, "occasion", canonical);
        }
    }
    for (const variant of [
      "учителка",
      "учител",
      "учители",
      "teacher",
      "teachers",
    ])
      if (contains(remaining, variant)) {
        result.role = "Учителка";
        phrase(variant, "role", "Учителка");
      }
  }
  for (const [key, recipient, vs] of AUDIENCES)
    for (const v of vs)
      if (contains(remaining, v)) {
        result.audienceKey ||= key;
        if (!result.audienceKeys.includes(key)) result.audienceKeys.push(key);
        if (result.giftable) result.recipients.push(recipient);
        phrase(v, "audience", key);
      }
  if (result.mother) {
    const age = remaining.match(/(?:^|\s)na\s+(\d{1,3})\s+godini(?=\s|$)/);
    if (age) {
      result.motherAge = age[1];
      consume(/(?:^|\s)na\s+\d{1,3}\s+godini(?=\s|$)/g, "age", age[1]);
    }
    result.interpretationEvidence.push(
      "Mother eligibility: recipient + canonical age OR explicit title dedication; giftability remains mandatory.",
    );
  }
  if (result.discoveryRelations && !result.mother) {
    const requested = requestedAgeFromFolded(remaining);
    if (requested) {
      result.requestedAge = requested.age;
      phrase(requested.text, "age", JSON.stringify(requested.age));
    }
  }
  if (contains(remaining, "skincare")) {
    result.skincare = true;
    phrase("skincare", "intent", "face/body cosmetics");
  }
  for (const v of ["козметика", "cosmetics"])
    if (contains(remaining, v)) {
      result.categoryKey = "cosmetics";
      phrase(v, "category", "cosmetics");
    }
  for (const [canonical, vs] of [...MATERIALS, ...COLORS, ...ATTRS])
    for (const v of vs)
      if (contains(remaining, v)) {
        const field = MATERIALS.some(([c]) => c === canonical)
          ? "materials"
          : COLORS.some(([c]) => c === canonical)
            ? "colors"
            : "attributes";
        if (!result[field].includes(canonical)) result[field].push(canonical);
        phrase(v, field, canonical);
      }
  // Ambiguous silver definiteness is accepted only with a jewelry identity.
  // Standalone/model-name Сребърната keeps its pre-existing interpretation.
  const jewelryContext = IDENTITIES.filter((i) =>
    ["earrings", "necklace", "ring"].includes(i.key),
  ).some((i) =>
    [...i.aliases, ...(IDENTITY_QUERY_ALIASES[i.key] || [])].some((v) =>
      contains(remaining, v),
    ),
  );
  const queryMaterials: [string, string[]][] = [
    ...MATERIAL_QUERY_ALIASES,
    ...(jewelryContext
      ? [
          [
            "Сребро",
            ["сребърния", "сребърният", "сребърната", "сребърното"],
          ] as [string, string[]],
        ]
      : []),
  ];
  for (const [canonical, variants] of queryMaterials)
    for (const variant of variants)
      if (contains(remaining, variant)) {
        if (!result.materials.includes(canonical))
          result.materials.push(canonical);
        phrase(variant, "materials", canonical);
      }
  // Two-word scoped aliases before single-word product identities.
  if (contains(remaining, "t shirt")) {
    result.identities.push(IDENTITIES.find((i) => i.key === "tshirt")!);
    phrase("t shirt", "identity", "tshirt");
  }
  for (const i of IDENTITIES)
    for (const v of [...i.aliases, ...(IDENTITY_QUERY_ALIASES[i.key] || [])])
      if (contains(remaining, v)) {
        if (!result.identities.includes(i)) result.identities.push(i);
        phrase(v, "identity", i.key);
      }
  for (const [v, sub] of [
    ["лице", "cosmetics_face"],
    ["face", "cosmetics_face"],
    ["тяло", "cosmetics_body"],
    ["body", "cosmetics_body"],
    ["коса", "cosmetics_hair"],
    ["hair", "cosmetics_hair"],
  ] as const)
    if (contains(remaining, v)) {
      result.subcategoryKey ||= sub;
      if (!result.subcategoryKeys.includes(sub))
        result.subcategoryKeys.push(sub);
      phrase(v, "context", sub);
    }
  if (
    result.identities.some((i) => i.key === "cream") &&
    result.subcategoryKey === "cosmetics_face"
  )
    result.productType = "Кремове за лице";
  if (result.identities.some((i) => i.key === "shampoo")) {
    result.productType = "Шампоани";
    result.subcategoryKey ||= "cosmetics_hair";
    if (!result.subcategoryKeys.includes("cosmetics_hair"))
      result.subcategoryKeys.push("cosmetics_hair");
  }
  if (result.identities.some((i) => i.key === "earrings"))
    result.productType = "Обеци";
  if (remaining.includes("100%") || contains(remaining, "100")) {
    result.purity = true;
    phrase("100%", "purity", "100%");
    phrase("100", "purity", "100%");
  }
  result.unresolvedTerms = remaining
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t));
  result.residualQuery = result.unresolvedTerms.join(" ");
  if (
    result.mode === "search" &&
    !result.consumedSpans.length &&
    !result.unresolvedTerms.length
  )
    result.mode = "invalid";
  result.recipients = [...new Set(result.recipients)];
  result.labels = [
    ...result.identities.map((i) => i.types[0] || i.aliases[0]),
    ...result.materials,
    ...result.colors,
    ...result.attributes,
    ...result.recipients,
    ...result.occasions,
    ...(result.giftable ? ["Подарък"] : []),
    ...(result.mother ? ["За майка"] : []),
    ...(result.housewarming ? ["Нов дом (наследени данни)"] : []),
    ...(result.maxPriceEur !== undefined ? [`До €${result.maxPriceEur}`] : []),
  ];
  return result;
}
const LEXICAL_GROUPS = [
  ["mug", "mugs", "чаша", "чаши", "чашата", "чашите"],
  ["home", "дом"],
  ["interior", "интериор"],
  ["decor", "декор", "dekor"],
  ["clothing", "apparel", "outfit", "outfits", "облекло", "дреха", "дрехи"],
  ["jewelry", "бижута", "бижу"],
  ["night", "нощен", "нощна", "нощно"],
  ["day", "дневен", "дневна", "дневно"],
  ["mask", "маска"],
  ["lip", "lips", "устни"],
  ["cleaning", "почистване"],
  ["tea", "чай"],
  ["herb", "herbs", "билка", "билки"],
  ["supplement", "supplements", "добавка", "добавки"],
  ["extract", "extracts", "екстракт", "екстракти", "тинктура"],
  ["sport", "sports", "спорт"],
  ["organic", "органичен", "органична", "органично"],
  ["oversized", "oversize"],
].map((group) => group.map(fold));
const lexicalForms = (token: string) =>
  LEXICAL_GROUPS.find((g) => g.includes(token)) || [token];
type IndexedCard = {
  title: string;
  brand: string;
  raw: string;
  titleTokens: Set<string>;
  rawTokens: Set<string>;
};
const cache = new WeakMap<object, IndexedCard>();
function index(card: SearchCard) {
  let v = cache.get(card);
  if (!v) {
    const title = fold(card.dataset.productName),
      brand = fold(card.dataset.brandName),
      raw = fold(card.dataset.searchRaw);
    v = {
      title,
      brand,
      raw,
      titleTokens: new Set(title.split(" ")),
      rawTokens: new Set(raw.split(" ")),
    };
    cache.set(card, v);
  }
  return v;
}
const listEvidence = (actual: string[], required: string): Evidence =>
  actual.includes(required)
    ? "supported"
    : actual.length
      ? "contradicted"
      : "unknown";
// Reviewed product identities, not a general title/category override. Evidence and
// Master v3 rows 13/39/45: reports/search-founder-review-2026-10-21/FOUNDER_REVIEW.md.
// Slugs identify only the three approved products; unrelated lookalike titles fail closed.
function reviewedCompatibility(card: SearchCard, key: string): boolean {
  const d = card.dataset,
    title = index(card).title;
  if (key === "soap")
    return (
      ["sapun-bebcho", "bio-sapun-za-detsa-i-bebeta"].includes(
        d.productSlug || "",
      ) &&
      d.publicCategory === "kids" &&
      d.publicSubcategory === "kids_care" &&
      d.productType === "Бебешка хигиена" &&
      /^(?:bio )?sapun(?: |$)/.test(title)
    );
  return (
    key === "dress" &&
    d.productSlug === "damska-cherna-tenis-roklya" &&
    d.publicCategory === "clothing" &&
    d.publicSubcategory === "clothing_women" &&
    d.productType === "Спортни екипи" &&
    /(?:^| )tenis roklya(?: |$)/.test(title)
  );
}

// Ranking only: explicit baby intent keeps its existing order. No eligibility change.
function housewarmingTier(card: SearchCard, q: ShoppingQuery): number {
  if (
    !q.housewarming ||
    q.audienceKeys.includes("baby") ||
    q.recipients.includes("За бебе")
  )
    return 0;
  const d = card.dataset,
    audience = split(d.audience);
  if (audience.length === 1 && audience[0] === "Бебета") return 2;
  return d.publicCategory === "home" &&
    d.publicSubcategory !== "Офис пространство"
    ? 0
    : 1;
}

export function identityEvidence(card: SearchCard, i: Identity): Evidence {
  const d = card.dataset,
    ix = index(card),
    hasTitle = i.aliases.some((v) => contains(ix.title, v));
  if (reviewedCompatibility(card, i.key)) return "supported";
  if (d.publicCategory && !i.categories.includes(d.publicCategory))
    return "contradicted";
  if (
    i.key === "toy" &&
    d.publicCategory === "pets" &&
    d.publicSubcategory !== "pets_toys"
  )
    return "contradicted";
  if (supportedSourceConcept(card, "identity", i.key)) return "supported";
  // Combined taxonomy leaves do not prove every narrower product identity.
  const combinedLeaves: Record<string, string[]> = {
    soap: ["Сапуни и душ гелове"],
    shirt: ["Блузи и ризи"],
    tshirt: ["Тениски и потници"],
    pajama: ["Пижами и домашни комплекти"],
    cream: ["Кремове и балсами за бебе"],
  };
  if (combinedLeaves[i.key]?.includes(d.productType || "") && !hasTitle)
    return "unknown";
  if (i.types.includes(d.productType || "")) return "supported";
  if (d.productType && !(i.key === "table" && d.productType === "Мебели"))
    return "contradicted";
  const titleWords = ix.title.split(" ");
  const headAt = titleWords.findIndex((t) =>
    i.aliases.some((a) => fold(a) === t),
  );
  const qualifiers = new Set(
    [...MATERIALS, ...COLORS].flatMap(([, vs]) => vs.map(fold)),
  );
  const titleHead =
    headAt === 0 || (headAt === 1 && qualifiers.has(titleWords[0]));
  if (hasTitle && titleHead) return "supported";
  return d.productType ? "contradicted" : "unknown";
}
export type Eligibility = {
  state: Evidence;
  requirements: { field: string; value: string; state: Evidence }[];
};
export function homepageEligibility(
  card: SearchCard,
  q: ShoppingQuery,
): Eligibility {
  const d = card.dataset,
    requirements: Eligibility["requirements"] = [];
  const check = (field: string, value: string, state: Evidence) =>
    requirements.push({ field, value, state });
  for (const i of q.identities) {
    const direct = identityEvidence(card, i);
    const relation =
      q.discoveryRelations &&
      (!d.publicCategory || i.categories.includes(d.publicCategory)) &&
      relatedItem(card, i.key, q.materials, q.colors);
    check(
      "identity",
      i.key,
      direct === "supported" || relation ? "supported" : direct,
    );
  }
  for (const field of ["materials", "colors", "attributes"] as const)
    for (const v of q[field]) {
      const stored = listEvidence(split(d[field]), v);
      check(
        field,
        v,
        stored === "supported" ||
          (field === "materials" &&
            (supportedSourceConcept(card, "material", v) ||
              (q.discoveryRelations && q.identities.some(i =>
                (!d.publicCategory || i.categories.includes(d.publicCategory)) &&
                relatedItem(card, i.key, q.materials, q.colors))))) ||
          (field === "colors" &&
            q.discoveryRelations &&
            relationProof(card, "offered_variant", v).length > 0)
          ? "supported"
          : stored,
      );
    }
  if (q.categoryKey)
    check(
      "category",
      q.categoryKey,
      d.publicCategory === q.categoryKey
        ? "supported"
        : d.publicCategory
          ? "contradicted"
          : "unknown",
    );
  for (const subcategory of q.subcategoryKeys)
    check(
      "subcategory",
      subcategory,
      d.publicSubcategory === subcategory
        ? "supported"
        : d.publicSubcategory
          ? "contradicted"
          : "unknown",
    );
  if (q.skincare)
    check(
      "skincare",
      "face/body cosmetics",
      d.publicCategory === "cosmetics" &&
        ["cosmetics_face", "cosmetics_body"].includes(d.publicSubcategory || "")
        ? "supported"
        : d.publicCategory
          ? "contradicted"
          : "unknown",
    );
  if (q.giftable)
    check(
      "giftable",
      "1",
      d.giftable === "1"
        ? "supported"
        : d.giftable === "0"
          ? "contradicted"
          : "unknown",
    );
  for (const v of q.recipients)
    check("recipient", v, listEvidence(split(d.recipients), v));
  for (const v of q.occasions)
    check(
      "occasion",
      v,
      q.discoveryRelations && q.occasionLegacy?.[v]
        ? occasionEvidence(card, v, q.occasionLegacy[v])
          ? "supported"
          : "unknown"
        : listEvidence(split(d.giftOccasions), v),
    );
  if (q.discoveryRelations && q.role)
    check(
      "role",
      q.role,
      relationProof(card, "role", q.role).length ||
        ["учител", "учителка", "учители"].some((v) =>
          contains(index(card).raw, v),
        )
        ? "supported"
        : "unknown",
    );
  if (q.discoveryRelations && q.requestedAge && !q.mother)
    check(
      "requested_age",
      JSON.stringify(q.requestedAge),
      ageEvidence(card, q.requestedAge, q.recipients),
    );
  for (const audienceKey of q.audienceKeys.filter(() => !q.recipients.length)) {
    const allowed: Record<string, string[]> = {
      woman: ["Жени", "Унисекс"],
      man: ["Мъже", "Унисекс"],
      child: ["Деца"],
      baby: ["Бебета"],
    };
    const a = split(d.audience);
    check(
      "audience",
      audienceKey,
      a.some((v) => allowed[audienceKey].includes(v))
        ? "supported"
        : a.length
          ? "contradicted"
          : "unknown",
    );
  }
  if (q.maxPriceEur !== undefined) {
    const max = Number(d.priceMax);
    check(
      "priceMax",
      String(q.maxPriceEur),
      !d.priceMax || !Number.isFinite(max) || max <= 0
        ? "unknown"
        : max <= q.maxPriceEur
          ? "supported"
          : "contradicted",
    );
  }
  if (q.mother) {
    const ages = split(d.recipientAge);
    const supportedAges = ["50", "60", "70", "80"];
    const canonicalAdultAges = [
      "20",
      "25",
      "30",
      "35",
      "45",
      "50",
      "60",
      "70",
      "80",
    ];
    const requestedSupported =
      !q.motherAge || canonicalAdultAges.includes(q.motherAge);
    const ageA = q.motherAge
      ? ages.includes(q.motherAge)
      : ages.some((a) => supportedAges.includes(a));
    const pathA =
      split(d.recipients).includes("За жена") && ageA && requestedSupported;
    // Title is the sole approved source for explicit dedication. Never search descriptions/URLs.
    const title = index(card).title;
    const dedication =
      /(?:^| )(?:za (?:mama|mamata)|za (?:mayka|maykata)(?= (?:mi|ni)(?: |$)|$)|(?:nasha|moyata) mayka)(?: |$)/.test(
        title,
      ) ||
      /(?:^| )(?:kartina|kartichka|teniska|chasha) (?:mama|mayka|mamo|mayko)(?: |$)/.test(
        title,
      ) ||
      /(?:^| )parvo mayka a sega baba(?: |$)/.test(title) ||
      /(?:^| )i mama e chovek(?: |$)/.test(title);
    const contradictoryAge =
      !!q.motherAge && ages.length > 0 && !ages.includes(q.motherAge);
    const pathB = dedication && requestedSupported && !contradictoryAge;
    check(
      "mother_suitability",
      `Path A=${pathA}; Path B=${pathB}; title source=productName; stored ages=${ages.join("|") || "missing (not proof of suitability)"}${q.motherAge ? "; requested age=" + q.motherAge : ""}`,
      pathA || pathB
        ? "supported"
        : contradictoryAge
          ? "contradicted"
          : "unknown",
    );
  }
  if (q.housewarming)
    check(
      "legacy_occasion",
      "Нов дом (noncanonical)",
      q.discoveryRelations &&
        relationProof(card, "occasion", "housewarming").length
        ? "supported"
        : listEvidence(split(d.giftOccasions), "Нов дом"),
    );
  if (q.deferred)
    check("deferred", "unavailable verified suitability", "unknown");
  if (q.purity)
    check(
      "purity",
      "explicit 100% material",
      q.materials.length === 1 &&
        contains(index(card).raw, `100% ${fold(q.materials[0])}`)
        ? "supported"
        : "unknown",
    );
  return {
    state: requirements.some((r) => r.state === "contradicted")
      ? "contradicted"
      : requirements.some((r) => r.state === "unknown")
        ? "unknown"
        : "supported",
    requirements,
  };
}
export function homepageRank(card: SearchCard, q: ShoppingQuery) {
  const ix = index(card),
    query = fold(q.brandQuery || q.normalizedQuery);
  const reasons: { field: string; points: number }[] = [];
  const add = (field: string, points: number) =>
    reasons.push({ field, points });
  if (query && ix.title === query) add("exact_title", 2000);
  if (query && ix.brand === query) add("exact_brand", 1800);
  if (query && contains(ix.title, query)) add("title_phrase", 500);
  if (
    query &&
    !q.materials.length &&
    !q.colors.length &&
    !q.attributes.length &&
    contains(ix.raw, query)
  )
    add("description_phrase", 10);
  if (query && ix.brand.startsWith(query) && ix.brand !== query)
    add("brand_prefix", 300);
  for (const t of words(q.normalizedQuery).filter((t) => !STOP.has(t))) {
    if (ix.titleTokens.has(t)) add("title_token", 50);
    else if (ix.brand.split(" ").includes(t)) add("brand_token", 35);
    else if (q.unresolvedTerms.includes(t) && ix.rawTokens.has(t))
      add("description_token", 3);
  }
  for (const i of q.identities) {
    if (i.aliases.some((v) => contains(ix.title, v)))
      add("title_identity", 160);
    if (i.types.includes(card.dataset.productType || ""))
      add("taxonomy_identity", 80);
  }
  for (const [field, defs] of [
    ["materials", MATERIALS],
    ["colors", COLORS],
    ["attributes", ATTRS],
  ] as const)
    for (const v of q[field])
      if (defs.find(([c]) => c === v)?.[1].some((a) => contains(ix.title, a)))
        add(`title_${field}`, 40);
  for (const material of q.materials) {
    const term = fold(material);
    if (new RegExp(`100% (?:[a-z]+ ){0,2}${term}(?: |$)`).test(ix.raw))
      add("explicit_composition_text", 25);
  }
  return { score: reasons.reduce((sum, r) => sum + r.points, 0), reasons };
}
export type ManualSearchFilters = {
  category?: string;
  subcategory?: string;
  productType?: string;
  attributes?: string[];
  materials?: string[];
  colors?: string[];
  gift?: string[];
  priceRange?: string;
  deliveryOutside?: boolean;
};
export function matchesHomepageFilters(
  card: SearchCard,
  f: ManualSearchFilters = {},
) {
  const d = card.dataset;
  if (
    (f.category && d.publicCategory !== f.category) ||
    (f.subcategory && d.publicSubcategory !== f.subcategory) ||
    (f.productType && d.productType !== f.productType)
  )
    return false;
  if (f.attributes?.some((v) => !split(d.attributes).includes(v))) return false;
  for (const field of ["materials", "colors"] as const)
    if (f[field]?.length && !f[field]!.some((v) => split(d[field]).includes(v)))
      return false;
  if (f.deliveryOutside && d.deliversAbroad !== "1") return false;
  if (
    f.gift?.length &&
    (d.giftable !== "1" ||
      !f.gift.every((v) => {
        const [kind, ...rest] = v.split(":");
        return (
          kind === "giftable" ||
          split(
            d[
              kind === "recipient"
                ? "recipients"
                : kind === "occasion"
                  ? "giftOccasions"
                  : kind === "attribute"
                    ? "attributes"
                    : "___"
            ],
          ).includes(rest.join(":"))
        );
      }))
  )
    return false;
  if (f.priceRange && f.priceRange !== "all") {
    const a = d.priceMin ? Number(d.priceMin) : NaN,
      b = d.priceMax ? Number(d.priceMax) : NaN,
      low = Number.isFinite(a) ? a : b,
      high = Number.isFinite(b) ? b : a;
    if (!Number.isFinite(low) || !Number.isFinite(high)) return false;
    if (
      (f.priceRange === "0-25" && low > 25) ||
      (f.priceRange === "25-50" && !(low <= 50 && high >= 25)) ||
      (f.priceRange === "50-100" && !(low <= 100 && high >= 50)) ||
      (f.priceRange === "100+" && high < 100)
    )
      return false;
  }
  return true;
}
export function searchHomepage<T extends SearchCard>(
  cards: T[],
  value: unknown,
  filters: ManualSearchFilters = {},
  options: { discoveryRelations?: boolean } = {},
) {
  const intent = interpretHomepageQuery(
      value,
      [...new Set(cards.map((c) => c.dataset.brandName || ""))].filter(Boolean),
      options,
    ),
    evidence = new Map<
      T,
      {
        eligibility: Eligibility;
        rank: ReturnType<typeof homepageRank>;
        stage: string;
      }
    >();
  const eligible = cards.filter((c) => matchesHomepageFilters(c, filters));
  if (intent.mode === "invalid")
    return {
      cards: [] as T[],
      intent,
      fallback: false,
      evidence,
      message: "Моля, въведете дума или фраза за търсене.",
    };
  if (intent.mode === "discovery")
    return { cards: eligible, intent, fallback: false, evidence, message: "" };
  const primary: T[] = [],
    fallback: T[] = [];
  for (const c of eligible) {
    const eligibility = homepageEligibility(c, intent);
    if (eligibility.state !== "supported") continue;
    if (
      intent.discoveryRelations &&
      !intent.brandQuery &&
      excludedItemTerms(c, intent.unresolvedTerms)
    )
      continue;
    const ix = index(c),
      query = fold(intent.brandQuery || intent.normalizedQuery);
    // Explicit constraints are checked before both stages. Prefix recovery is brand-only.
    const exactBrand = ix.brand === query;
    const tokens = intent.unresolvedTerms;
    const exact = tokens.every((t) =>
      lexicalForms(t).some(
        (form) =>
          ix.rawTokens.has(form) ||
          ix.titleTokens.has(form) ||
          ix.brand.split(" ").includes(form),
      ),
    );
    const brandPrefix =
      tokens.length === 1 &&
      tokens[0].length >= 4 &&
      ix.brand.split(" ").some((t) => t.startsWith(tokens[0]));
    if (!exactBrand && !exact && !brandPrefix) continue;
    const rank = homepageRank(c, intent),
      stage = exact || exactBrand ? "primary" : "brand_prefix";
    evidence.set(c, { eligibility, rank, stage });
    (stage === "primary" ? primary : fallback).push(c);
  }
  const relationTier = (card: T) => {
    if (!intent.discoveryRelations) return 0;
    if (
      intent.identities.some(
        (i) =>
          identityEvidence(card, i) !== "supported" &&
          relatedItem(card, i.key, intent.materials, intent.colors),
      )
    )
      return 2;
    if (
      intent.colors.some(
        (color) =>
          !split(card.dataset.colors).includes(color) &&
          relationProof(card, "offered_variant", color).length,
      )
    )
      return 1;
    return 0;
  };
  const occasionTier = (card: T) => {
    if (!intent.discoveryRelations) return 0;
    const concepts = intent.housewarming
      ? ["housewarming"]
      : Object.keys(intent.occasionLegacy || {});
    if (!concepts.length) return 0;
    const claims = concepts.flatMap((c) => relationProof(card, "occasion", c));
    return claims.some((c) => c.field === "name_bg")
      ? 0
      : claims.some((c) => c.field !== "gift_occasion")
        ? 1
        : 2;
  };
  // Keep compatible brand-prefix candidates competing with title matches, never force brand filtering.
  const compatibilityTier = (card: T) =>
    intent.identities.some((i) => reviewedCompatibility(card, i.key)) ? 1 : 0;
  for (const card of [...primary, ...fallback]) {
    const rank = evidence.get(card)!.rank;
    // Zero-point reasons expose ordering tiers without changing lexical scores.
    if (relationTier(card))
      rank.reasons.push({
        field: relationTier(card) === 2 ? "related_set" : "offered_variant",
        points: 0,
      });
    if (compatibilityTier(card))
      rank.reasons.push({ field: "reviewed_compatibility_tier_1", points: 0 });
    if (intent.housewarming)
      rank.reasons.push({
        field: `housewarming_tier_${housewarmingTier(card, intent)}`,
        points: 0,
      });
  }
  const matched = [...primary, ...fallback].sort(
    (a, b) =>
      relationTier(a) - relationTier(b) ||
      compatibilityTier(a) - compatibilityTier(b) ||
      housewarmingTier(a, intent) - housewarmingTier(b, intent) ||
      occasionTier(a) - occasionTier(b) ||
      evidence.get(b)!.rank.score - evidence.get(a)!.rank.score ||
      Number(a.dataset.featuredIndex || 0) -
        Number(b.dataset.featuredIndex || 0),
  );
  return {
    cards: matched,
    intent,
    fallback: primary.length === 0 && fallback.length > 0,
    evidence,
    message:
      intent.deferred ||
      (!matched.length && intent.mother
        ? "Разпознахме подарък за майка, но няма достатъчно данни за подходящи продукти."
        : !matched.length && intent.housewarming
          ? "Няма продукти с потвърдени данни за подарък за нов дом."
          : !matched.length
            ? "Няма продукти, които отговарят на избраната комбинация."
            : ""),
  };
}
