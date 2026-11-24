#!/usr/bin/env node
// Read-only preview. Never writes to Sheets or Baserow.
import fs from "node:fs/promises";
import { historyObservation } from "../src/lib/price-monitor/google-sheets-history.mjs";
import { normalizeExternalProductUrl } from "../src/lib/price-monitor/product-metadata.mjs";

export function prepareRecovery(report) {
  const groups = new Map();
  for (const row of report.discovery_observations || []) {
    const key = String(row.entity_id ?? "");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const recoverable = []; const unresolved = [];
  for (const [entityId, group] of groups) {
    if (group.length < 2) continue;
    // The original run kept the last observation per entity. Only the exact
    // language-prefix alias pattern is proven here; variants and site-wide
    // canonicals need a live identity audit and are not assigned an ID.
    const kept = group.at(-1);
    for (const row of group.slice(0, -1)) {
      const source = normalizeExternalProductUrl(row.product_url);
      const canonical = normalizeExternalProductUrl(row.canonical_url);
      let safe = false;
      if (source && canonical && canonical === normalizeExternalProductUrl(kept.product_url) && canonical === normalizeExternalProductUrl(kept.canonical_url)) {
        const a = new URL(source); const b = new URL(canonical);
        safe = a.hostname === b.hostname && !a.search && !b.search && a.pathname.replace(/^\/en(?=\/)/i, "") === b.pathname && a.pathname !== b.pathname;
      }
      if (safe) recoverable.push(historyObservation(row));
      else unresolved.push({ entity_id: entityId, source_url: row.product_url, checked_at: row.checked_at, canonical_url: row.canonical_url, reason: "identity_requires_review" });
    }
  }
  return { source: "external-price-monitor-45233186683-1", recoverable, unresolved };
}

if (process.argv[1]?.endsWith("prepare-external-history-recovery.mjs")) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error("Usage: node scripts/prepare-external-history-recovery.mjs run-summary.json output.json");
  const result = prepareRecovery(JSON.parse(await fs.readFile(input, "utf8")));
  await fs.writeFile(output, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ recoverable: result.recoverable.length, unresolved: result.unresolved.length, output }));
}
