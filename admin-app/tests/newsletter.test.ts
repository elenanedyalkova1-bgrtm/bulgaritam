import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

process.env.RESEND_API_KEY = "mock-resend";
delete process.env.BASEROW_API_TOKEN;
const { POST, OPTIONS } = await import("../src/pages/api/newsletter");
const originalFetch = globalThis.fetch;
const originalError = console.error;
const errors: unknown[][] = [];
console.error = (...args) => { errors.push(args); };
after(() => { globalThis.fetch = originalFetch; console.error = originalError; });
let sequence = 0;
let mode = "ok";
let release: (() => void) | undefined;
const calls: { body: any; raw: string; key: string }[] = [];
const payload = (extra: Record<string, unknown> = {}) => ({ name: "Mock subscriber", email: `mock-${sequence++}@example.com`, discounts_opt_in: true, new_finds_opt_in: false, brand_insights_opt_in: false, ...extra });
const invoke = (data: unknown, ip = `mock-ip-${sequence++}`, origin = "https://bulgaritam.bg", referer = "https://bulgaritam.bg/namaleniya/?private=value#fragment") => POST({
  request: new Request("https://admin.bulgaritam.bg/api/newsletter/", { method: "POST", headers: { origin, referer, "Content-Type": "application/json" }, body: JSON.stringify(data) }), clientAddress: ip,
} as any);
globalThis.fetch = async (url, init = {}) => {
  assert.equal(String(url), "https://api.resend.com/emails", "Only the internal Resend notification is allowed");
  const raw = String(init.body);
  calls.push({ body: JSON.parse(raw), raw, key: new Headers(init.headers).get("Idempotency-Key")! });
  assert.ok(init.signal, "Provider request must have a timeout");
  if (mode === "slow") await new Promise<void>(resolve => { release = resolve; });
  if (mode === "network") throw new Error("Private provider detail subscriber@example.com");
  if (mode === "timeout") throw new DOMException("Private timeout subscriber@example.com", "TimeoutError");
  if (mode === "reject") return Response.json({ message: "Private provider detail subscriber@example.com" }, { status: 429 });
  if (mode === "no-id") return Response.json({}, { status: 200 });
  if (mode === "malformed") return new Response("not json", { status: 200 });
  return Response.json({ id: `mock-email-${calls.length}` });
};

test("accepts only after Resend confirms an ID, preserves identity, topics, consent, time and safe source", async () => {
  const data = payload({ name: "Mock <script>", new_finds_opt_in: true });
  const response = await invoke(data);
  assert.equal(response.status, 202);
  const result = await response.json();
  assert.equal(result.accepted, true);
  assert.equal(result.notification_status, "sent");
  assert.ok(result.submission_id);
  const sent = calls.at(-1)!.body;
  assert.deepEqual(sent.to, ["info@bulgaritam.bg"]);
  assert.equal(sent.from, "Bulgaritam <applications@bulgaritam.bg>");
  assert.equal(sent.reply_to, data.email);
  assert.ok(sent.text.includes(data.email));
  assert.ok(sent.text.includes(data.name));
  assert.match(sent.text, /Подадено на \(UTC\):\n\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/);
  assert.ok(sent.text.includes("https://bulgaritam.bg/namaleniya/"));
  assert.equal(sent.text.includes("private=value"), false);
  assert.equal(sent.text.includes("fragment"), false);
  assert.ok(sent.text.includes("Отстъпки:\nДа"));
  assert.ok(sent.text.includes("Нови български находки:\nДа"));
  assert.ok(sent.text.includes("От брандовете:\nНе"));
  assert.ok(sent.text.includes("Съгласие:"));
  assert.ok(sent.text.includes("само до темите с „Да“"));
  assert.ok(sent.html.includes("&lt;script&gt;"));
  assert.equal(sent.html.includes("<script>"), false);
});

for (const failure of ["reject", "network", "timeout", "no-id", "malformed"]) {
  test(`${failure} never returns success; retry preserves exact body, timestamp and provider idempotency key`, async () => {
    mode = failure;
    const data = payload();
    const response = await invoke(data);
    assert.equal(response.status, 503);
    const result = await response.json();
    assert.notEqual(result.accepted, true);
    assert.equal(result.code, "notification_unavailable");
    assert.equal(JSON.stringify(result).includes("subscriber@example.com"), false);
    const sent = calls.at(-1)!;
    mode = "ok";
    assert.equal((await invoke(data)).status, 202);
    assert.equal(calls.at(-1)!.key, sent.key);
    assert.equal(calls.at(-1)!.raw, sent.raw);
  });
}

test("accepted repeats are not re-sent and email normalization preserves deduplication", async () => {
  const data = payload();
  await invoke(data);
  const before = calls.length;
  assert.equal((await invoke({ ...data, email: ` ${data.email.toUpperCase()} ` })).status, 202);
  assert.equal(calls.length, before);
});

test("concurrent clicks share one provider request", async () => {
  mode = "slow";
  release = undefined;
  const data = payload();
  const before = calls.length;
  const first = invoke(data);
  while (!release) await new Promise(resolve => setTimeout(resolve, 1));
  const second = invoke(data);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(calls.length, before + 1);
  release!();
  assert.ok((await Promise.all([first, second])).every(response => response.status === 202));
  mode = "ok";
});

test("changed consent selections are preserved as a separate notification", async () => {
  const data = payload();
  await invoke(data);
  const before = calls.length;
  await invoke({ ...data, discounts_opt_in: false, brand_insights_opt_in: true });
  assert.equal(calls.length, before + 1);
  assert.ok(calls.at(-1)!.body.text.includes("Отстъпки:\nНе"));
  assert.ok(calls.at(-1)!.body.text.includes("От брандовете:\nДа"));
});

for (const invalid of [null, [], { name: "", email: "mock@example.com", discounts_opt_in: true },
  { name: "Mock", email: "bad", discounts_opt_in: true },
  { name: "Mock", email: "mock@example.com", discounts_opt_in: "true" },
  { name: "Mock", email: "mock@example.com" },
  { name: "Mock", email: "mock@example.com", discounts_opt_in: true, company: "bot" }]) {
  test(`invalid payload ${JSON.stringify(invalid)} is rejected without provider requests`, async () => {
    const before = calls.length;
    assert.equal((await invoke(invalid)).status, 400);
    assert.equal(calls.length, before);
  });
}

test("malformed and oversized JSON are rejected", async () => {
  for (const body of ["{broken", "x".repeat(8001)]) {
    const response = await POST({ request: new Request("https://admin.bulgaritam.bg/api/newsletter/", { method: "POST", headers: { origin: "https://bulgaritam.bg" }, body }) } as any);
    assert.equal(response.status, 400);
  }
});

test("CORS allows existing public origins and rejects untrusted origins without sending", async () => {
  for (const origin of ["https://bulgaritam.bg", "https://www.bulgaritam.bg"]) {
    const response = await OPTIONS({ request: new Request("https://admin.bulgaritam.bg/api/newsletter/", { headers: { origin } }) } as any);
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  }
  const before = calls.length;
  assert.equal((await invoke(payload(), undefined, "https://untrusted.invalid")).status, 403);
  assert.equal(calls.length, before);
});

test("preserves five attempts per IP per ten minutes", async () => {
  const ip = `limited-${sequence++}`;
  const first = payload();
  await invoke(first, ip);
  for (let i = 0; i < 4; i++) assert.equal((await invoke(payload(), ip)).status, 202);
  const before = calls.length;
  assert.equal((await invoke(payload(), ip)).status, 429);
  assert.equal(calls.length, before);
  assert.equal((await invoke(first, ip)).status, 202, "Already accepted repeat remains successful without re-sending");
});

test("missing Resend configuration returns an actionable error", async () => {
  delete process.env.RESEND_API_KEY;
  try { assert.equal((await invoke(payload())).status, 503); }
  finally { process.env.RESEND_API_KEY = "mock-resend"; }
});

test("does not trust external Referer or expose provider payloads in logs", async () => {
  await invoke(payload(), undefined, undefined, "https://untrusted.invalid/private");
  assert.ok(calls.at(-1)!.body.text.includes("Не е предоставена"));
  assert.equal(calls.at(-1)!.body.text.includes("untrusted.invalid"), false);
  assert.equal(JSON.stringify(errors).includes("subscriber@example.com"), false);
});

// Exercise the existing public frontend directly: no frontend source change or deployment.
test("existing frontend keeps entered values after API failure and requires accepted=true", async () => {
  const source = readFileSync(new URL("../../src/layouts/BaseLayout.astro", import.meta.url), "utf8");
  const script = source.match(/<script is:inline define:vars=\{\{ newsletterEndpoint, suppressNewsletterAutoOpen \}\}>([\s\S]*?)<\/script>/)![1];
  for (const reply of [{ ok: false, accepted: false }, { ok: true, accepted: false }, { ok: true, accepted: true }]) {
    let resets = 0;
    const element = () => ({ handlers: {} as Record<string, Function>, addEventListener(n: string, f: Function) { this.handlers[n] = f; }, classList: { add() {}, remove() {} }, focus() {}, hidden: false, textContent: "" });
    const email = { ...element(), value: "mock@example.com" };
    const preferences = [true, false, false].map(checked => ({ ...element(), checked, setCustomValidity() {} }));
    const submit = { ...element(), disabled: false }, status = element();
    const form = { ...element(), querySelectorAll: () => preferences, querySelector: (s: string) => s.includes("submit") ? submit : status, reportValidity: () => true, reset() { resets++; email.value = ""; } };
    const modal = { ...element(), querySelector: (s: string) => s === "form" ? form : email, querySelectorAll: () => [], removeAttribute() {}, setAttribute() {} };
    runInNewContext(script, { document: { getElementById: () => modal, activeElement: element(), documentElement: { classList: { add() {}, remove() {} } }, querySelectorAll: () => [], addEventListener() {} },
      sessionStorage: { getItem() {}, setItem() {} }, newsletterEndpoint: "https://test.invalid/newsletter/", suppressNewsletterAutoOpen: true,
      window: { clearTimeout() {}, setTimeout() {} }, FormData: class { get(k: string) { return k === "name" ? "Mock" : email.value; } has(k: string) { return k === "preference_discounts"; } },
      fetch: async () => ({ ok: reply.ok, json: async () => ({ accepted: reply.accepted, error: "Mock retry error" }) }),
    });
    await form.handlers.submit({ preventDefault() {} });
    assert.equal(resets, reply.ok && reply.accepted ? 1 : 0);
    assert.equal(email.value, reply.ok && reply.accepted ? "" : "mock@example.com");
    assert.equal(submit.disabled, false);
  }
});
