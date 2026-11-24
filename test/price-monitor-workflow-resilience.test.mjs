import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const key = crypto.generateKeyPairSync("rsa", {modulusLength:1024}).privateKey.export({type:"pkcs8",format:"pem"});
function run(failure = "", command = "monitor") {
  const output = `/tmp/price-monitor-fixture-${process.pid}-${failure || command}.json`;
  const env = { ...process.env, EXTERNAL_MONITORING_ENABLED:"true", BASEROW_API_TOKEN:"mock", BASEROW_BRANDS_TABLE_ID:"1", BASEROW_TABLE_ID:"2", BASEROW_OBSERVED_PRODUCTS_TABLE_ID:"3", GOOGLE_PRICE_MONITOR_SPREADSHEET_ID:"mock", GOOGLE_SERVICE_ACCOUNT_EMAIL:"mock@example.test", GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:key, MOCK_INTERNAL_FAILURE:failure };
  const args=["--import", "./test/fixtures/external-monitor-fetch-mock.mjs", "scripts/run-external-price-monitor.mjs", command, `--output=${output}`]; if(command==="monitor")args.push("--write-monitor-results");
  const child = spawnSync(process.execPath, args, { env, encoding:"utf8", timeout:30000 });
  const report = JSON.parse(fs.readFileSync(output,"utf8")); fs.unlinkSync(output); return { child, report };
}
test("external failures do not stop other products or history persistence", () => {
  const {child,report} = run(); assert.equal(child.status,0,child.stderr); assert.equal(report.monitoring.checked,4);
  assert.deepEqual(new Set(report.monitoring.results.map((r)=>r.status)),new Set(["verified","blocked","error","dead_url"]));
  assert.equal(report.monitoring.history.appended,4); assert.equal(report.errors.length,0); assert.equal(report.views.sheets_requests,3);
});
test("discovery skips blocked and timed-out brands and continues", () => {
  const {child,report}=run("", "discover"); assert.equal(child.status,0,child.stderr); assert.equal(report.errors.length,0);
  assert.ok(report.discovery.some((x)=>x.brand==="blocked" && x.status==="blocked"));
  assert.ok(report.discovery.some((x)=>x.brand==="timeout" && x.status==="blocked"));
  assert.ok(report.discovery.some((x)=>x.brand==="ok" && x.status==="success"));
});
test("internal Sheets persistence failure remains fatal and produces summary", () => {
  const {child,report} = run("sheets"); assert.notEqual(child.status,0); assert.ok(report.errors.some((x)=>x.stage==="monitoring_history_persistence")); assert.equal(report.views.sheets_requests,3);
});
test("internal Baserow failures remain fatal while other processing reaches a summary", () => {
  const {child,report} = run("baserow"); assert.notEqual(child.status,0); assert.ok(report.errors.some((x)=>x.stage==="observed_product_persistence")); assert.equal(report.monitoring.checked,4);
});
