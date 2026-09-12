import { buildHistoricalParityReport } from "../src/lib/analytics-migration";
import { buildMigrationPlan, loadMigratedSupabaseRows, migrationArgs, migrationSupabaseClient } from "./analytics-migration-runtime";

const { cutoff } = migrationArgs();
const plan = await buildMigrationPlan(cutoff);
const migrated = await loadMigratedSupabaseRows(migrationSupabaseClient(), cutoff);
const report = buildHistoricalParityReport(plan.inserts, migrated);
console.log(JSON.stringify({ cutoff: cutoff.toISOString(), sourceIssues: plan.issues, ...report }, null, 2));
// Source issues remain visible for remediation, but parity is evaluated only
// across the eligible, successfully normalized historical rows.
if (!report.pass) process.exitCode = 1;
