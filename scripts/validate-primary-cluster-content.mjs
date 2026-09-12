import fs from "node:fs";
import { execFileSync } from "node:child_process";

const registryPath = "src/data/primary-cluster-landings.json";
const specs = JSON.parse(fs.readFileSync(registryPath, "utf8"));
let baseline = [];
try {
  baseline = JSON.parse(execFileSync("git", ["show", `HEAD:${registryPath}`], { encoding: "utf8" }));
} catch {}

const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
const repeatedGroups = (items, valuesForItem) => {
  const groups = new Map();
  for (const item of items) {
    for (const value of valuesForItem(item)) {
      const text = normalize(value);
      if (!text) continue;
      const paths = groups.get(text) || [];
      paths.push(item.path);
      groups.set(text, paths);
    }
  }
  return [...groups.entries()]
    .filter(([, paths]) => paths.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([text, paths]) => ({ text, count: paths.length, paths }));
};
const ownKeywordQuoted = (item) => {
  const needles = [item.h1, item.primaryKeyword].map(normalize).filter(Boolean);
  const copy = [item.description, ...item.intro, ...item.editorialSections.flatMap((section) => section.paragraphs)];
  return copy.some((text) => needles.some((needle) => text.includes(`„${needle}“`) || text.includes(`"${needle}"`)));
};
const rawPattern = /селекцията е фокусирана|обединено от конкретен вид|провери предназначението, варианта|получател\s*:|материя\s*:|вид продукт\s*:|подредена продуктова селекция|разгледай темата/i;
const rawTaxonomyCopy = (item) => [item.description, ...item.intro, ...item.editorialSections.flatMap((section) => section.paragraphs)]
  .some((text) => rawPattern.test(text));
const summarize = (items) => ({
  total: items.length,
  duplicateH1Groups: repeatedGroups(items, (item) => [item.h1]),
  duplicateTitleGroups: repeatedGroups(items, (item) => [item.title]),
  duplicateDescriptionGroups: repeatedGroups(items, (item) => [item.description]),
  repeatedIntroGroups: repeatedGroups(items, (item) => item.intro),
  repeatedBottomCopyGroups: repeatedGroups(items, (item) => item.editorialSections.flatMap((section) => section.paragraphs)),
  ownKeywordInQuotationMarks: items.filter(ownKeywordQuoted).map((item) => item.path),
  rawTaxonomyStyleCopy: items.filter(rawTaxonomyCopy).map((item) => item.path),
});

const current = summarize(specs);
const before = baseline.length ? summarize(baseline) : null;
const oldByRow = new Map(baseline.map((item) => [item.sourceRow, item]));
const normalizedLabels = specs
  .filter((item) => oldByRow.get(item.sourceRow)?.h1 !== item.h1)
  .map((item) => ({ sourceRow: item.sourceRow, path: item.path, before: oldByRow.get(item.sourceRow)?.h1 || null, after: item.h1 }));

const compact = (report) => report && ({
  total: report.total,
  duplicateH1Groups: report.duplicateH1Groups.length,
  duplicateTitleGroups: report.duplicateTitleGroups.length,
  duplicateDescriptionGroups: report.duplicateDescriptionGroups.length,
  repeatedIntroGroups: report.repeatedIntroGroups.length,
  repeatedBottomCopyGroups: report.repeatedBottomCopyGroups.length,
  ownKeywordInQuotationMarks: report.ownKeywordInQuotationMarks.length,
  rawTaxonomyStyleCopy: report.rawTaxonomyStyleCopy.length,
});

const output = {
  before: compact(before),
  after: compact(current),
  repeatedIntroGroups: current.repeatedIntroGroups,
  repeatedBottomCopyGroups: current.repeatedBottomCopyGroups,
  ownKeywordInQuotationMarks: current.ownKeywordInQuotationMarks,
  rawTaxonomyStyleCopy: current.rawTaxonomyStyleCopy,
  grammaticallyNormalizedLabels: normalizedLabels,
};
console.log(JSON.stringify(output, null, 2));

if (specs.length !== 187 || current.duplicateH1Groups.length || current.duplicateTitleGroups.length
  || current.duplicateDescriptionGroups.length || current.ownKeywordInQuotationMarks.length
  || current.rawTaxonomyStyleCopy.length) process.exitCode = 1;
