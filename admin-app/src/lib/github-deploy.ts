type PublishMode = "dry-run" | "deploy";
export type PublishRun = { id: number; status: string; conclusion: string | null; url: string; branch: string; commit: string; createdAt: string; updatedAt: string; actor: string };

function config() {
  const repository = import.meta.env.GITHUB_REPOSITORY || "";
  const token = import.meta.env.GITHUB_DEPLOY_TOKEN || "";
  const workflow = import.meta.env.GITHUB_DEPLOY_WORKFLOW || "publish-public.yml";
  const ref = import.meta.env.GITHUB_DEPLOY_REF || "main";
  const missing = [!repository && "GITHUB_REPOSITORY", !token && "GITHUB_DEPLOY_TOKEN"].filter(Boolean) as string[];
  if (repository && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) missing.push("valid GITHUB_REPOSITORY");
  return { repository, token, workflow, ref, missing };
}

async function github(path: string, init: RequestInit = {}) {
  const { token } = config();
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

export function publishConfiguration() {
  const value = config();
  return { ...value, token: undefined, productionEnabled: import.meta.env.PUBLISH_PRODUCTION_ENABLED === "true" };
}

export async function dispatchPublish(mode: PublishMode) {
  const { repository, workflow, ref, missing } = config();
  if (missing.length) throw new Error(`Publishing is not configured: ${missing.join(", ")}`);
  if (mode === "deploy" && import.meta.env.PUBLISH_PRODUCTION_ENABLED !== "true") throw new Error("Production publishing is disabled until the first live publish is explicitly approved.");
  await github(`/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref, inputs: { mode } }),
  });
}

export async function listPublishRuns(): Promise<PublishRun[]> {
  const { repository, workflow, missing } = config();
  if (missing.length) return [];
  const data = await github(`/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/runs?event=workflow_dispatch&per_page=10`);
  return (data.workflow_runs || []).map((run: any) => ({
    id: run.id,
    status: run.status,
    conclusion: run.conclusion,
    url: run.html_url,
    branch: run.head_branch,
    commit: String(run.head_sha || "").slice(0, 7),
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    actor: run.actor?.login || "",
  }));
}
