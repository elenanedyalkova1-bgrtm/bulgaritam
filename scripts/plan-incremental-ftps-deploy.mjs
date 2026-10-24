import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEPLOY_STATE_PATH = "/.bulgaritam-deploy-state.json";

const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");
const posix = value => value.split(path.sep).join("/");
const quote = value => `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

export function ensureRemoteDirectoryCommands(directory) {
  const target = quote(directory);
  // Avoid issuing MKD for an existing directory. If CWD fails because the
  // directory is absent, MKD must succeed; otherwise cmd:fail-exit stops the
  // script when the following unconditional command is reached.
  return [`cd ${target} || mkdir -p ${target}`, 'cd "/"'];
}

export function atomicUploadCommands(local, temporary, remote) {
  // lftp 4.9.2 syntax requires the local file before its -o remote target.
  // The final path is never removed first: only a completed temporary upload
  // is renamed into place.
  return [`put ${quote(local)} -o ${quote(temporary)}`, `mv ${quote(temporary)} ${quote(remote)}`];
}

function filesBelow(root, directory = root) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(root, absolute) : [posix(path.relative(root, absolute))];
  });
}

function generatedRouteFile(value) {
  const pathname = String(value || "").replace(/^\/+|\/+$/g, "");
  return pathname ? `${pathname}/index.html` : null;
}

async function responseHash(response) {
  return sha256(Buffer.from(await response.arrayBuffer()));
}

async function mapLimit(items, limit, worker) {
  const result = new Array(items.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; result[index] = await worker(items[index], index); }
  }));
  return result;
}

async function fetchJson(url, fetchImpl) {
  try { const response = await fetchImpl(url, { headers: { Accept: "application/json" } }); return response.ok ? await response.json() : null; }
  catch { return null; }
}

export async function createIncrementalPlan({ distDir = "dist", origin = "https://bulgaritam.bg", fetchImpl = fetch, concurrency = 20 } = {}) {
  const root = path.resolve(distDir);
  if (!fs.existsSync(path.join(root, "deploy-manifest.json"))) throw new Error("Verified dist/deploy-manifest.json is required");
  // Hosting-owned .htaccess is deliberately outside the generated-file ownership boundary.
  const localFiles = filesBelow(root).filter(file => ![DEPLOY_STATE_PATH.slice(1), ".htaccess"].includes(file)).sort();
  const localHashes = Object.fromEntries(localFiles.map(file => [file, sha256(fs.readFileSync(path.join(root, file)))]));
  const stateUrl = new URL(DEPLOY_STATE_PATH, origin);
  const remoteState = await fetchJson(stateUrl, fetchImpl);
  const trustedState = remoteState?.version === 1 && remoteState.files && typeof remoteState.files === "object" ? remoteState : null;
  // A failed publication may have replaced files without publishing its state.
  // Probe actual bytes even when the last completed state claims equality;
  // otherwise retry/rollback could silently skip partially replaced documents.
  const candidates = localFiles;
  const probed = await mapLimit(candidates, concurrency, async file => {
    try {
      if (/\.(?:m?js|css)$/i.test(file) && trustedState?.files?.[file] && trustedState.files[file] !== localHashes[file]) {
        throw new Error("Code asset URL changed since completed release; fingerprint/version it even if a partial upload already replaced origin bytes");
      }
      const response = await fetchImpl(new URL(`/${file}`, origin), { headers: { Accept: "*/*", "Cache-Control": "no-cache" } });
      if (response.status === 404) return { file, kind: "new" };
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const same = await responseHash(response) === localHashes[file];
      // Replacing code at a cached URL can break old HTML even with asset-first
      // upload. New code must use a new URL (Astro's normal fingerprinting).
      if (!same && /\.(?:m?js|css)$/i.test(file)) throw new Error("Code asset URL already contains different bytes; fingerprint/version the replacement instead of overwriting a cached URL");
      return { file, kind: same ? "unchanged" : "changed" };
    } catch (error) { throw new Error(`Remote comparison failed for /${file}: ${error instanceof Error ? error.message : error}`); }
  });
  const unchanged = [];
  const changed = []; const added = [];
  for (const result of probed) {
    if (result.kind === "unchanged") unchanged.push(result.file);
    else if (result.kind === "new") added.push(result.file);
    else changed.push(result.file);
  }
  let previousGenerated = [];
  if (trustedState) previousGenerated = Object.keys(trustedState.files).filter(file => /^(?:p|brand)\/.+\/index\.html$/.test(file));
  else {
    const liveManifest = await fetchJson(new URL("/deploy-manifest.json", origin), fetchImpl);
    previousGenerated = [...(liveManifest?.product_paths || []), ...(liveManifest?.brand_paths || [])].map(generatedRouteFile).filter(Boolean);
  }
  const localSet = new Set(localFiles);
  const stale = [...new Set(previousGenerated.filter(file => !localSet.has(file)))].sort();
  const state = { version: 1, generated_at: new Date().toISOString(), commit: JSON.parse(fs.readFileSync(path.join(root, "deploy-manifest.json"), "utf8")).commit, files: localHashes };
  return { version: 1, origin, state_path: DEPLOY_STATE_PATH, used_remote_state: Boolean(trustedState), total: localFiles.length,
    unchanged: unchanged.sort(), changed: changed.sort(), new: added.sort(), stale, state };
}

const isDocument = file => /\.(?:html?|json|xml|txt|webmanifest)$/i.test(file);

export function deploymentPhases(plan) {
  const transfers = [...new Set([...plan.changed, ...plan.new])].sort();
  return {
    assets: transfers.filter(file => !isDocument(file)),
    documents: transfers.filter(file => isDocument(file) && file !== "deploy-manifest.json"),
    // Always publish the manifest, then completed state, only after document verification.
    finalize: ["deploy-manifest.json"],
  };
}

export async function verifyDeploymentPhase(plan, phase, { distDir = "dist", origin = plan.origin, fetchImpl = fetch, concurrency = 20 } = {}) {
  if (!["assets", "documents"].includes(phase)) throw new Error("Verification phase must be assets or documents");
  const phases = deploymentPhases(plan);
  const files = phase === "assets"
    ? Object.keys(plan.state.files).filter(file => !isDocument(file))
    : [...new Set([...phases.documents, "index.html"])];
  await mapLimit(files, concurrency, async file => {
    const expected = plan.state.files[file];
    if (!expected || sha256(fs.readFileSync(path.join(distDir, file))) !== expected) throw new Error(`Local file changed after planning: ${file}`);
    const response = await fetchImpl(new URL(`/${file}`, origin), { headers: { Accept: "*/*", "Cache-Control": "no-cache" } });
    if (!response.ok || await responseHash(response) !== expected) throw new Error(`Published ${phase} verification failed: ${file} (HTTP ${response.status})`);
  });
  return { phase, verified: files.length };
}

export function writeLftpCommands(plan, { distDir = "dist", output, stateOutput, runId = "local", phase = "all" } = {}) {
  if (!output || !stateOutput) throw new Error("output and stateOutput are required");
  if (!["all", "assets", "documents", "finalize"].includes(phase)) throw new Error("Invalid deployment phase");
  if (plan.stale.some(file => !/^(?:p|brand)\/.+\/index\.html$/.test(file))) throw new Error("Only previously owned product/brand documents may be removed; retain cached assets");
  fs.writeFileSync(stateOutput, `${JSON.stringify(plan.state)}\n`);
  const commands = []; const directories = new Set();
  const phases = deploymentPhases(plan);
  const files = phase === "all" ? [...phases.assets, ...phases.documents, ...phases.finalize] : phases[phase];
  for (const file of files) {
    if (file === "deploy-manifest.json") {
      // Cleanup must succeed before publishing the completion markers.
      // Never remove old assets: cached HTML and exact rollback still need them.
      for (const stale of plan.stale) commands.push(`rm -f ${quote(`/${stale}`)}`);
    }
    const remote = `/${file}`; const directory = path.posix.dirname(remote);
    if (!directories.has(directory)) { commands.push(...ensureRemoteDirectoryCommands(directory)); directories.add(directory); }
    const temporary = `${remote}.upload-${runId}`;
    commands.push(...atomicUploadCommands(path.join(distDir, file), temporary, remote));
  }
  if (phase === "all" || phase === "finalize") {
    const stateTemporary = `${DEPLOY_STATE_PATH}.upload-${runId}`;
    commands.push(...atomicUploadCommands(stateOutput, stateTemporary, DEPLOY_STATE_PATH));
  }
  fs.writeFileSync(output, `${commands.join("\n")}\n`);
}

function option(name, fallback) { const prefix = `--${name}=`; return process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length) || fallback; }

async function main() {
  const distDir = option("dist", "dist"); const origin = option("origin", "https://bulgaritam.bg");
  const output = option("output", "/tmp/incremental-deploy-plan.json");
  const commands = option("commands", "/tmp/incremental-deploy.lftp"); const stateOutput = option("state-output", "/tmp/bulgaritam-deploy-state.json");
  const verify = option("verify-phase", "");
  if (verify) {
    const plan = JSON.parse(fs.readFileSync(output, "utf8"));
    console.log(JSON.stringify(await verifyDeploymentPhase(plan, verify, { distDir, origin })));
    return;
  }
  const plan = await createIncrementalPlan({ distDir, origin, concurrency: Number(option("concurrency", "20")) });
  writeLftpCommands(plan, { distDir, output: commands, stateOutput, runId: option("run-id", process.env.GITHUB_RUN_ID || "local") });
  for (const phase of ["assets", "documents", "finalize"]) {
    const phaseOutput = option(`${phase}-commands`, "");
    if (phaseOutput) writeLftpCommands(plan, { distDir, output: phaseOutput, stateOutput, phase, runId: option("run-id", process.env.GITHUB_RUN_ID || "local") });
  }
  fs.writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(JSON.stringify({ total: plan.total, unchanged: plan.unchanged.length, changed: plan.changed.length, new: plan.new.length, stale: plan.stale.length,
    transfers: plan.changed.length + plan.new.length, used_remote_state: plan.used_remote_state, plan: output, commands }));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
