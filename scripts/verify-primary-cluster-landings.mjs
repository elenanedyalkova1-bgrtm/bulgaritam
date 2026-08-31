import fs from "node:fs";
import path from "node:path";

const specs = JSON.parse(fs.readFileSync("src/data/primary-cluster-landings.json", "utf8"));
const auditPath = "docs/primary-cluster-seo-audit.csv";
const parseCsv = (text) => { const out=[];let row=[],cell="",q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')q=false;else cell+=c;}else if(c==='"')q=true;else if(c===','){row.push(cell);cell="";}else if(c==='\n'){row.push(cell.replace(/\r$/, ""));out.push(row);row=[];cell="";}else cell+=c;}if(cell||row.length){row.push(cell);out.push(row);}return out;};
const writeCsv = (rows) => rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"','""')}"`).join(",")).join("\n")+"\n";
const normalizeState = (state) => Object.entries(state).filter(([, values]) => values.length).sort(([a],[b]) => a.localeCompare(b)).map(([field, values]) => `${field}=${[...new Set(values.map((value) => String(value).trim().toLowerCase()))].sort().join("|")}`).join("&");
const stateRegistry = new Map(specs.filter((spec) => normalizeState(spec.structuredState)).map((spec) => [normalizeState(spec.structuredState), spec.path]));
const failures = [], results = [], paths = new Set(), states = new Set(), titles = new Map(), descriptions = new Map();
let missingTitle=0, missingDescription=0, missingIntro=0, missingCollapsible=0, h1Violations=0;
const remember = (map, key, value) => { const values=map.get(key)||[];values.push(value);map.set(key,values); };

for (const spec of specs) {
  const file = path.join("dist", spec.path.replace(/^\/+|\/+$/g, ""), "index.html");
  if (!fs.existsSync(file)) { failures.push(`${spec.path}: route missing`); continue; }
  const html = fs.readFileSync(file, "utf8");
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] || "";
  const h1Count = (html.match(/<h1\b/g) || []).length;
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() || "";
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1]?.trim() || "";
  const count = html.match(/id="count"[^>]*>(\d+)</)?.[1] || "0";
  const introReady = (html.match(/class="landing-intro"/g) || []).length > 0;
  const collapsibleReady = (html.match(/class="seo-editorial__card"/g) || []).length > 0;
  if (!canonical.endsWith(spec.path)) failures.push(`${spec.path}: canonical ${canonical}`);
  if (h1Count !== 1) { failures.push(`${spec.path}: ${h1Count} H1 elements`); h1Violations++; }
  if (!title) missingTitle++; else remember(titles,title,spec.path);
  if (!description) missingDescription++; else remember(descriptions,description,spec.path);
  if (!introReady) missingIntro++;
  if (!collapsibleReady) missingCollapsible++;
  if (paths.has(spec.path)) failures.push(`${spec.path}: duplicate path`); paths.add(spec.path);
  const stateKey=normalizeState(spec.structuredState);if(stateKey&&states.has(stateKey))failures.push(`${spec.path}: duplicate exact state`);if(stateKey)states.add(stateKey);
  results.push({ path: spec.path, count });
}

const auditRows=parseCsv(fs.readFileSync(auditPath,"utf8"));const headers=auditRows[0];const pathIndex=headers.indexOf("canonical_url");const countIndex=headers.indexOf("matching_products_count");const counts=new Map(results.map((entry)=>[entry.path,entry.count]));for(const row of auditRows.slice(1)){if(counts.has(row[pathIndex]))row[countIndex]=counts.get(row[pathIndex]);}fs.writeFileSync(auditPath,writeCsv(auditRows));
const representativeRows=[20,32,58,73,80,94,112,133,143,185,187];
const representativeStateTests=representativeRows.map((sourceRow)=>{const spec=specs.find((entry)=>entry.sourceRow===sourceRow);const actual=spec?stateRegistry.get(normalizeState(spec.structuredState))||null:null;return{sourceRow,expected:spec?.path||null,actual,pass:Boolean(spec&&actual===spec.path)};});
const negativeStateTests=[
  {category:["Облекло"],subcategory:["Дамско облекло"],product_type:["Рокли"],colors:["Лилав"]},
  {giftable:["true"],recipient:["За двойка"],recipient_age:["33"]},
  {category:["Аксесоари"],subcategory:["Бижута"],jewelry_detail:["Нерегистриран"]},
].map((state)=>({state,actual:stateRegistry.get(normalizeState(state))||null,pass:!stateRegistry.has(normalizeState(state))}));
const duplicateTitles=[...titles].filter(([,values])=>values.length>1), duplicateDescriptions=[...descriptions].filter(([,values])=>values.length>1);
const normalizedCopy=(value)=>value.toLocaleLowerCase("bg").replace(/[\p{L}\p{N}-]+/gu,"#").replace(/\s+/g," ");
const templateGroups=new Map();for(const spec of specs)remember(templateGroups,normalizedCopy(spec.description),spec.path);const stronglyTemplatedGroups=[...templateGroups].filter(([,values])=>values.length>=5);
const publicHtmlCount=Number(fs.readFileSync("dist/sitemap-0.xml","utf8").match(/<url>/g)?.length||0);
const summary={accepted:specs.length,verified:results.length,sitemapUrlCount:publicHtmlCount,h1Violations,missingTitle,duplicateTitles,missingDescription,duplicateDescriptions,missingIntro,missingCollapsible,duplicateCanonicalPaths:specs.length-paths.size,duplicateSemanticStates:specs.filter(s=>normalizeState(s.structuredState)).length-states.size,stronglyTemplatedGroups:stronglyTemplatedGroups.map(([pattern,urls])=>({pattern,count:urls.length,urls})),representativeStateTests,negativeStateTests,failures};
if(missingTitle||missingDescription||missingIntro||missingCollapsible||duplicateTitles.length||duplicateDescriptions.length||representativeStateTests.some(t=>!t.pass)||negativeStateTests.some(t=>!t.pass))failures.push("SEO content or structured-state verification failed");
fs.writeFileSync("docs/primary-cluster-verification.json",JSON.stringify(summary,null,2)+"\n");console.log(JSON.stringify({...summary,stronglyTemplatedGroups:summary.stronglyTemplatedGroups.map(g=>({count:g.count}))},null,2));if(failures.length)process.exitCode=1;
