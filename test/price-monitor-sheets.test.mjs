import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createGoogleSheetsHistory, derivePrices, deriveTimeline, historyObservation, observationId, PRICE_HISTORY_HEADERS } from "../src/lib/price-monitor/index.mjs";
import { DERIVED_SHEET_FORMULAS, observationRow } from "../src/lib/price-monitor/google-sheets-history.mjs";

const result = (overrides={}) => ({ product_id: "p1", product_name: "Product", brand_name: "Brand", product_url: "https://brand.test/p", checked_at: "2026-09-01T10:00:00Z", detected_price: 65, currency: "EUR", status: "verified", extraction_method: "json_ld_product_offer", confidence: "high", previous_offer_price: 60, currency_mismatch: false, ...overrides });

test("history observation has stable identity and never contains range fields",()=>{
  const one=historyObservation(result()); const two=historyObservation(result()); assert.equal(one.observation_id,two.observation_id); assert.equal(one.difference,5);
  assert.equal("price_min_eur" in one,false); assert.equal("price_max_eur" in one,false); assert.deepEqual(Object.keys(one),PRICE_HISTORY_HEADERS);
});

test("missing and non-positive detected prices remain null and cannot create differences",()=>{
  for(const detected_price of [null,undefined,"",0,-1,Number.NaN,"not-a-number"]){
    const observation=historyObservation(result({detected_price,previous_offer_price:49,status:"not_detected",confidence:null}));
    assert.equal(observation.detected_price,null,`detected ${String(detected_price)} must stay missing`);
    assert.equal(observation.previous_verified_price,49);
    assert.equal(observation.difference,null);
    assert.equal(observationRow(observation)[5],"");
    assert.equal(observationRow(observation)[11],"");
  }
});

test("valid positive prices preserve same, increase, and decrease differences",()=>{
  assert.deepEqual(
    [
      historyObservation(result({detected_price:49,previous_offer_price:49})),
      historyObservation(result({detected_price:59,previous_offer_price:49,status:"changed"})),
      historyObservation(result({detected_price:49,previous_offer_price:59,status:"changed"})),
    ].map(({detected_price,previous_verified_price,difference})=>({detected_price,previous_verified_price,difference})),
    [
      {detected_price:49,previous_verified_price:49,difference:0},
      {detected_price:59,previous_verified_price:49,difference:10},
      {detected_price:49,previous_verified_price:59,difference:-10},
    ],
  );
});

test("history observation appends a validated regular-price pair and serialized evidence",()=>{
  const observation=historyObservation(result({regular_price:79,regular_price_currency:"EUR",regular_price_method:"woocommerce_del_ins",regular_price_evidence:{path:"product.price.del"}}));
  assert.equal(observation.regular_price,79); assert.equal(observation.regular_price_currency,"EUR");
  assert.equal(observation.regular_price_method,"woocommerce_del_ins"); assert.equal(observation.regular_price_evidence,'{"path":"product.price.del"}');
  assert.equal(PRICE_HISTORY_HEADERS.indexOf("observation_id"),12); assert.deepEqual(PRICE_HISTORY_HEADERS.slice(13),["regular_price","regular_price_currency","regular_price_method","regular_price_evidence"]);
});

test("history drops invalid and currency-mismatched regular prices",()=>{
  const notHigher=historyObservation(result({regular_price:60,regular_price_currency:"EUR",regular_price_method:"test"}));
  const mismatch=historyObservation(result({regular_price:79,regular_price_currency:"BGN",regular_price_method:"test"}));
  assert.equal(notHigher.regular_price,null); assert.equal(mismatch.regular_price,null);
});

test("repeated checks are separate observations and sorting cannot change product identity",()=>{
  const first=historyObservation(result()); const second=historyObservation(result({checked_at:"2026-09-15T10:00:00Z",detected_price:52}));
  assert.notEqual(first.observation_id,second.observation_id); const mixed=[historyObservation(result({product_id:"p2",product_name:"Other",detected_price:89})),second,first].reverse();
  const prices=derivePrices(mixed); assert.equal(prices.length,2); const p1=prices.find(row=>row.product_id==="p1"); assert.equal(p1.current_detected_price,52); assert.equal(p1.previous_detected_price,65); assert.equal(p1.difference,-13); assert.equal(p1.copy_price,52);
});

test("unchanged weekly prices and a later change each append a distinct observation",async()=>{
  const checks=[
    result({checked_at:"2026-09-01T10:00:00Z",detected_price:89,previous_offer_price:89}),
    result({checked_at:"2026-09-08T10:00:00Z",detected_price:89,previous_offer_price:89}),
    result({checked_at:"2026-09-15T10:00:00Z",detected_price:89,previous_offer_price:89}),
    result({checked_at:"2026-09-22T10:00:00Z",detected_price:69,previous_offer_price:89,status:"changed"}),
  ];
  const calls=[];
  const fetchImpl=async(url,init={})=>{calls.push({url,init});if(url.includes("M2%3AM"))return new Response(JSON.stringify({values:[]}),{status:200});return new Response(JSON.stringify({updates:{updatedRows:4}}),{status:200});};
  const writer=createGoogleSheetsHistory({spreadsheetId:"sheet",serviceAccountEmail:"service@test",privateKey:"key",fetchImpl,tokenProvider:async()=>"token"});
  const output=await writer.append(checks); assert.equal(output.appended,4); assert.equal(new Set(output.observation_ids).size,4);
  const body=JSON.parse(calls.find(call=>call.url.includes(":append")).init.body);
  assert.deepEqual(body.values.map(row=>row[5]),[89,89,89,69]);
});

test("unreliable observation updates status but not current detected price",()=>{
  const rows=[historyObservation(result()),historyObservation(result({checked_at:"2026-09-16T10:00:00Z",detected_price:null,status:"blocked",confidence:null,extraction_method:null}))];
  const current=derivePrices(rows)[0]; assert.equal(current.status,"blocked"); assert.equal(current.current_detected_price,65); assert.equal(current.copy_price,65);
});

test("derived Prices ignores legacy verified/high and changed/high zero observations",()=>{
  const legacyZero=(status,checked_at)=>({
    ...historyObservation(result({checked_at,detected_price:49,status})),
    detected_price:0,confidence:"high",status,
  });
  const rows=[
    legacyZero("verified","2026-09-01T10:00:00Z"),
    legacyZero("changed","2026-09-08T10:00:00Z"),
    historyObservation(result({checked_at:"2026-09-15T10:00:00Z",detected_price:65})),
  ];
  const current=derivePrices(rows)[0];
  assert.equal(current.current_detected_price,65);
  assert.equal(current.previous_detected_price,null);
  assert.equal(current.difference,null);
});

test("timeline is regenerated from history by product_id and date",()=>{
  const rows=[historyObservation(result()),historyObservation(result({checked_at:"2026-09-15T10:00:00Z",detected_price:52})),historyObservation(result({product_id:"p2",product_name:"Other",checked_at:"2026-09-15T11:00:00Z",detected_price:89}))];
  const timeline=deriveTimeline(rows); assert.deepEqual(timeline.periods,["2026-09-01","2026-09-15"]); assert.deepEqual(timeline.rows.find(row=>row.product_id==="p1").values,{"2026-09-01":65,"2026-09-15":52});
});

test("Sheets append is append-only and idempotent by observation_id",async()=>{
  const calls=[]; const firstId=observationId(result());
  const fetchImpl=async(url,init={})=>{calls.push({url,init});if(url.includes("M2%3AM"))return new Response(JSON.stringify({values:[[firstId]]}),{status:200});return new Response(JSON.stringify({updates:{updatedRows:1}}),{status:200});};
  const writer=createGoogleSheetsHistory({spreadsheetId:"sheet",serviceAccountEmail:"service@test",privateKey:"key",fetchImpl,tokenProvider:async()=>"token"});
  const output=await writer.append([result(),result({checked_at:"2026-09-15T10:00:00Z"})]); assert.equal(output.appended,1); assert.equal(output.duplicates,1);
  const append=calls.find(call=>call.url.includes(":append")); assert.equal(append.init.method,"POST"); assert.match(append.url,/insertDataOption=OVERWRITE/); const body=JSON.parse(append.init.body); assert.equal(body.values.length,1); assert.equal(body.values[0][1],"p1");
  assert.match(append.url,/A%3AQ/); assert.equal(body.values[0].length,17);
});

test("timeline pivots the date portion of each observation timestamp",()=>{
  assert.match(DERIVED_SHEET_FORMULAS.timeline.A1,/ARRAYFORMULA\(IF\('Price History'!A2:A="","",LEFT\('Price History'!A2:A,10\)\)\)/);
});

test("derived Sheets formulas require positive detected prices",()=>{
  for(const cell of ["E2","F2","H2","K2","L2"]){
    assert.match(DERIVED_SHEET_FORMULAS.prices[cell],/'Price History'!F\$2:F>0/);
  }
  assert.match(DERIVED_SHEET_FORMULAS.timeline.A1,/Col5 > 0/);
  assert.doesNotMatch(DERIVED_SHEET_FORMULAS.timeline.A1,/Col5 is not null/);
});

test("last checked formula sorts ISO timestamps instead of applying numeric MAX",()=>{
  assert.match(DERIVED_SHEET_FORMULAS.prices.I2,/INDEX\(SORT\(FILTER\('Price History'!A\$2:A/);
  assert.doesNotMatch(DERIVED_SHEET_FORMULAS.prices.I2,/MAX\(/);
});

test("monitoring workflow has no build or deploy trigger",()=>{
  const workflow=fs.readFileSync(".github/workflows/price-monitor.yml","utf8"); assert.doesNotMatch(workflow,/npm run build|publish-public|ftp|deploy/i);
});
