import crypto from "node:crypto";
import { signAppsScriptFetchRequest } from "./apps-script-auth.mjs";

const text = (value) => String(value ?? "").trim();
const DEFAULT_MAX_RESPONSE_BYTES = 3 * 1024 * 1024;

function assertHttpsUrl(value, label) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${label} must be a valid URL`); }
  if (parsed.protocol !== "https:") throw new Error(`${label} must use HTTPS`);
  return parsed.toString();
}

async function responseTextWithinLimit(response, maxBytes) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("apps_script_response_too_large");
  if (!response.body) return "";
  const reader = response.body.getReader(); const chunks = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); throw new Error("apps_script_response_too_large"); }
    chunks.push(value);
  }
  const joined = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(joined);
}

function normalizeEnvelope(payload, request, maxBytes) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("apps_script_malformed_response");
  if (payload.ok !== true) throw new Error(`apps_script_fetch_failed:${text(payload.fetch_error || payload.error || "unknown")}`);
  if (text(payload.product_id) !== text(request.product_id)) throw new Error("apps_script_product_id_mismatch");
  if (text(payload.requested_url) !== text(request.product_url)) throw new Error("apps_script_requested_url_mismatch");
  if (text(payload.request_id) !== text(request.request_id)) throw new Error("apps_script_request_id_mismatch");
  if (typeof payload.html !== "string" || !Number.isInteger(Number(payload.http_status))) throw new Error("apps_script_malformed_response");
  const responseSize = Buffer.byteLength(payload.html, "utf8");
  if (responseSize > maxBytes) throw new Error("apps_script_html_too_large");
  const finalUrl = assertHttpsUrl(payload.final_url || request.product_url, "Apps Script final_url");
  return {
    httpStatus: Number(payload.http_status), finalUrl, redirected: payload.redirected === true,
    headers: payload.headers && typeof payload.headers === "object" && !Array.isArray(payload.headers) ? payload.headers : {},
    html: payload.html, responseSize, fetchedAt: text(payload.fetched_at), fetchProvider: "apps_script_fallback",
  };
}

export function createAppsScriptFetchProvider({ endpoint, secret, fetchImpl = fetch, timeoutMs = 25_000, maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES, now = () => Date.now(), requestId = () => crypto.randomUUID() } = {}) {
  const endpointUrl = assertHttpsUrl(endpoint, "Apps Script endpoint");
  if (!text(secret)) throw new Error("APPS_SCRIPT_PRICE_FETCH_SECRET is required");
  return async function fetchViaAppsScript(product) {
    const request = { product_id: text(product?.product_id ?? product?.id), product_url: assertHttpsUrl(product?.product_url, "Product URL"), timestamp: now(), request_id: requestId() };
    if (!request.product_id) throw new Error("product_id is required");
    request.signature = signAppsScriptFetchRequest(request, secret);
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpointUrl, { method: "POST", redirect: "follow", signal: controller.signal, headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(request) });
      if (!response.ok) throw new Error(`apps_script_http_${response.status}`);
      const body = await responseTextWithinLimit(response, maxResponseBytes);
      let payload;
      try { payload = JSON.parse(body); } catch { throw new Error("apps_script_malformed_response"); }
      return normalizeEnvelope(payload, request, maxResponseBytes);
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("apps_script_timeout");
      throw error;
    } finally { clearTimeout(timer); }
  };
}

export { DEFAULT_MAX_RESPONSE_BYTES };
