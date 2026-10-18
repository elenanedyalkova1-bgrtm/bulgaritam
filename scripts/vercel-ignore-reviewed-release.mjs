import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const REVIEWED_BASE_SHA = '23a2941f33bea473874241d529d0c415f23172eb';

export const REVIEWED_CHANGESET = Object.freeze([
  'M\t.github/workflows/external-price-monitor.yml',
  'M\t.github/workflows/price-monitor.yml',
  'M\tscripts/run-scheduled-price-monitor.mjs',
  'A\tscripts/simulate-price-monitor-scheduler.mjs',
  'A\tscripts/vercel-ignore-reviewed-release.mjs',
  'M\tsrc/lib/price-monitor/README.md',
  'M\tsrc/lib/price-monitor/index.mjs',
  'M\tsrc/lib/price-monitor/monitor.mjs',
  'M\tsrc/lib/price-monitor/persistence.mjs',
  'M\tsrc/lib/price-monitor/scheduler.mjs',
  'M\ttest/price-monitor-external-scheduler.test.mjs',
  'M\ttest/price-monitor-scheduler.test.mjs',
  'M\ttest/price-monitor-sheets.test.mjs',
  'M\ttest/price-monitor.test.mjs',
  'A\ttest/vercel-ignore-reviewed-release.test.mjs',
  'M\ttest/verified-offer.test.ts',
].sort());

export const RELEASE_PROFILES = Object.freeze({
  'manual-price-admin-only': Object.freeze({
    baseSha: 'e666812ecd1224e671edda7562826764f5a2fbeb',
    expectedChanges: Object.freeze([
      'A\tadmin-app/src/lib/manual-price-review.ts',
      'M\tadmin-app/src/lib/repositories.ts',
      'M\tadmin-app/src/pages/price-health.astro',
      'A\tdocs/manual-price-fallback-90-days.md',
      'M\tpackage.json',
      'M\tscripts/vercel-ignore-reviewed-release.mjs',
      'M\tsrc/lib/products.ts',
      'M\tsrc/lib/verified-offer.ts',
      'M\tsrc/pages/p/[slug].astro',
      'A\ttest/manual-price-fallback-ui.test.mjs',
      'M\ttest/vercel-ignore-reviewed-release.test.mjs',
      'M\ttest/verified-offer.test.ts',
    ].sort()),
  }),
});

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function sameList(actual, expected) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

export function shouldIgnoreReviewedRelease({
  cwd = process.cwd(),
  releaseSha,
  baseSha = REVIEWED_BASE_SHA,
  expectedChanges = REVIEWED_CHANGESET,
} = {}) {
  if (!/^[0-9a-f]{40}$/.test(String(releaseSha ?? ''))) return false;

  try {
    const root = git(cwd, ['rev-parse', '--show-toplevel']);
    const resolvedBase = git(root, ['rev-parse', `${baseSha}^{commit}`]);
    const resolvedRelease = git(root, ['rev-parse', `${releaseSha}^{commit}`]);
    if (resolvedBase !== baseSha || resolvedRelease !== releaseSha) return false;

    if (git(root, ['merge-base', baseSha, releaseSha]) !== baseSha) return false;

    const actualChanges = git(root, [
      'diff',
      '--name-status',
      '--no-renames',
      baseSha,
      releaseSha,
      '--',
    ]).split(/\r?\n/).filter(Boolean).sort();
    if (!sameList(actualChanges, [...expectedChanges].sort())) return false;

    const head = git(root, ['rev-parse', 'HEAD']);
    if (head === releaseSha) return true;

    const parents = git(root, ['rev-list', '--parents', '-n', '1', head]).split(/\s+/);
    if (parents.length !== 3 || parents[1] !== baseSha || parents[2] !== releaseSha) {
      return false;
    }

    return git(root, ['rev-parse', `${head}^{tree}`])
      === git(root, ['rev-parse', `${releaseSha}^{tree}`]);
  } catch {
    // Vercel builds on every incomplete, shallow, malformed or unknown checkout.
    return false;
  }
}

export function shouldIgnoreReleaseProfile({
  cwd = process.cwd(),
  releaseSha,
  profileName,
  project = 'public',
} = {}) {
  // This release intentionally builds the Admin project. Only the public
  // project may use an exact reviewed profile to skip a deployment.
  if (project !== 'public') return false;

  const profile = RELEASE_PROFILES[profileName];
  if (!profile) return false;

  return shouldIgnoreReviewedRelease({
    cwd,
    releaseSha,
    baseSha: profile.baseSha,
    expectedChanges: profile.expectedChanges,
  });
}

export function runCli(argv = process.argv.slice(2)) {
  const ignore = RELEASE_PROFILES[argv[1]]
    ? shouldIgnoreReleaseProfile({ releaseSha: argv[0], profileName: argv[1] })
    : shouldIgnoreReviewedRelease({ releaseSha: argv[0] });
  process.exitCode = ignore ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
