import crypto from "node:crypto";

export const PRICE_HISTORY_TAB = "Price History";
export const PRICES_TAB = "Prices";
export const PRICE_TIMELINE_TAB = "Price Timeline";
export const PRICE_HISTORY_HEADERS = [
  "checked_at", "product_id", "product_name", "brand", "product_url", "detected_price", "currency", "status",
  "extraction_method", "confidence", "previous_verified_price", "difference", "observation_id",
  "regular_price", "regular_price_currency", "regular_price_method", "regular_price_evidence",
];
export const PRICES_HEADERS = [
  "product_id", "product_name", "brand", "product_url", "current_detected_price", "previous_detected_price", "difference",
  "currency", "last_checked_at", "status", "extraction_method", "confidence", "Copy price",
];

const text = (value) => String(value ?? "").trim();
const finite = (value) => {
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const positiveFinite = (value) => {
  const parsed = finite(value);
  return parsed != null && parsed > 0 ? parsed : null;
};
const selectValue = (value) => text(value && typeof value === "object" ? value.value : value);
const base64url = (value) => Buffer.from(value).toString("base64url");

export function observationId(result) {
  const stable = [result.product_id, result.checked_at, result.product_url].map(text).join("|");
  if (!text(result.product_id) || !text(result.checked_at)) throw new Error("History observation requires stable product_id and checked_at");
  return crypto.createHash("sha256").update(stable).digest("hex").slice(0, 32);
}

export function historyObservation(result) {
  const detected = positiveFinite(result.detected_price); const previous = positiveFinite(result.previous_offer_price);
  const regular = positiveFinite(result.regular_price);
  const currency = text(result.currency).toUpperCase(); const regularCurrency = text(result.regular_price_currency).toUpperCase();
  const validRegular = detected != null && regular != null && regular > detected && currency && regularCurrency === currency;
  const comparable = detected != null && previous != null && !result.currency_mismatch;
  return {
    checked_at: text(result.checked_at), product_id: text(result.product_id), product_name: text(result.product_name), brand: text(result.brand_name),
    product_url: text(result.product_url), detected_price: detected, currency, status: selectValue(result.status),
    extraction_method: text(result.extraction_method), confidence: selectValue(result.confidence), previous_verified_price: previous,
    difference: comparable ? Math.round((detected - previous) * 10_000) / 10_000 : null, observation_id: observationId(result),
    regular_price: validRegular ? regular : null,
    regular_price_currency: validRegular ? regularCurrency : "",
    regular_price_method: validRegular ? text(result.regular_price_method) : "",
    regular_price_evidence: validRegular && result.regular_price_evidence != null
      ? (typeof result.regular_price_evidence === "string" ? result.regular_price_evidence : JSON.stringify(result.regular_price_evidence))
      : "",
  };
}

export function observationRow(observation) {
  return PRICE_HISTORY_HEADERS.map((header) => observation[header] ?? "");
}

export function isReliableDetectedObservation(observation) {
  return positiveFinite(observation.detected_price) != null
    && ["high", "medium"].includes(selectValue(observation.confidence))
    && ["verified", "changed", "redirected"].includes(selectValue(observation.status));
}

export function derivePrices(history) {
  const groups = new Map();
  for (const raw of history) {
    const row = Array.isArray(raw) ? Object.fromEntries(PRICE_HISTORY_HEADERS.map((header, index) => [header, raw[index] ?? ""])) : raw;
    const id = text(row.product_id); if (!id) continue;
    if (!groups.has(id)) groups.set(id, []); groups.get(id).push(row);
  }
  return [...groups.entries()].map(([product_id, rows]) => {
    rows.sort((a, b) => Date.parse(text(b.checked_at)) - Date.parse(text(a.checked_at)));
    const latest = rows[0]; const reliable = rows.filter(isReliableDetectedObservation);
    const current = reliable[0] || null; const previous = reliable[1] || null;
    const currentPrice = positiveFinite(current?.detected_price); const previousPrice = positiveFinite(previous?.detected_price);
    return {
      product_id, product_name: text(latest.product_name), brand: text(latest.brand), product_url: text(latest.product_url),
      current_detected_price: currentPrice, previous_detected_price: previousPrice,
      difference: currentPrice != null && previousPrice != null ? Math.round((currentPrice - previousPrice) * 10_000) / 10_000 : null,
      currency: text(current?.currency), last_checked_at: text(latest.checked_at), status: selectValue(latest.status),
      extraction_method: text(current?.extraction_method), confidence: selectValue(current?.confidence), copy_price: currentPrice,
    };
  }).sort((a, b) => a.product_name.localeCompare(b.product_name, "bg") || a.product_id.localeCompare(b.product_id));
}

export function deriveTimeline(history) {
  const prices = derivePrices(history); const names = new Map(prices.map((row) => [row.product_id, row])); const periods = new Set(); const values = new Map();
  for (const raw of history) {
    const row = Array.isArray(raw) ? Object.fromEntries(PRICE_HISTORY_HEADERS.map((header, index) => [header, raw[index] ?? ""])) : raw;
    if (!isReliableDetectedObservation(row)) continue;
    const date = text(row.checked_at).slice(0, 10); if (!date || !names.has(text(row.product_id))) continue;
    periods.add(date); const key = `${text(row.product_id)}|${date}`;
    const existing = values.get(key); if (!existing || Date.parse(text(row.checked_at)) > Date.parse(text(existing.checked_at))) values.set(key, row);
  }
  const columns = [...periods].sort();
  return { periods: columns, rows: prices.map((product) => ({ product_id: product.product_id, product: product.product_name, brand: product.brand, values: Object.fromEntries(columns.map((date) => [date, positiveFinite(values.get(`${product.product_id}|${date}`)?.detected_price)])) })) };
}

export const DERIVED_SHEET_FORMULAS = Object.freeze({
  prices: {
    A2: `=SORT(UNIQUE(FILTER('${PRICE_HISTORY_TAB}'!B2:B,'${PRICE_HISTORY_TAB}'!B2:B<>"")))`,
    B2: `=MAP(A2:A,LAMBDA(id,IF(id="","",IFERROR(INDEX(SORT(FILTER({'${PRICE_HISTORY_TAB}'!A$2:A,'${PRICE_HISTORY_TAB}'!C$2:C},'${PRICE_HISTORY_TAB}'!B$2:B=id),1,FALSE),1,2),""))))`,
    C2: `=MAP(A2:A,LAMBDA(id,IF(id="","",IFERROR(INDEX(SORT(FILTER({'${PRICE_HISTORY_TAB}'!A$2:A,'${PRICE_HISTORY_TAB}'!D$2:D},'${PRICE_HISTORY_TAB}'!B$2:B=id),1,FALSE),1,2),""))))`,
    D2: `=MAP(A2:A,LAMBDA(id,IF(id="","",IFERROR(INDEX(SORT(FILTER({'${PRICE_HISTORY_TAB}'!A$2:A,'${PRICE_HISTORY_TAB}'!E$2:E},'${PRICE_HISTORY_TAB}'!B$2:B=id),1,FALSE),1,2),""))))`,
    E2: `=MAP(A2:A,LAMBDA(id,IF(id="","",IFERROR(INDEX(SORT(FILTER({'${PRICE_HISTORY_TAB}'!A$2:A,'${PRICE_HISTORY_TAB}'!F$2:F},'${PRICE_HISTORY_TAB}'!B$2:B=id,'${PRICE_HISTORY_TAB}'!F$2:F>0,REGEXMATCH('${PRICE_HISTORY_TAB}'!J$2:J,"^(high|medium)$"),REGEXMATCH('${PRICE_HISTORY_TAB}'!H$2:H,"^(verified|changed|redirected)$")),1,FALSE),1,2),""))))`,
    F2: `=MAP(A2:A,LAMBDA(id,IF(id="","",IFERROR(INDEX(SORT(FILTER({'${PRICE_HISTORY_TAB}'!A$2:A,'${PRICE_HISTORY_TAB}'!F$2:F},'${PRICE_HISTORY_TAB}'!B$2:B=id,'${PRICE_HISTORY_TAB}'!F$2:F>0,REGEXMATCH('${PRICE_HISTORY_TAB}'!J$2:J,"^(high|medium)$"),REGEXMATCH('${PRICE_HISTORY_TAB}'!H$2:H,"^(verified|changed|redirected)$")),1,FALSE),2,2),""))))`,
    G2: `=ARRAYFORMULA(IF(A2:A="","",IF((E2:E="")+(F2:F=""),"",E2:E-F2:F)))`,
    H2: `=MAP(A2:A,LAMBDA(id,IF(id="","",IFERROR(INDEX(SORT(FILTER({'${PRICE_HISTORY_TAB}'!A$2:A,'${PRICE_HISTORY_TAB}'!G$2:G},'${PRICE_HISTORY_TAB}'!B$2:B=id,'${PRICE_HISTORY_TAB}'!F$2:F>0,REGEXMATCH('${PRICE_HISTORY_TAB}'!J$2:J,"^(high|medium)$"),REGEXMATCH('${PRICE_HISTORY_TAB}'!H$2:H,"^(verified|changed|redirected)$")),1,FALSE),1,2),""))))`,
    I2: `=MAP(A2:A,LAMBDA(id,IF(id="","",IFERROR(INDEX(SORT(FILTER('${PRICE_HISTORY_TAB}'!A$2:A,'${PRICE_HISTORY_TAB}'!B$2:B=id),1,FALSE),1,1),""))))`,
    J2: `=MAP(A2:A,LAMBDA(id,IF(id="","",IFERROR(INDEX(SORT(FILTER({'${PRICE_HISTORY_TAB}'!A$2:A,'${PRICE_HISTORY_TAB}'!H$2:H},'${PRICE_HISTORY_TAB}'!B$2:B=id),1,FALSE),1,2),""))))`,
    K2: `=MAP(A2:A,LAMBDA(id,IF(id="","",IFERROR(INDEX(SORT(FILTER({'${PRICE_HISTORY_TAB}'!A$2:A,'${PRICE_HISTORY_TAB}'!I$2:I},'${PRICE_HISTORY_TAB}'!B$2:B=id,'${PRICE_HISTORY_TAB}'!F$2:F>0,REGEXMATCH('${PRICE_HISTORY_TAB}'!J$2:J,"^(high|medium)$"),REGEXMATCH('${PRICE_HISTORY_TAB}'!H$2:H,"^(verified|changed|redirected)$")),1,FALSE),1,2),""))))`,
    L2: `=MAP(A2:A,LAMBDA(id,IF(id="","",IFERROR(INDEX(SORT(FILTER({'${PRICE_HISTORY_TAB}'!A$2:A,'${PRICE_HISTORY_TAB}'!J$2:J},'${PRICE_HISTORY_TAB}'!B$2:B=id,'${PRICE_HISTORY_TAB}'!F$2:F>0,REGEXMATCH('${PRICE_HISTORY_TAB}'!J$2:J,"^(high|medium)$"),REGEXMATCH('${PRICE_HISTORY_TAB}'!H$2:H,"^(verified|changed|redirected)$")),1,FALSE),1,2),""))))`,
    M2: `=ARRAYFORMULA(IF(A2:A="","",IF(E2:E="","",E2:E)))`,
  },
  timeline: { A1: `=QUERY({'${PRICE_HISTORY_TAB}'!B2:B,'${PRICE_HISTORY_TAB}'!C2:C,'${PRICE_HISTORY_TAB}'!D2:D,ARRAYFORMULA(IF('${PRICE_HISTORY_TAB}'!A2:A="","",LEFT('${PRICE_HISTORY_TAB}'!A2:A,10))),'${PRICE_HISTORY_TAB}'!F2:F},"select Col1,Col2,Col3,max(Col5) where Col1 is not null and Col5 > 0 group by Col1,Col2,Col3 pivot Col4 label Col1 'product_id', Col2 'Product', Col3 'Brand', max(Col5) ''",0)` },
});

async function serviceAccountToken({ email, privateKey, fetchImpl = fetch }) {
  const now = Math.floor(Date.now() / 1000); const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iss: email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const signer = crypto.createSign("RSA-SHA256"); signer.update(`${header}.${payload}`); const assertion = `${header}.${payload}.${signer.sign(privateKey).toString("base64url")}`;
  const response = await fetchImpl("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const data = await response.json(); if (!response.ok || !data.access_token) throw new Error(`Google authentication failed (${response.status})`); return data.access_token;
}

export function createGoogleSheetsHistory({ spreadsheetId, serviceAccountEmail, privateKey, fetchImpl = fetch, tokenProvider } = {}) {
  if (!spreadsheetId || !serviceAccountEmail || !privateKey) throw new Error("Google Sheets history requires spreadsheet ID, service account email, and private key");
  let cachedToken = null;
  const token = async () => cachedToken ||= await (tokenProvider ? tokenProvider() : serviceAccountToken({ email: serviceAccountEmail, privateKey: privateKey.replace(/\\n/g, "\n"), fetchImpl }));
  const google = async (url, init = {}) => { const response = await fetchImpl(url, { ...init, headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", ...(init.headers || {}) } }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(`Google Sheets request failed (${response.status}): ${JSON.stringify(body).slice(0, 400)}`); return body; };
  const valuesUrl = (range) => `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
  return {
    async append(results) {
      const observations = results.map(historyObservation); const ids = await google(`${valuesUrl(`${PRICE_HISTORY_TAB}!M2:M`)}?majorDimension=COLUMNS`);
      const existing = new Set((ids.values?.[0] || []).map(text)); const fresh = observations.filter((item) => !existing.has(item.observation_id));
      if (!fresh.length) return { appended: 0, duplicates: observations.length, observation_ids: observations.map((item) => item.observation_id) };
      await google(`${valuesUrl(`${PRICE_HISTORY_TAB}!A:Q`)}:append?valueInputOption=RAW&insertDataOption=OVERWRITE`, { method: "POST", body: JSON.stringify({ majorDimension: "ROWS", values: fresh.map(observationRow) }) });
      return { appended: fresh.length, duplicates: observations.length - fresh.length, observation_ids: observations.map((item) => item.observation_id) };
    },
    async metadata() { return google(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties`); },
    async batchUpdate(requests) { return google(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) }); },
    async getValues(range) { return google(`${valuesUrl(range)}?majorDimension=ROWS`); },
    async updateValues(range, values, valueInputOption = "USER_ENTERED") { return google(`${valuesUrl(range)}?valueInputOption=${valueInputOption}`, { method: "PUT", body: JSON.stringify({ majorDimension: "ROWS", values }) }); },
  };
}
