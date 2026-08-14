const encoder = new TextEncoder();
const COOKIE = "bulgaritam_admin_session";
const MAX_AGE = 60 * 60 * 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

const bytesToBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const base64ToBytes = (value: string) =>
  Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (char) => char.charCodeAt(0));

async function hmac(value: string) {
  const secret = import.meta.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export async function signServerPayload(value: string) { return hmac(value); }

export async function createSession() {
  const csrf = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({ exp: Date.now() + MAX_AGE * 1000, csrf })));
  return { value: `${payload}.${await hmac(payload)}`, csrf };
}

export async function readSession(value?: string) {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || (await hmac(payload)) !== signature) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(base64ToBytes(payload)));
    return data.exp > Date.now() && typeof data.csrf === "string" ? data : null;
  } catch { return null; }
}

export async function verifyPassword(password: string) {
  const stored = import.meta.env.ADMIN_PASSWORD_HASH || "";
  const [scheme, iterationsText, saltText, hashText] = stored.split("$");
  if (scheme !== "pbkdf2-sha256" || !iterationsText || !saltText || !hashText) return false;
  const iterations = Number(iterationsText);
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const actual = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: base64ToBytes(saltText), iterations }, key, 256
  ));
  const expected = base64ToBytes(hashText);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  actual.forEach((byte, index) => { difference |= byte ^ expected[index]; });
  return difference === 0;
}

export function checkLoginRateLimit(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) { attempts.set(key, { count: 0, resetAt: now + 15 * 60_000 }); return true; }
  return current.count < 5;
}

export function recordLoginFailure(key: string) {
  const current = attempts.get(key) || { count: 0, resetAt: Date.now() + 15 * 60_000 };
  attempts.set(key, { ...current, count: current.count + 1 });
}

export function clearLoginFailures(key: string) { attempts.delete(key); }

export const sessionCookie = {
  name: COOKIE,
  options: { httpOnly: true, secure: import.meta.env.PROD, sameSite: "strict" as const, path: "/", maxAge: MAX_AGE },
};
