import test from "node:test";
import assert from "node:assert/strict";
import { productPublishing } from "../src/lib/product-seo";

test("long variant identity survives when optional site branding cannot fit", () => {
  const name = "Балсам за устни с хиалуронова киселина портокал 15 мл";
  const result = productPublishing({ name_bg: name, brand_name: "CIBLY" });
  assert.equal(result.title, `${name} | CIBLY`);
  assert.ok(result.title.includes("портокал 15 мл"));
  assert.equal(result.titleSource, "generated");
});

test("stored SEO copy takes precedence and is not cut to 60/155 characters", () => {
  const title = "Модел с пълно име и точна разновидност ".repeat(3).trim();
  const description = "Състав, размери и описание от съществуващите продуктови данни. ".repeat(4).trim();
  const result = productPublishing({ name_bg: "Модел", brand_name: "Бранд", meta_title_bg: title, meta_desc_bg: description, short_desc_bg: "Кратко описание." });
  assert.equal(result.title, title);
  assert.equal(result.description, description);
  assert.equal(result.titleSource, "meta_title_bg");
  assert.equal(result.descriptionSource, "meta_desc_bg");
  assert.equal(result.schemaDescription, "Кратко описание.");
});

test("missing or unusable metadata falls back to stored lead, then product and brand only", () => {
  const result = productPublishing({ name_bg: "Модел", brand_name: "Бранд", meta_title_bg: " ", meta_desc_bg: "<script>bad</script>", short_desc_bg: "Състав: памук." });
  assert.equal(result.title, "Модел | Бранд | Българитъм");
  assert.equal(result.description, "Състав: памук.");
  assert.equal(result.descriptionSource, "short_desc_bg");
  const empty = productPublishing({ name_bg: "Модел", brand_name: "Бранд", meta_desc_bg: "undefined" });
  assert.equal(empty.description, "Модел от Бранд");
  assert.equal(empty.descriptionSource, "generated");
});

test("identical descriptions are not repeated, including whitespace-only differences", () => {
  const result = productPublishing({ short_desc_bg: "Състав: памук.", long_desc_bg: "  Състав:\n памук.  " });
  assert.deepEqual(result.longParagraphs, []);
  assert.equal(result.schemaDescription, "Състав: памук.");
});

test("distinct stored paragraphs remain intact; schema falls back to visible long copy when lead is missing", () => {
  const result = productPublishing({ long_desc_bg: "Размери: 10 × 20 см.\r\n\r\nСъстав: памук & лен." });
  assert.deepEqual(result.longParagraphs, ["Размери: 10 × 20 см.", "Състав: памук & лен."]);
  assert.equal(result.schemaDescription, "Размери: 10 × 20 см. Състав: памук & лен.");
});

test("retains the reviewed Dot description rather than replacing it with less specific stored copy", () => {
  const result = productPublishing({ slug: "roklya-dot", meta_desc_bg: "Стилен модел с отличителна визия." });
  assert.equal(result.descriptionSource, "reviewed_exception");
  assert.ok(result.description.includes("размери S, M и L"));
});

test("identity comparison accepts punctuation, case, spacing and grammatical formatting", () => {
  for (const [name, title] of [
    ["Бебешки калпак", "Бебешки и детски калпак от Веникс | Българитъм"],
    ["Квадратната табуретка", "Квадратна табуретка от ТОФИ | В Българитъм"],
    ["Комплект „Роза“ – 3 части", "РОЗА: комплект (3 части) | Бранд"],
    ["Серум 1,5 мл", "Серум 1.5   мл | Бранд"],
    ["Топ със златисти детайли", "Топ с златисти детайли | Бранд"],
  ]) {
    assert.equal(productPublishing({ name_bg: name, meta_title_bg: title }).titleSource, "meta_title_bg", name);
  }
});

test("missing identity, variants, whole model tokens, quantities and negation trigger full fallback", () => {
  for (const [name, title] of [
    ["MIMA асиметрична пола със златисти детайли", "MIMA пола | Бранд"],
    ["Бебешки комплект – 3 части", "Бебешки комплект | Бранд"],
    ["Риза модел 42", "Риза модел 423 | Бранд"],
    ["Серум 1,5 мл", "Серум 15 мл | Бранд"],
    ["Крем без аромат", "Крем с аромат | Бранд"],
    ["VA VA VOOM яке", "VA VOOM яке | Бранд"],
    ["Топ черен", "Топ червени | Бранд"],
    ["Марта чанта", "Мар чанта | Бранд"],
  ]) {
    const result = productPublishing({ name_bg: name, brand_name: "Бранд", meta_title_bg: title });
    assert.equal(result.titleSource, "generated", name);
    assert.ok(result.title.startsWith(`${name} | Бранд`), name);
    // BaseLayout resolves the already-resolved title again.
    assert.equal(productPublishing({ name_bg: name, brand_name: "Бранд", meta_title_bg: result.title }).title, result.title);
  }
});
