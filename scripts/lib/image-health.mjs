const permanentClientErrors = new Set([400, 405, 414, 415, 422]);
const clean = (value) => String(value ?? "").trim();

// Inspect a bounded prefix, including when an origin ignores the Range header.
async function readPrefix(response, limit = 8192) {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (length < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, limit - length);
      chunks.push(chunk);
      length += chunk.length;
    }
  } finally {
    await reader.cancel();
  }
  const prefix = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    prefix.set(chunk, offset);
    offset += chunk.length;
  }
  return prefix;
}

function hasImageSignature(bytes, text) {
  const hex = Buffer.from(bytes).toString("hex");
  return hex.startsWith("ffd8ff") || // JPEG
    hex.startsWith("89504e470d0a1a0a") || // PNG
    /^(474946383761|474946383961)/.test(hex) || // GIF
    (hex.startsWith("52494646") && hex.slice(16, 24) === "57454250") || // WebP
    (hex.slice(8, 16) === "66747970" && /(?:avif|avis|heic|heix|hevc|hevx|mif1|msf1)/.test(text.slice(8, 64))) ||
    /^(424d|49492a00|4d4d002a|00000100|ff0a|0000000c4a584c200d0a870a)/.test(hex) ||
    /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/i.test(text);
}

function isChallenge(text, headers) {
  return headers?.get("cf-mitigated") === "challenge" || Boolean(headers?.get("x-sucuri-block")) ||
    /<title[^>]*>\s*(?:just a moment|attention required|access denied|security check|please wait|checking your browser)/i.test(text) ||
    /(?:__cf_chl|cf-chl-|\/cdn-cgi\/challenge-platform\/|verify (?:that )?you are (?:a )?human|checking your browser before|enable javascript and cookies to continue|ddos protection by|sgcaptcha|sucuri_cloudproxy_js|challenge-form)/i.test(text);
}

export function classifyImageResponse({ status, contentType = "", bytes = new Uint8Array(), headers }) {
  contentType = contentType.toLowerCase();
  const text = new TextDecoder().decode(bytes);
  const validImageBytes = hasImageSignature(bytes, text);
  const evidence = { valid_image_bytes: validImageBytes, bytes_inspected: bytes.length };
  // A successful transport or repeated response is not proof that an image is gone.
  if (status === 202) return { state: "inconclusive", reason: "http_202", ...evidence };
  if (isChallenge(text, headers)) return { state: "inconclusive", reason: "challenge_response", ...evidence };
  if (headers?.get("retry-after") || /<title[^>]*>[^<]*(?:temporarily unavailable|service unavailable|maintenance|please try again)/i.test(text)) {
    return { state: "inconclusive", reason: "temporary_response", ...evidence };
  }
  if (status === 404 || status === 410) return { state: "gone", ...evidence };
  if (permanentClientErrors.has(status)) return { state: "http_error", ...evidence };
  if (status !== 200 && status !== 206) return { state: "inconclusive", reason: `http_${status}`, ...evidence };
  if (contentType.startsWith("image/") && validImageBytes) return { state: "ok", ...evidence };
  if (!bytes.length) return { state: "inconclusive", reason: "empty_response", ...evidence };
  // Unknown image formats or MIME mismatches cannot prove a permanent failure.
  if (validImageBytes || (contentType.startsWith("image/") && !/^\s*</.test(text))) {
    return { state: "inconclusive", reason: "unverified_image_response", ...evidence };
  }
  return { state: "not_image", ...evidence };
}

export async function probeImage(url, { headers = {}, fetchImpl = fetch, timeoutMs = 12_000 } = {}) {
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Invalid image URL");
  } catch {
    return { status: 0, state: "invalid_url", finalUrl: url, valid_image_bytes: null, bytes_inspected: 0 };
  }
  try {
    // The deadline covers the body prefix as well as response headers.
    const response = await fetchImpl(url, {
      headers: { ...headers, Range: "bytes=0-2047" }, redirect: "follow", signal: AbortSignal.timeout(timeoutMs),
    });
    const contentType = clean(response.headers.get("content-type")).toLowerCase();
    const bytes = await readPrefix(response);
    return {
      status: response.status, finalUrl: response.url || url, contentType,
      ...classifyImageResponse({ status: response.status, contentType, bytes, headers: response.headers }),
    };
  } catch (error) {
    return {
      status: 0, state: ["AbortError", "TimeoutError"].includes(error?.name) ? "timeout" : "network_error",
      finalUrl: url, error: clean(error?.message), valid_image_bytes: null, bytes_inspected: 0,
    };
  }
}

export async function confirmImageHealth(url, initial, probe) {
  const result = (classification, attempts, reason) => ({
    classification, confirmed: classification === "confirmed_broken", attempts, reason,
  });
  if (!url || initial.state === "invalid_url") {
    return result("confirmed_broken", [initial], !url ? "missing" : "invalid_url");
  }
  if (initial.state === "ok") return result("valid", [initial], "ok");
  const permanentClientError = initial.state === "http_error" && permanentClientErrors.has(initial.status);
  if (!["gone", "not_image"].includes(initial.state) && !permanentClientError) {
    return result("inconclusive", [initial], initial.reason || initial.state);
  }
  const attempts = [initial];
  for (let i = 1; i < 3; i += 1) attempts.push(await probe(url));
  const confirmed = attempts.every((item) => item.state === initial.state &&
    (!permanentClientError || item.status === initial.status));
  return result(confirmed ? "confirmed_broken" : "inconclusive", attempts,
    confirmed ? initial.state : "inconsistent_response");
}
