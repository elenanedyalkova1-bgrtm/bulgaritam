import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { classifyImageResponse, confirmImageHealth, probeImage } from "../scripts/lib/image-health.mjs";

const url = "https://example.test/image.png";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64");
const response = (status, body = "<html>Not found</html>", contentType = "text/html", headers = {}) => ({
  status, contentType, bytes: typeof body === "string" ? new TextEncoder().encode(body) : body, headers: new Headers(headers),
});
const observation = (...args) => ({ status: args[0], ...classifyImageResponse(response(...args)) });
async function confirm(sequence) {
  let index = 1;
  return confirmImageHealth(url, sequence[0], async () => {
    assert.ok(index < sequence.length, "unexpected additional health retry");
    return sequence[index++];
  });
}

test("repeated HTTP 202 HTML is inconclusive, never valid or confirmed broken", async () => {
  for (let i = 0; i < 3; i++) {
    const image = observation(202, "<html>Processing request</html>");
    const result = await confirm([image]);
    assert.equal(result.classification, "inconclusive");
    assert.equal(result.confirmed, false);
    assert.equal(result.reason, "http_202");
    assert.equal(image.valid_image_bytes, false);
  }
});

for (const status of [404, 410]) {
  test(`three definitive ${status} responses remain confirmed broken`, async () => {
    const result = await confirm(Array.from({ length: 3 }, () => observation(status)));
    assert.equal(result.classification, "confirmed_broken");
    assert.equal(result.confirmed, true);
    assert.equal(result.attempts.length, 3);
  });
}
for (const status of [200, 206]) {
  test(`${status} with image MIME and PNG bytes is valid`, async () => {
    const image = observation(status, png, "image/png");
    const result = await confirm([image]);
    assert.equal(result.classification, "valid");
    assert.equal(result.confirmed, false);
    assert.equal(image.valid_image_bytes, true);
  });
}
for (const [label, sequence] of [
  ["404 then 202 then 404", [observation(404), observation(202), observation(404)]],
  ["404 then image then 404", [observation(404), observation(200, png, "image/png"), observation(404)]],
  ["HTML then challenge then HTML", [observation(200), observation(200, "<title>Just a moment...</title>"), observation(200)]],
  ["415 then 500 then 415", [observation(415), observation(500), observation(415)]],
  ["404 then network error then 404", [observation(404), { status: 0, state: "network_error" }, observation(404)]],
]) {
  test(`mixed results are inconclusive: ${label}`, async () => {
    const result = await confirm(sequence);
    assert.equal(result.classification, "inconclusive");
    assert.equal(result.confirmed, false);
    assert.equal(result.reason, "inconsistent_response");
  });
}

test("mixed 404/410 still establishes permanent disappearance", async () => {
  const result = await confirm([observation(404), observation(410), observation(404)]);
  assert.equal(result.confirmed, true);
});
for (const html of [
  "<html><title>Just a moment...</title></html>",
  "<html><title>Access denied</title></html>",
  "<html><script src='/cdn-cgi/challenge-platform/script.js'></script></html>",
  "<html>Verify you are human</html>",
  "<html><title>Service unavailable</title></html>",
]) {
  test(`challenge/temporary HTML remains inconclusive: ${html}`, async () => {
    const result = await confirm([observation(200, html)]);
    assert.equal(result.classification, "inconclusive");
    assert.equal(result.confirmed, false);
  });
}
test("challenge and Retry-After headers cannot create confirmed exclusions", async () => {
  for (const headers of [{ "cf-mitigated": "challenge" }, { "retry-after": "60" }]) {
    const result = await confirm([observation(200, "<html></html>", "text/html", headers)]);
    assert.equal(result.classification, "inconclusive");
  }
  assert.equal(classifyImageResponse(response(404, "<title>Security check</title>")).state, "inconclusive");
});
test("auth, rate limiting, timeout and server errors remain inconclusive", async () => {
  for (const status of [201, 204, 301, 401, 403, 407, 408, 409, 423, 425, 429, 500, 502, 503, 504]) {
    assert.equal((await confirm([observation(status)])).classification, "inconclusive", String(status));
  }
  for (const state of ["timeout", "network_error"]) {
    assert.equal((await confirm([{ status: 0, state }])).classification, "inconclusive");
  }
});
test("ordinary stable non-image HTML and conclusive client errors retain exclusions", async () => {
  for (const status of [200, 400, 405, 414, 415, 422]) {
    const result = await confirm(Array.from({ length: 3 }, () => observation(status, "<html><title>Shop</title></html>")));
    assert.equal(result.classification, "confirmed_broken", String(status));
  }
});
test("missing and malformed URLs retain immediate confirmed exclusions", async () => {
  const missing = await confirmImageHealth("", { status: 0, state: "missing" }, () => assert.fail("no request expected"));
  assert.equal(missing.confirmed, true);
  for (const value of ["not-a-url", "https://", "ftp://example.test/a.png"]) {
    const image = await probeImage(value, { fetchImpl: () => assert.fail("no request expected") });
    assert.equal((await confirmImageHealth(value, image)).confirmed, true);
  }
});
test("MIME alone does not establish a valid image", async () => {
  assert.equal((await confirm([observation(200, "", "image/png")])).classification, "inconclusive");
  assert.equal((await confirm([observation(200, "unrecognized format", "image/example")])).classification, "inconclusive");
  assert.equal((await confirm([observation(200, png, "application/octet-stream")])).classification, "inconclusive");
  assert.equal((await confirm([observation(202, png, "image/png")])).classification, "inconclusive");
  assert.equal((await confirm([observation(200, "<title>Just a moment...</title>", "image/png")])).classification, "inconclusive");
});
test("common image signatures and SVG are accepted", () => {
  const examples = [
    ["image/jpeg", Buffer.from("ffd8ffe00010", "hex")],
    ["image/gif", Buffer.from("GIF89a")],
    ["image/webp", Buffer.from("52494646100000005745425056503820", "hex")],
    ["image/avif", Buffer.from("00000020667479706176696600000000", "hex")],
    ["image/svg+xml", Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>')],
  ];
  for (const [type, bytes] of examples) assert.equal(observation(200, bytes, type).state, "ok", type);
});
test("probe inspects bytes with the existing Range request and bounds ignored ranges", async () => {
  let cancelled = false;
  const image = await probeImage(url, { headers: { "User-Agent": "health-test" }, fetchImpl: async (requested, options) => {
    assert.equal(requested, url);
    assert.equal(options.headers.Range, "bytes=0-2047");
    assert.equal(options.headers["User-Agent"], "health-test");
    assert.ok(options.signal);
    return new Response(new ReadableStream({
      start(controller) {
        const body = new Uint8Array(20_000); body.set(png); controller.enqueue(body);
      }, cancel() { cancelled = true; },
    }), { status: 200, headers: { "content-type": "image/png" } });
  } });
  assert.equal(image.state, "ok");
  assert.equal(image.bytes_inspected, 8192);
  assert.equal(cancelled, true);
});
test("probe body errors and timeouts cannot confirm a broken image", async () => {
  for (const name of ["Error", "AbortError", "TimeoutError"]) {
    const image = await probeImage(url, { fetchImpl: async () => {
      throw Object.assign(new Error("upstream failed"), { name });
    } });
    assert.equal((await confirm([image])).classification, "inconclusive");
    assert.equal(image.valid_image_bytes, null);
  }
  const image = await probeImage(url, { fetchImpl: async () => new Response(new ReadableStream({
    start(controller) { controller.error(new Error("body failed")); },
  }), { headers: { "content-type": "image/png" } }) });
  assert.equal((await confirm([image])).classification, "inconclusive");
});

test("CLI report keeps 202 products in review but out of the publishing exclusion list", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "product-health-test-"));
  try {
    const preload = path.join(temporary, "mock-fetch.mjs");
    await fs.writeFile(preload, `
      const png = Buffer.from(${JSON.stringify(png.toString("base64"))}, "base64");
      globalThis.fetch = async (url, options = {}) => {
        if (options.method && options.method !== "GET") throw new Error("Writes are prohibited");
        if (String(url).startsWith("https://api.baserow.io/")) return Response.json({next:null,results:
          ["accepted", "gone", "valid"].map((slug,id)=>({id,slug,is_active:true,name_bg:slug,brand_name:"Example",product_url:"https://example.test/product",image_urls:"https://example.test/"+slug}))});
        if (String(url).endsWith("/valid")) return new Response(png,{status:206,headers:{"content-type":"image/png"}});
        return new Response("<html>Response</html>",{status:String(url).endsWith("/accepted")?202:String(url).endsWith("/gone")?404:200,headers:{"content-type":"text/html"}});
      };
    `);
    const reportPath = path.join(temporary, "report.json");
    const child = spawnSync(process.execPath, ["--import", preload,
      fileURLToPath(new URL("../scripts/check-product-health.mjs", import.meta.url)), `--report=${reportPath}`], {
      cwd: temporary, env: { ...process.env, BASEROW_API_TOKEN: "test-only" }, encoding: "utf8",
    });
    assert.equal(child.status, 0, child.stderr);
    const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
    assert.equal(report.mode, "report-only");
    assert.equal(report.confirmed_broken_images, 1);
    assert.equal(report.inconclusive_images, 1);
    assert.equal(report.healthy, 1);
    assert.deepEqual(report.deactivated, []);
    assert.deepEqual(report.confirmed_broken_image_products.map(p => p.slug), ["gone"]);
    assert.deepEqual(report.inconclusive_image_products.map(p => p.slug), ["accepted"]);
    assert.equal(report.review.find(p => p.slug === "accepted").image_confirmed_broken, false);
    assert.equal(report.review.find(p => p.slug === "accepted").image_classification, "inconclusive");
    assert.equal(report.review.find(p => p.slug === "gone").image_attempts.length, 3);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
