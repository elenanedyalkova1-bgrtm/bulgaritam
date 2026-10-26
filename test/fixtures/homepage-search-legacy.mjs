// Frozen pre-change homepage behavior, extracted once for parity; no runtime source slicing.
import {parseBulgarianShoppingIntent} from "../../src/lib/search-intent.ts";
    const CYRILLIC_TO_LATIN = {
      "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ж": "zh", "з": "z",
      "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p",
      "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts", "ч": "ch",
      "ш": "sh", "щ": "sht", "ъ": "a", "ь": "y", "ю": "yu", "я": "ya",
    };

    const BG_SUFFIXES = [
      "овете", "евете", "анията", "ението", "енията", "ищата", "ите", "ове", "еве",
      "ата", "ята", "ният", "ната", "ното", "ните", "ски", "ска", "ско", "чен", "чна",
      "чно", "чни", "ен", "на", "но", "ни", "ът", "та", "то", "те", "ия", "ие", "а",
      "я", "и", "е", "о", "у",
    ];

    const SPECIAL_EQUIVALENTS = [
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
    const BG_SEARCH_STOP_WORDS = new Set(["за", "от", "с", "на"]);

    const normalizeSearchText = (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/&/g, " ")
        .replace(/['\"`´’‘]/g, "")
        .replace(/[.,/#!$%^*;:{}=\\-_~()@\\[\\]+<>?\\\\|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const transliterateBulgarianToLatin = (value) =>
      Array.from(normalizeSearchText(value))
        .map((char) => CYRILLIC_TO_LATIN[char] || char)
        .join("");

    const tokenizeSearchText = (value) =>
      normalizeSearchText(value)
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token && !BG_SEARCH_STOP_WORDS.has(token));

    const expandSearchToken = (token) => {
      const forms = new Set();
      const normalized = normalizeSearchText(token);
      if (!normalized) return Array.from(forms);
      forms.add(normalized);
      if (normalized.length >= 4) forms.add(normalized.slice(0, 4));
      if (normalized.length >= 6) forms.add(normalized.slice(0, 5));

      BG_SUFFIXES.forEach((suffix) => {
        if (normalized.length - suffix.length >= 3 && normalized.endsWith(suffix)) {
          forms.add(normalized.slice(0, -suffix.length));
        }
      });

      SPECIAL_EQUIVALENTS.forEach(([pattern, equivalents]) => {
        if (pattern.test(normalized)) equivalents.forEach((entry) => forms.add(entry));
      });

      SEMANTIC_GROUPS.forEach((group) => {
        if (group.includes(normalized)) group.forEach((entry) => forms.add(entry));
      });

      return Array.from(forms);
    };

    const buildSearchGroups = (value) => {
      const normalized = normalizeSearchText(value);
      const transliterated = transliterateBulgarianToLatin(normalized);
      const rawTokens = [...new Set([
        ...tokenizeSearchText(normalized),
        ...tokenizeSearchText(transliterated),
      ])];

      return rawTokens.map((token) => expandSearchToken(token));
    };

    const buildSearchQuery = (value) => {
      const normalized = normalizeSearchText(value);
      return {
        normalized,
        latin: transliterateBulgarianToLatin(normalized),
        groups: buildSearchGroups(normalized),
      };
    };

    const buildSearchDocumentString = (value) => {
      const tokens = new Set();
      [normalizeSearchText(value), transliterateBulgarianToLatin(value)].forEach((entry) => {
        tokenizeSearchText(entry).forEach((token) => {
          expandSearchToken(token).forEach((form) => tokens.add(form));
        });
      });
      return Array.from(tokens).join(" ");
    };

    const searchCardCache = new WeakMap();

    const getSearchCardData = (card) => {
      if (!searchCardCache.has(card)) {
        const raw = normalizeSearchText(card?.dataset?.searchRaw || "");
        const rawLatin = transliterateBulgarianToLatin(raw);
        const structured = String(card?.dataset?.search || card?.search || "");
        const searchable = `${raw} ${structured}`.trim();
        const productName = normalizeSearchText(card?.dataset?.productName || "");
        const brandName = normalizeSearchText(card?.dataset?.brandName || "");
        searchCardCache.set(card, {
          raw,
          rawLatin,
          searchable,
          searchableLatin: transliterateBulgarianToLatin(searchable),
          productName,
          productNameLatin: transliterateBulgarianToLatin(productName),
          brandName,
          brandNameLatin: transliterateBulgarianToLatin(brandName),
          tokens: new Set([
            ...structured.split(/\s+/).filter(Boolean),
            ...tokenizeSearchText(raw),
            ...tokenizeSearchText(rawLatin),
          ]),
        });
      }
      return searchCardCache.get(card);
    };

    const matchesSearchDocument = (card, value) => {
      const query = typeof value === "string" ? buildSearchQuery(value) : value;
      const normalizedQuery = query.normalized;
      if (!normalizedQuery) return true;
      const { raw, rawLatin, searchable, searchableLatin, tokens } = getSearchCardData(card);
      const queryLatin = query.latin;
      if (
        raw.includes(normalizedQuery) ||
        raw.includes(queryLatin) ||
        rawLatin.includes(normalizedQuery) ||
        rawLatin.includes(queryLatin) ||
        searchable.includes(normalizedQuery) ||
        searchable.includes(queryLatin) ||
        searchableLatin.includes(normalizedQuery) ||
        searchableLatin.includes(queryLatin)
      ) {
        return true;
      }
      const groups = query.groups;
      if (!groups.length) return true;
      return groups.every((group) =>
        group.some((token) => {
          if (!token) return false;
          if (token.length < 3) return false;
          if (tokens.has(token)) return true;
          for (const docToken of tokens) {
            if (docToken.startsWith(token)) return true;
          }
          return false;
        })
      );
    };

    const getSearchRelevanceScore = (card, value) => {
      const query = typeof value === "string" ? buildSearchQuery(value) : value;
      const normalizedQuery = query.normalized;
      if (!normalizedQuery) return 0;

      const queryLatin = query.latin;
      const { productName, productNameLatin, brandName, brandNameLatin, raw, rawLatin, searchable, searchableLatin } = getSearchCardData(card);
      const queryGroups = query.groups;
      let score = 0;

      if (productName === normalizedQuery || productNameLatin === queryLatin) score += 260;
      if (productName.startsWith(normalizedQuery) || productNameLatin.startsWith(queryLatin)) score += 190;
      if (productName.includes(normalizedQuery) || productName.includes(queryLatin) || productNameLatin.includes(normalizedQuery) || productNameLatin.includes(queryLatin)) score += 150;
      if (brandName === normalizedQuery || brandNameLatin === queryLatin) score += 130;
      if (brandName.includes(normalizedQuery) || brandNameLatin.includes(queryLatin)) score += 75;
      if (raw.includes(normalizedQuery) || rawLatin.includes(queryLatin)) score += 60;
      if (searchable.includes(normalizedQuery) || searchable.includes(queryLatin) || searchableLatin.includes(normalizedQuery) || searchableLatin.includes(queryLatin)) score += 45;

      queryGroups.forEach((group) => {
        const bestTokenScore = group.reduce((best, token) => {
          if (!token) return best;
          if (productName.includes(token) || productNameLatin.includes(token)) return Math.max(best, 42);
          if (brandName.includes(token) || brandNameLatin.includes(token)) return Math.max(best, 30);
          if (searchable.includes(token) || searchableLatin.includes(token)) return Math.max(best, 18);
          return best;
        }, 0);
        score += bestTokenScore;
      });

      return score;
    };

    const sortCardsForSearch = (cards, value) => {
      const query = typeof value === "string" ? buildSearchQuery(value) : value;
      const scores = new Map(cards.map((card) => [card, getSearchRelevanceScore(card, query)]));
      return [...cards].sort((a, b) => {
        const scoreDiff = scores.get(b) - scores.get(a);
        if (scoreDiff !== 0) return scoreDiff;
        return Number(a.dataset.featuredIndex) - Number(b.dataset.featuredIndex);
      });
    };

    const splitPipeValues = (value) => String(value || "").split("|").map((item) => item.trim()).filter(Boolean);
    const AUDIENCE_VALUE_TERMS = {
      woman: ["жена", "жени", "дамски", "дамско", "women", "woman"],
      man: ["мъж", "мъже", "мъжки", "мъжко", "men", "man"],
      child: ["дете", "деца", "детски", "детско", "children", "kids"],
      baby: ["бебе", "бебета", "бебешки", "бебешко", "baby"],
    };
    const matchesAudience = (card, audienceKey) => {
      if (!audienceKey) return true;
      const values = splitPipeValues(card.dataset.audience).map(normalizeSearchText);
      const terms = AUDIENCE_VALUE_TERMS[audienceKey] || [];
      if (values.length) {
        return values.includes("унисекс") || values.some((value) => terms.some((term) => value === term || value.includes(term)));
      }
      const publicSubcategory = normalizeSearchText(card.dataset.publicSubcategory || "");
      if (publicSubcategory.includes("унисекс")) return audienceKey === "woman" || audienceKey === "man";
      if (audienceKey === "woman" && publicSubcategory === "clothing women") return true;
      if (audienceKey === "man" && publicSubcategory === "clothing men") return true;
      return false;
    };
    const matchesMaximumPrice = (card, maximum) => {
      if (!Number.isFinite(maximum)) return true;
      const low = Number(card.dataset.priceMin);
      const high = Number(card.dataset.priceMax);
      const highestKnownPrice = Number.isFinite(high) && high > 0 ? high : low;
      return Number.isFinite(highestKnownPrice) && highestKnownPrice > 0 && highestKnownPrice <= maximum;
    };

export function legacySearch(allCards,v){const catalogueMaterials=[...new Set(allCards.flatMap(c=>c.dataset.materials.split("|")).filter(Boolean))]; const currentSearchIntent=parseBulgarianShoppingIntent(v,{materials:catalogueMaterials});const filteredCards=[];let searchFallbackRequired=false;const matchesManualFilters=()=>true;
      const matchesIntent = (card) => {
        if (!currentSearchIntent) return true;
        const attributes = splitPipeValues(card.dataset.attributes);
        const recipients = splitPipeValues(card.dataset.recipients);
        const giftOccasions = splitPipeValues(card.dataset.giftOccasions);
        const materials = splitPipeValues(card.dataset.materials);
        if (currentSearchIntent.categoryKey && card.dataset.publicCategory !== currentSearchIntent.categoryKey) return false;
        if (currentSearchIntent.subcategoryKey && card.dataset.publicSubcategory !== currentSearchIntent.subcategoryKey) return false;
        if (currentSearchIntent.productType && card.dataset.productType !== currentSearchIntent.productType) return false;
        if (currentSearchIntent.giftable && card.dataset.giftable !== "1") return false;
        if (!currentSearchIntent.recipients.length && !matchesAudience(card, currentSearchIntent.audienceKey)) return false;
        if (currentSearchIntent.recipients.some((entry) => !recipients.includes(entry))) return false;
        if (currentSearchIntent.occasions.some((entry) => !giftOccasions.includes(entry))) return false;
        if (currentSearchIntent.attributes.some((entry) => !attributes.includes(entry))) return false;
        if (currentSearchIntent.materials.length && !currentSearchIntent.materials.some((entry) => materials.includes(entry))) return false;
        if (!matchesMaximumPrice(card, currentSearchIntent.maxPriceEur)) return false;
        return true;
      };

      const textQuery = currentSearchIntent ? currentSearchIntent.residualQuery : v;
      const searchQuery = buildSearchQuery(textQuery);
      allCards.forEach((card) => {
        if (matchesSearchDocument(card, searchQuery) && matchesIntent(card) && matchesManualFilters(card)) {
          filteredCards.push(card);
        }
      });

      if (currentSearchIntent && filteredCards.length === 0) {
        const fallbackQuery = normalizeSearchText(v).replace(/(^|\s)за(?=\s|$)/g, " ").replace(/\s+/g, " ").trim();
        allCards.forEach((card) => {
          const attributes = splitPipeValues(card.dataset.attributes);
          const recipients = splitPipeValues(card.dataset.recipients);
          const giftOccasions = splitPipeValues(card.dataset.giftOccasions);
          const materials = splitPipeValues(card.dataset.materials);
          const isCompatibleLegacyFallback =
            (!currentSearchIntent.categoryKey || card.dataset.publicCategory === currentSearchIntent.categoryKey) &&
            (!currentSearchIntent.subcategoryKey || card.dataset.publicSubcategory === currentSearchIntent.subcategoryKey) &&
            (!currentSearchIntent.productType || !card.dataset.productType || card.dataset.productType === currentSearchIntent.productType) &&
            (!currentSearchIntent.giftable || card.dataset.giftable === "1") &&
            (currentSearchIntent.recipients.length > 0 || matchesAudience(card, currentSearchIntent.audienceKey)) &&
            currentSearchIntent.recipients.every((entry) => !recipients.length || recipients.includes(entry)) &&
            currentSearchIntent.occasions.every((entry) => !giftOccasions.length || giftOccasions.includes(entry)) &&
            currentSearchIntent.attributes.every((entry) => !attributes.length || attributes.includes(entry)) &&
            (!currentSearchIntent.materials.length || currentSearchIntent.materials.some((entry) => materials.includes(entry))) &&
            matchesMaximumPrice(card, currentSearchIntent.maxPriceEur);
          if (isCompatibleLegacyFallback && matchesManualFilters(card) && matchesSearchDocument(card, fallbackQuery)) filteredCards.push(card);
        });
        searchFallbackRequired = filteredCards.length > 0;
      }


return {intent:currentSearchIntent,cards:sortCardsForSearch(filteredCards,searchQuery),fallback:searchFallbackRequired,score:c=>getSearchRelevanceScore(c,searchQuery)};}
