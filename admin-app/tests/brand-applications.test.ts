import assert from "node:assert/strict";

process.env.BASEROW_API_TOKEN = "test-token";
process.env.BASEROW_BRAND_APPLICATIONS_TABLE_ID = "1167849";
process.env.BASEROW_NEWSLETTER_SUBSCRIBERS_TABLE_ID = "1154960";
process.env.RESEND_API_KEY = "test-resend";

const { POST } = await import("../src/pages/api/brand-applications");
const originalFetch = globalThis.fetch;

type Scenario = { monthly: boolean; existing?: boolean; resendFails?: boolean; persistenceFails?: boolean };
let scenarioIndex = 10;
const run = async (name: string, scenario: Scenario) => {
  const calls: Array<{ url: string; method: string; body: any }> = [];
  const applicationRows: any[] = [];
  const newsletterRows: any[] = [];
  let nextApplicationId = 100;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = init.method || "GET";
    const body = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, method, body });
    if (url.includes("/database/rows/table/1167849/") && method === "POST") {
      if (scenario.persistenceFails) return Response.json({ error: "mock" }, { status: 500 });
      const row = { id: nextApplicationId++, ...body };
      applicationRows.push(row);
      return Response.json(row, { status: 200 });
    }
    if (url.includes("/database/rows/table/1167849/") && method === "PATCH") {
      Object.assign(applicationRows[0], body);
      return Response.json(applicationRows[0], { status: 200 });
    }
    if (url.includes("/database/rows/table/1154960/") && method === "GET") {
      return Response.json({ results: scenario.existing ? [{ id: 77, email: `${name}@example.com`, consent_source: "newsletter_popup" }] : [] });
    }
    if (url.includes("/database/rows/table/1154960/") && method === "POST") {
      newsletterRows.push({ id: 88, ...body });
      return Response.json(newsletterRows[0], { status: 200 });
    }
    if (url.includes("/database/rows/table/1154960/") && method === "PATCH") {
      return Response.json({ id: 77, ...body }, { status: 200 });
    }
    if (url.includes("api.resend.com")) {
      return scenario.resendFails ? Response.json({ error: "mock" }, { status: 502 }) : Response.json({ id: `email-${name}` }, { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  };
  const payload = {
    started_at: Date.now() - 3_000, company: "", brand_name: `Test ${name}`, website: "https://example.com",
    instagram: "", physical_address: "Тестов адрес", delivers_outside_bulgaria: "Да",
    brand_story: `История ${name}`, own_contribution: ["Разработка", "Ръчна изработка"], own_contribution_other: "",
    contact_name: "Тест", email: `${name}@example.com`, phone: "", consent: true, monthly_email: scenario.monthly,
    optional_consent: false, supplier_recommendations: [],
  };
  const request = new Request("http://localhost:4321/api/brand-applications/", {
    method: "POST", headers: { Origin: "http://localhost:4321", "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const response = await POST({ request, clientAddress: `127.0.0.${scenarioIndex++}` } as any);
  const result = await response.json();
  return { calls, applicationRows, newsletterRows, response, result };
};

try {
  const a = await run("case-a", { monthly: false });
  assert.equal(a.response.status, 202);
  assert.equal(a.applicationRows[0].monthly_email_opt_in, false);
  assert.equal(a.applicationRows[0].newsletter_sync_status, "not_requested");
  assert.equal(a.newsletterRows.length, 0);
  assert.ok(a.calls.findIndex(x => x.url.includes("1167849") && x.method === "POST") < a.calls.findIndex(x => x.url.includes("api.resend.com")));

  const b = await run("case-b", { monthly: true });
  assert.equal(b.applicationRows[0].monthly_email_opt_in, true);
  assert.equal(b.applicationRows[0].newsletter_sync_status, "subscribed");
  assert.equal(b.newsletterRows.length, 1);
  assert.equal(b.newsletterRows[0].brand_insights_opt_in, true);

  const c = await run("case-c", { monthly: true, existing: true });
  assert.equal(c.applicationRows[0].newsletter_sync_status, "already_subscribed");
  assert.equal(c.newsletterRows.length, 0);

  const d = await run("case-d", { monthly: false, resendFails: true });
  assert.equal(d.response.status, 202);
  assert.equal(d.result.accepted, true);
  assert.equal(d.applicationRows[0].notification_email_status, "failed");

  const e = await run("case-e", { monthly: true, persistenceFails: true });
  assert.equal(e.response.status, 503);
  assert.equal(e.result.code, "persistence_unavailable");
  assert.equal(e.calls.some(x => x.url.includes("1154960")), false);
  assert.equal(e.calls.some(x => x.url.includes("api.resend.com")), false);

  const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../src/pages/api/brand-applications.ts", import.meta.url), "utf8"));
  assert.ok(source.includes('"Разработка"'));
  assert.equal(source.includes('"Разработка / концепция"'), false);
  assert.equal(source.includes('"Шивашко производство"'), false);
  console.log("Brand application persistence tests passed (CASE A-E, G backend). ");
} finally {
  globalThis.fetch = originalFetch;
}
