import crypto from "node:crypto";

const text = (value) => String(value ?? "").trim();

export function canonicalAppsScriptFetchRequest({ product_id, product_url, timestamp, request_id } = {}) {
  return [timestamp, request_id, product_id, product_url].map(text).join("\n");
}

export function signAppsScriptFetchRequest(request, secret) {
  if (!text(secret)) throw new Error("Apps Script fetch secret is required");
  return crypto.createHmac("sha256", secret).update(canonicalAppsScriptFetchRequest(request)).digest("base64url");
}

export function verifyAppsScriptFetchRequest(request, secret, { now = Date.now(), maxAgeMs = 5 * 60_000 } = {}) {
  const timestamp = Number(request?.timestamp);
  if (!text(request?.product_id) || !text(request?.product_url) || !text(request?.request_id)) return { valid: false, reason: "missing_required_field" };
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > maxAgeMs) return { valid: false, reason: "expired_timestamp" };
  const supplied = text(request?.signature); const expected = signAppsScriptFetchRequest(request, secret);
  const suppliedBuffer = Buffer.from(supplied); const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) return { valid: false, reason: "invalid_signature" };
  return { valid: true, reason: null };
}
