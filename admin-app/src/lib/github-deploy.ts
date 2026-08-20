import { strFromU8, unzipSync } from "fflate";

type PublishMode = "dry-run" | "deploy";
export type PublishStage = "preparing" | "building" | "uploading" | "verifying" | "live" | "failed";
export type PublishRun = {
  id: number; status: string; conclusion: string | null; url: string; branch: string; commit: string;
  createdAt: string; updatedAt: string; actor: string; stage: PublishStage; stageLabel: string; failedStage: string;
};
export type ProductHealthReport = {
  generated_at: string; checked: number; healthy: number; broken_images: number; confirmed_broken_images: number;
  needs_review: number; review: any[]; confirmed_broken_image_products: any[];
};

function config() {
  const repository = import.meta.env.GITHUB_REPOSITORY || "";
  const token = import.meta.env.GITHUB_DEPLOY_TOKEN || "";
  const workflow = import.meta.env.GITHUB_DEPLOY_WORKFLOW || "publish-public.yml";
  const ref = import.meta.env.GITHUB_DEPLOY_REF || "main";
  const missing = [!repository && "GITHUB_REPOSITORY", !token && "GITHUB_DEPLOY_TOKEN"].filter(Boolean) as string[];
  if (repository && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) missing.push("valid GITHUB_REPOSITORY");
  return { repository, token, workflow, ref, missing };
}

async function githubResponse(path: string, init: RequestInit = {}) {
  const { token } = config();
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${await response.text()}`);
  return response;
}
async function github(path: string, init: RequestInit = {}) {
  const response = await githubResponse(path, init);
  return response.status === 204 ? null : response.json();
}

function stageFor(run: any, jobs: any[]): Pick<PublishRun, "stage" | "stageLabel" | "failedStage"> {
  const steps = jobs.flatMap((job) => job.steps || []);
  const failure = steps.find((step) => step.conclusion === "failure") || jobs.find((job) => job.conclusion === "failure");
  if (run.status === "completed" && run.conclusion === "success") return { stage: "live", stageLabel: "Live", failedStage: "" };
  if (run.status === "completed" && run.conclusion !== "success") return { stage: "failed", stageLabel: "Failed", failedStage: failure?.name || "Workflow" };
  const active = steps.find((step) => step.status === "in_progress")?.name || "";
  if (/Verify public origin/i.test(active)) return { stage: "verifying", stageLabel: "Verifying", failedStage: "" };
  if (/Upload site|FTPS|artifact to SuperHosting/i.test(active)) return { stage: "uploading", stageLabel: "Uploading", failedStage: "" };
  if (/Build latest|Verify generated|Upload verified/i.test(active)) return { stage: "building", stageLabel: "Building", failedStage: "" };
  const build = jobs.find((job) => /Build and verify/i.test(job.name));
  const deploy = jobs.find((job) => /SuperHosting/i.test(job.name));
  if (deploy?.status === "in_progress") return { stage: "uploading", stageLabel: "Uploading", failedStage: "" };
  if (build?.status === "completed") return { stage: "uploading", stageLabel: "Preparing upload", failedStage: "" };
  if (build?.status === "in_progress") return { stage: "building", stageLabel: "Building", failedStage: "" };
  return { stage: "preparing", stageLabel: "Preparing", failedStage: "" };
}

export function publishConfiguration() {
  const value = config();
  return { ...value, token: undefined, productionEnabled: import.meta.env.PUBLISH_PRODUCTION_ENABLED === "true" };
}
export async function dispatchPublish(mode: PublishMode) {
  const { repository, workflow, ref, missing } = config();
  if (missing.length) throw new Error(`Publishing is not configured: ${missing.join(", ")}`);
  if (mode === "deploy" && import.meta.env.PUBLISH_PRODUCTION_ENABLED !== "true") throw new Error("Production publishing is disabled.");
  if ((await listPublishRuns()).some((run) => run.status !== "completed")) throw new Error("A publication is already running. Wait for it to finish before starting another one.");
  await github(`/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, { method: "POST", body: JSON.stringify({ ref, inputs: { mode } }) });
}
export async function listPublishRuns(): Promise<PublishRun[]> {
  const { repository, workflow, missing } = config();
  if (missing.length) return [];
  const data = await github(`/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=10`);
  return Promise.all((data.workflow_runs || []).map(async (run: any) => {
    let jobs: any[] = [];
    try { jobs = (await github(`/repos/${repository}/actions/runs/${run.id}/jobs?per_page=100`)).jobs || []; } catch { /* Keep coarse status if job details are unavailable. */ }
    return { id: run.id, status: run.status, conclusion: run.conclusion, url: run.html_url, branch: run.head_branch,
      commit: String(run.head_sha || "").slice(0, 7), createdAt: run.created_at, updatedAt: run.updated_at,
      actor: run.actor?.login || "", ...stageFor(run, jobs) };
  }));
}
export async function loadLatestProductHealthReport(): Promise<{ report: ProductHealthReport; runId: number; createdAt: string } | null> {
  const { repository, missing } = config();
  if (missing.length) return null;
  const data = await github(`/repos/${repository}/actions/artifacts?per_page=100`);
  const artifact = (data.artifacts || []).find((item: any) => !item.expired && String(item.name).startsWith("product-health-report-"));
  if (!artifact) return null;
  const response = await githubResponse(`/repos/${repository}/actions/artifacts/${artifact.id}/zip`, { headers: { Accept: "application/octet-stream" } });
  const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
  const file = Object.entries(archive).find(([name]) => name.endsWith("product-health-report.json"));
  if (!file) throw new Error("The latest health artifact does not contain product-health-report.json.");
  return { report: JSON.parse(strFromU8(file[1])), runId: Number(artifact.workflow_run?.id || 0), createdAt: artifact.created_at };
}
