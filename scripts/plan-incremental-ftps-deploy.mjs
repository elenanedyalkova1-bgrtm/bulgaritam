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
  const candidates = localFiles.filter(file => trustedState?.files?.[file] !== localHashes[file]);
  const probed = await mapLimit(candidates, concurrency, async file => {
    try {
      const response = await fetchImpl(new URL(`/${file}`, origin), { headers: { Accept: "*/*", "Cache-Control": "no-cache" } });
      if (response.status === 404) return { file, kind: "new" };
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { file, kind: await responseHash(response) === localHashes[file] ? "unchanged" : "changed" };
    } catch (error) { throw new Error(`Remote comparison failed for /${file}: ${error instanceof Error ? error.message : error}`); }
  });
  const unchanged = localFiles.filter(file => trustedState?.files?.[file] === localHashes[file]);
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

export function writeLftpCommands(plan, { distDir = "dist", output, stateOutput, runId = "local" } = {}) {
  if (!output || !stateOutput) throw new Error("output and stateOutput are required");
  fs.writeFileSync(stateOutput, `${JSON.stringify(plan.state)}\n`);
  const commands = []; const directories = new Set();
  for (const file of [...plan.changed, ...plan.new]) {
    const remote = `/${file}`; const directory = path.posix.dirname(remote);
    if (!directories.has(directory)) { commands.push(...ensureRemoteDirectoryCommands(directory)); directories.add(directory); }
    const temporary = `${remote}.upload-${runId}`;
    commands.push(...atomicUploadCommands(path.join(distDir, file), temporary, remote));
  }
  for (const file of plan.stale) commands.push(`rm -f ${quote(`/${file}`)}`);
  const stateTemporary = `${DEPLOY_STATE_PATH}.upload-${runId}`;
  commands.push(...atomicUploadCommands(stateOutput, stateTemporary, DEPLOY_STATE_PATH));
  fs.writeFileSync(output, `${commands.join("\n")}\n`);
}

function option(name, fallback) { const prefix = `--${name}=`; return process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length) || fallback; }

async function main() {
  const distDir = option("dist", "dist"); const origin = option("origin", "https://bulgaritam.bg");
  const output = option("output", "/tmp/incremental-deploy-plan.json");
  const commands = option("commands", "/tmp/incremental-deploy.lftp"); const stateOutput = option("state-output", "/tmp/bulgaritam-deploy-state.json");
  const plan = await createIncrementalPlan({ distDir, origin, concurrency: Number(option("concurrency", "20")) });
  writeLftpCommands(plan, { distDir, output: commands, stateOutput, runId: option("run-id", process.env.GITHUB_RUN_ID || "local") });
  fs.writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(JSON.stringify({ total: plan.total, unchanged: plan.unchanged.length, changed: plan.changed.length, new: plan.new.length, stale: plan.stale.length,
    transfers: plan.changed.length + plan.new.length, used_remote_state: plan.used_remote_state, plan: output, commands }));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
