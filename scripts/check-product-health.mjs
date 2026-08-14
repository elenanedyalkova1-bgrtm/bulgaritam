import fs from "node:fs/promises";
import path from "node:path";

try {
  process.loadEnvFile?.();
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const BASEROW_API_TOKEN = process.env.BASEROW_API_TOKEN;
const BASEROW_TABLE_ID = process.env.BASEROW_TABLE_ID || "906650";
const APPLY = process.argv.includes("--apply");
const argValue = (name) => process.argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1) || "";
const ONLY_SLUG = argValue("--slug");
const LIMIT = Number(argValue("--limit")) || Infinity;
const CONCURRENCY = Math.min(Math.max(Number(argValue("--concurrency")) || 6, 1), 10);
const REPORT_PATH = argValue("--report");
const TIMEOUT_MS = 12_000;
const USER_AGENT = "BulgaritamProductHealth/1.0 (+https://bulgaritam.bg/)";

if (!BASEROW_API_TOKEN) throw new Error("Missing BASEROW_API_TOKEN env var");

const apiHeaders = {
  Authorization: `Token ${BASEROW_API_TOKEN}`,
  "Content-Type": "application/json",
};

const publicHeaders = {
  Accept: "text/html,application/xhtml+xml,image/avif,image/webp,image/*;q=0.8,*/*;q=0.5",
  "Accept-Language": "bg,en;q=0.8",
  "User-Agent": USER_AGENT,
};

const clean = (value) => String(value ?? "").trim();
const splitUrls = (value) => clean(value).split(",").map((item) => item.trim()).filter(Boolean);
const isActive = (value) => value === true || ["true", "1", "yes", "y"].includes(clean(value).toLowerCase());

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRows() {
  const rows = [];
  let next = `https://api.baserow.io/api/database/rows/table/${BASEROW_TABLE_ID}/?user_field_names=true&size=200`;
  while (next) {
    const response = await fetchWithTimeout(next, { headers: apiHeaders });
    if (!response.ok) throw new Error(`Baserow read failed: ${response.status} ${response.statusText}`);
    const data = await response.json();
    rows.push(...(data.results || []));
    next = data.next || "";
  }
  return rows;
}

async function probe(url, kind) {
  if (!/^https?:\/\//i.test(url)) return { status: 0, state: "invalid_url", finalUrl: url };
  try {
    const headers = kind === "image" ? { ...publicHeaders, Range: "bytes=0-2047" } : publicHeaders;
    const response = await fetchWithTimeout(url, { headers, redirect: "follow" });
    const contentType = clean(response.headers.get("content-type")).toLowerCase();
    const finalUrl = response.url || url;
    await response.body?.cancel();

    if (response.status === 404 || response.status === 410) {
      return { status: response.status, state: "gone", finalUrl, contentType };
    }
    if (response.status === 403 || response.status === 429) {
      return { status: response.status, state: "blocked", finalUrl, contentType };
    }
    if (!response.ok) return { status: response.status, state: "http_error", finalUrl, contentType };
    if (kind === "image" && !contentType.startsWith("image/")) {
      return { status: response.status, state: "not_image", finalUrl, contentType };
    }
    if (kind === "product") {
      const original = new URL(url);
      const final = new URL(finalUrl);
      if (original.pathname !== "/" && final.pathname === "/") {
        return { status: response.status, state: "redirected_to_home", finalUrl, contentType };
      }
    }
    return { status: response.status, state: "ok", finalUrl, contentType };
  } catch (error) {
    const state = error?.name === "AbortError" ? "timeout" : "network_error";
    return { status: 0, state, finalUrl: url, error: clean(error?.message) };
  }
}

async function confirmGone(url) {
  const attempts = [];
  for (let index = 0; index < 3; index += 1) {
    const result = await probe(url, "product");
    attempts.push(result);
    if (result.state !== "gone") break;
  }
  return { confirmed: attempts.length === 3 && attempts.every((item) => item.state === "gone"), attempts };
}

async function checkProduct(row) {
  const productUrl = clean(row.product_url);
  const imageUrl = splitUrls(row.image_urls)[0] || "";
  const product = await probe(productUrl, "product");
  const image = imageUrl ? await probe(imageUrl, "image") : { status: 0, state: "missing", finalUrl: "" };
  let confirmedGone = false;
  let productAttempts = [product];

  if (product.state === "gone") {
    const confirmation = await confirmGone(productUrl);
    confirmedGone = confirmation.confirmed;
    productAttempts = confirmation.attempts;
  }

  const needsReview = !confirmedGone && (
    product.state !== "ok" || image.state !== "ok"
  );

  return {
    id: row.id,
    slug: clean(row.slug),
    name: clean(row.name_bg),
    brand: clean(row.brand_name),
    product_url: productUrl,
    image_url: imageUrl,
    product,
    product_attempts: productAttempts,
    image,
    confirmed_gone: confirmedGone,
    needs_review: needsReview,
  };
}

async function mapConcurrent(items, worker, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

async function deactivate(row) {
  const endpoint = `https://api.baserow.io/api/database/rows/table/${BASEROW_TABLE_ID}/${row.id}/?user_field_names=true`;
  const response = await fetchWithTimeout(endpoint, {
    method: "PATCH",
    headers: apiHeaders,
    body: JSON.stringify({ is_active: "false" }),
  });
  if (!response.ok) {
    const details = clean(await response.text());
    throw new Error(`Baserow update failed for ${row.slug}: ${response.status} ${response.statusText}${details ? ` — ${details}` : ""}`);
  }
  await response.body?.cancel();
}

const rows = (await fetchRows())
  .filter((row) => isActive(row.is_active))
  .filter((row) => !ONLY_SLUG || clean(row.slug) === ONLY_SLUG)
  .slice(0, LIMIT);

const checked = await mapConcurrent(rows, checkProduct, CONCURRENCY);
const gone = checked.filter((item) => item.confirmed_gone);
const review = checked.filter((item) => item.needs_review);
const brokenImages = checked.filter((item) => item.image.state !== "ok");
const deactivated = [];

if (APPLY) {
  for (const item of gone) {
    await deactivate(item);
    deactivated.push(item.slug);
  }
}

const report = {
  generated_at: new Date().toISOString(),
  mode: APPLY ? "apply" : "report-only",
  checked: checked.length,
  healthy: checked.filter((item) => !item.needs_review && !item.confirmed_gone).length,
  confirmed_gone: gone.length,
  broken_images: brokenImages.length,
  needs_review: review.length,
  deactivated,
  gone,
  review,
};

if (REPORT_PATH) {
  const absolute = path.resolve(REPORT_PATH);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify(report, null, 2));
