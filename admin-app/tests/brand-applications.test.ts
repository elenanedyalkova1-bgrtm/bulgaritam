import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// No real credentials or requests: Baserow must never be contacted.
delete process.env.BASEROW_API_TOKEN;
process.env.RESEND_API_KEY = "mock-resend";
const { POST, OPTIONS } = await import("../src/pages/api/brand-applications");
const originalFetch = globalThis.fetch;
const originalError = console.error;
const errors: unknown[][] = [];
console.error = (...args) => { errors.push(args); };
let sequence = 0;
const payload = (extra: Record<string, unknown> = {}) => ({
  started_at: Date.now() - 3000, company: "", brand_name: `Mock ${sequence++}`,
  contact_name: "Mock contact", email: "mock@example.com", phone: "mock-phone",
  website: "example.com", instagram: "instagram.com/mock", facebook: "facebook.com/mock",
  physical_address: "Mock address", delivers_outside_bulgaria: "Да",
  brand_story: "Mock story <script>", own_contribution: ["Разработка", "Друг съществен принос"],
  own_contribution_other: "Mock contribution", consent: true, monthly_email: true,
  optional_consent: true, founder_start_year: "2020", founder_start_budget: "До €250",
  founder_first_order_time: "Mock first order time", founder_first_order_channel: "Mock first channel",
  founder_current_channel: "Mock current channel", founder_marketing_budget: "До €50",
  founder_advice: "Mock advice", founder_hardest_part: "Mock difficulty",
  supplier_recommendations: [{ name: "Mock supplier", type: "Печат", reason: "Mock reason" }], ...extra,
});
const invoke = (data: unknown, ip = `mock-ip-${sequence++}`, origin = "https://bulgaritam.bg") => POST({
  request: new Request("https://admin.bulgaritam.bg/api/brand-applications/", {
    method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(data),
  }), clientAddress: ip,
} as any);
const calls: { url: string; body: any; key: string }[] = [];
let mode: "ok" | "reject" | "network" | "timeout" | "no-id" | "malformed" | "slow" = "ok";
let release: (() => void) | undefined;
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  assert.equal(url, "https://api.resend.com/emails", "Only Resend may be contacted");
  calls.push({ url, body: JSON.parse(String(init.body)), key: new Headers(init.headers).get("Idempotency-Key")! });
  assert.ok(init.signal, "Request must have a timeout");
  if (mode === "slow") await new Promise<void>(resolve => { release = resolve; });
  if (mode === "network") throw new Error("Mock transport failure");
  if (mode === "timeout") throw new DOMException("Mock timeout", "TimeoutError");
  if (mode === "reject") return Response.json({ message: "Private provider detail" }, { status: 429 });
  if (mode === "no-id") return Response.json({}, { status: 200 });
  if (mode === "malformed") return new Response("not json", { status: 200 });
  return Response.json({ id: `mock-email-${calls.length}` });
};
try {
  const full = payload();
  const response = await invoke(full);
  assert.equal(response.status, 202);
  const result = await response.json();
  assert.equal(result.accepted, true);
  assert.equal(result.notification_status, "sent");
  assert.equal(result.newsletter_status, "manual_follow_up");
  assert.equal(calls.length, 1);
  const sent = calls[0].body;
  assert.deepEqual(sent.to, ["info@bulgaritam.bg"]);
  assert.equal(sent.from, "Bulgaritam <applications@bulgaritam.bg>");
  assert.equal(sent.reply_to, full.email);
  for (const value of [full.brand_name, full.contact_name, full.email, full.phone, full.brand_story,
    full.physical_address, full.own_contribution_other, full.founder_start_year, full.founder_start_budget,
    full.founder_first_order_time, full.founder_first_order_channel, full.founder_current_channel,
    full.founder_marketing_budget, full.founder_advice, full.founder_hardest_part,
    "https://example.com", "https://instagram.com/mock", "https://facebook.com/mock",
    "Mock supplier", "Печат", "Mock reason", "Да — заявка за ръчно добавяне",
    "Съгласие за обработка и контакт:\nДа", "Съгласие за допълнителните отговори:\nДа"]) {
    assert.ok(sent.text.includes(value), `Email must preserve ${value}`);
  }
  assert.ok(sent.html.includes("&lt;script&gt;"));
  assert.equal(sent.html.includes("<script>"), false);
  assert.ok(sent.html.includes("<table"));
  const count = calls.length;
  const repeated = await invoke(full);
  assert.equal(repeated.status, 202);
  assert.equal(calls.length, count, "Already accepted submission is not resent");

  for (const failure of ["reject", "network", "timeout", "no-id", "malformed"] as const) {
    mode = failure;
    const data = payload();
    const failed = await invoke(data);
    assert.equal(failed.status, 503, failure);
    const error = await failed.json();
    assert.notEqual(error.accepted, true, failure);
    assert.equal(error.code, "notification_unavailable");
    const first = calls.at(-1)!;
    mode = "ok";
    const retried = await invoke(data);
    assert.equal(retried.status, 202, "Failed emails remain retryable");
    assert.equal(calls.at(-1)!.key, first.key, "Retry has same Resend idempotency key");
    assert.deepEqual(calls.at(-1)!.body, first.body, "Retry has identical Resend body");
  }

  mode = "slow";
  const concurrentData = payload();
  const beforeConcurrent = calls.length;
  const first = invoke(concurrentData);
  while (!release) await new Promise(resolve => setTimeout(resolve, 1));
  const second = invoke(concurrentData);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(calls.length, beforeConcurrent + 1);
  release!();
  const paired = await Promise.all([first, second]);
  assert.ok(paired.every(response => response.status === 202));
  mode = "ok";

  const changed = { ...full, phone: "changed-phone", founder_advice: "Changed advice" };
  await invoke(changed);
  assert.notEqual(calls.at(-1)!.key, calls[0].key, "Different contact/optional data is not suppressed");

  for (const extra of [{ consent: false }, { optional_consent: false }, { company: "bot" },
    { website: "", instagram: "", facebook: "" }, { facebook: "https://" },
    { started_at: Date.now() }, { started_at: Date.now() - 86401000 }, { own_contribution: [] }]) {
    const count = calls.length;
    assert.equal((await invoke(payload(extra))).status, 400);
    assert.equal(calls.length, count, "Invalid input must not send email");
  }
  assert.equal((await invoke(null)).status, 400);
  assert.equal((await invoke(payload(), undefined, "https://invalid.example")).status, 403);
  const options = await OPTIONS({ request: new Request("https://admin.bulgaritam.bg/api/brand-applications/", {
    method: "OPTIONS", headers: { origin: "https://bulgaritam.bg" },
  }) } as any);
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("Access-Control-Allow-Origin"), "https://bulgaritam.bg");
  for (const key of ["website", "instagram", "facebook"]) {
    const presence = { website: "", instagram: "", facebook: "", [key]: "example.com" };
    assert.equal((await invoke(payload(presence))).status, 202);
  }
  for (let i = 0; i < 3; i++) assert.equal((await invoke(payload(), "one-rate-limit-ip")).status, 202);
  const countBeforeLimit = calls.length;
  assert.equal((await invoke(payload(), "one-rate-limit-ip")).status, 429);
  assert.equal(calls.length, countBeforeLimit);

  delete process.env.RESEND_API_KEY;
  const callsBeforeMissingKey = calls.length;
  assert.equal((await invoke(payload())).status, 503);
  assert.equal(calls.length, callsBeforeMissingKey);
  process.env.RESEND_API_KEY = "mock-resend";

  const source = await readFile(new URL("../src/pages/api/brand-applications.ts", import.meta.url), "utf8");
  assert.equal(/baserowUrl|baserowRequest|createBaserowRow|updateBaserowRow|APPLICATIONS_TABLE/.test(source), false);
  for (const args of errors) {
    const text = args.join(" ");
    assert.equal(/mock@example|Mock contact|Mock story|Private provider detail/.test(text), false);
  }
  console.log("PASS: email-only success/failure, full fields, retry/idempotency, concurrent clicks, spam protection, zero Baserow requests.");
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalError;
}
