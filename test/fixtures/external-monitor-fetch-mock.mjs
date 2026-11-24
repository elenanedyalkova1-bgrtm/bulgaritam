const brands = ["ok", "blocked", "timeout", "missing"].map((name, i) => ({ id: i + 1, brand_name: name, brand_url: `https://${name}.test/`, external_monitoring_enabled: true }));
const products = brands.map((b) => ({ id: b.id, brand_id: b.id, source_url: `https://${b.brand_name}.test/p`, canonical_url: `https://${b.brand_name}.test/p`, title: b.brand_name, is_active: true }));
const sheets = [{ properties: { sheetId: 1, title: "Price History", gridProperties: { rowCount: 1000, columnCount: 26 } } }, { properties: { sheetId: 2, title: "Prices", gridProperties: { rowCount: 1000, columnCount: 26 } } }, { properties: { sheetId: 3, title: "Price Timeline", gridProperties: { rowCount: 1000, columnCount: 26 } } }];
const headers = ["checked_at","product_id","product_name","brand","product_url","detected_price","currency","status","extraction_method","confidence","previous_verified_price","difference","observation_id","regular_price","regular_price_currency","regular_price_method","regular_price_evidence","entity_type","entity_id"];
const ok = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  if (url.startsWith("https://api.baserow.io/")) {
    if (init.method === "PATCH") return process.env.MOCK_INTERNAL_FAILURE === "baserow" ? ok({},503) : ok({});
    if (url.includes("filter__canonical_key__equal")) return ok({results:[],next:null});
    const table = url.match(/table\/(\d+)/)?.[1]; return ok({ results: table === "1" ? brands : table === "2" ? [] : products, next: null });
  }
  if (url.startsWith("https://oauth2.googleapis.com")) return ok({ access_token: "mock" });
  if (url.startsWith("https://sheets.googleapis.com/")) {
    if (url.includes(":append")) return process.env.MOCK_INTERNAL_FAILURE === "sheets" ? ok({error:"failed"},400) : ok({updates:{updatedRows:4}});
    if (url.includes("M2%3AM")) return ok({values:[]});
    if (url.includes("A%3AS")) return ok({values:[headers]});
    if (url.includes(":batchUpdate")) return ok({replies:[]});
    return ok({sheets});
  }
  if (url.includes("timeout.test")) { const e = new Error("timeout"); e.name = "AbortError"; throw e; }
  if (url.includes("blocked.test")) return new Response("blocked", {status:403});
  if (url.includes("missing.test")) return new Response("missing", {status:404});
  if (url === "https://ok.test/") return new Response('<a href="/product/one">Product</a>', {status:200});
  if (url.includes("ok.test") && !url.includes("/p")) return new Response("missing", {status:404});
  if (url.includes("ok.test")) return new Response('<script type="application/ld+json">{"@type":"Product","name":"OK","offers":{"@type":"Offer","price":"19","priceCurrency":"EUR"}}</script>', {status:200});
  throw new Error(`Unexpected request: ${url}`);
};
