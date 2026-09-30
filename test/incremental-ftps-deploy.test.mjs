import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createIncrementalPlan, ensureRemoteDirectoryCommands, writeLftpCommands } from "../scripts/plan-incremental-ftps-deploy.mjs";

const response = (body, status = 200) => new Response(body, { status });

function simulateDirectoryGuard(commands, { directoryExists, mkdirSucceeds }) {
  let previousSucceeded = true;
  for (const command of commands) {
    if (command.startsWith("cd ") && command.includes(" || mkdir ")) {
      previousSucceeded = directoryExists || mkdirSucceeds;
      continue;
    }
    if (!previousSucceeded) throw new Error("lftp cmd:fail-exit");
    previousSucceeded = true;
  }
}

test("remote directory guard proceeds when the directory already exists", () => {
  const commands = ensureRemoteDirectoryCommands("/brand/160-candles");
  assert.deepEqual(commands, [
    'cd "/brand/160-candles" || mkdir -p "/brand/160-candles"',
    'cd "/"',
  ]);
  assert.doesNotThrow(() => simulateDirectoryGuard(commands, { directoryExists: true, mkdirSucceeds: false }));
});

test("remote directory guard fails when an absent directory cannot be created", () => {
  const commands = ensureRemoteDirectoryCommands("/brand/forbidden");
  assert.throws(
    () => simulateDirectoryGuard(commands, { directoryExists: false, mkdirSucceeds: false }),
    /lftp cmd:fail-exit/,
  );
});

test("incremental plan hashes remote content, uploads only differences and deletes only stale generated routes", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "deploy-plan-"));
  fs.mkdirSync(path.join(root, "p", "current"), { recursive: true }); fs.mkdirSync(path.join(root, "_astro"), { recursive: true });
  fs.writeFileSync(path.join(root, "index.html"), "same"); fs.writeFileSync(path.join(root, "_astro", "app.js"), "new-js");
  fs.writeFileSync(path.join(root, ".htaccess"), "hosting-owned");
  fs.writeFileSync(path.join(root, "p", "current", "index.html"), "new-page");
  fs.writeFileSync(path.join(root, "deploy-manifest.json"), JSON.stringify({ commit: "abc", product_paths: ["/p/current/"], brand_paths: [] }));
  const remote = new Map([["/index.html", "same"], ["/_astro/app.js", "old-js"], ["/p/current/index.html", "new-page"],
    ["/deploy-manifest.json", JSON.stringify({ product_paths: ["/p/current/", "/p/stale/"], brand_paths: [] })]]);
  const fetchImpl = async url => remote.has(new URL(url).pathname) ? response(remote.get(new URL(url).pathname)) : response("", 404);
  const plan = await createIncrementalPlan({ distDir: root, origin: "https://example.test", fetchImpl, concurrency: 2 });
  assert.deepEqual(plan.changed, ["_astro/app.js", "deploy-manifest.json"]); assert.deepEqual(plan.new, []);
  assert.ok(plan.unchanged.includes("index.html")); assert.ok(plan.unchanged.includes("p/current/index.html"));
  assert.deepEqual(plan.stale, ["p/stale/index.html"]);
  assert.equal(plan.unchanged.includes(".htaccess"), false);
  const commands = path.join(root, "commands.lftp"); const state = path.join(root, "state.json");
  writeLftpCommands(plan, { distDir: root, output: commands, stateOutput: state, runId: "7" });
  const script = fs.readFileSync(commands, "utf8");
  assert.match(script, /app\.js\.upload-7/); assert.doesNotMatch(script, /put .*index\.html\.upload-7.*index\.html/);
  assert.match(script, /rm -f "\/p\/stale\/index\.html"/); assert.doesNotMatch(script, /mirror --delete|rm -rf/);
});

test("trusted completed state makes a second identical run upload nothing", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "deploy-idempotent-")); fs.writeFileSync(path.join(root, "index.html"), "same");
  fs.writeFileSync(path.join(root, "deploy-manifest.json"), JSON.stringify({ commit: "abc", product_paths: [], brand_paths: [] }));
  const firstFetch = async url => new URL(url).pathname === "/deploy-manifest.json" ? response(fs.readFileSync(path.join(root, "deploy-manifest.json"))) : response(new URL(url).pathname === "/index.html" ? "same" : "", new URL(url).pathname === "/index.html" ? 200 : 404);
  const first = await createIncrementalPlan({ distDir: root, origin: "https://example.test", fetchImpl: firstFetch });
  const secondFetch = async url => new URL(url).pathname === "/.bulgaritam-deploy-state.json" ? response(JSON.stringify(first.state)) : response("unexpected", 500);
  const second = await createIncrementalPlan({ distDir: root, origin: "https://example.test", fetchImpl: secondFetch });
  assert.equal(second.used_remote_state, true); assert.equal(second.changed.length, 0); assert.equal(second.new.length, 0); assert.equal(second.stale.length, 0);
  assert.equal(second.unchanged.length, second.total);
});
