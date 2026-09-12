import { buildMigrationPlan, executeMigrationBatches, findExistingMigrationKeys, migrationArgs, migrationSupabaseClient } from "./analytics-migration-runtime";
import { runMigrationPlan } from "../src/lib/analytics-migration";

const { execute, cutoff } = migrationArgs();
const plan = await buildMigrationPlan(cutoff);
const client = migrationSupabaseClient();
const existing = await findExistingMigrationKeys(client, plan.inserts);
const run = await runMigrationPlan(plan, existing, execute, (pending) => executeMigrationBatches(client, pending));
const pending = run.pending;

console.log(JSON.stringify({
  mode: execute ? "EXECUTE" : "DRY RUN",
  cutoff: cutoff.toISOString(),
  ...plan.stats,
  alreadyExisting: plan.inserts.length - pending.length,
  pending: pending.length,
  failed: plan.issues.length,
  issues: plan.issues,
}, null, 2));

if (!execute) {
  console.log("Dry run complete: zero Supabase writes performed.");
} else {
  const result = run.result!;
  console.log(JSON.stringify({ mode: "EXECUTE COMPLETE", ...result }, null, 2));
  if (result.failed || plan.issues.length) process.exitCode = 1;
}
