import test from "node:test";
import assert from "node:assert/strict";
import { deriveMaterializedViews, viewBatchRequests } from "../src/lib/price-monitor/materialized-views.mjs";

test("catalog matches and external products have one row and latest reliable daily prices", () => {
  const base = { checked_at:"2026-11-23T09:00:00Z", brand:"Brand", product_url:"https://brand.test/one", detected_price:20, currency:"EUR", status:"verified", confidence:"high" };
  const history = [
    {...base, product_id:"10", product_name:"Catalog"},
    {...base, entity_type:"observed_product", entity_id:"7", checked_at:"2026-11-23T12:00:00Z", detected_price:15},
    {...base, entity_type:"observed_product", entity_id:"7", checked_at:"2026-11-23T13:00:00Z", detected_price:1,status:"ambiguous"},
    {...base, entity_type:"observed_product", entity_id:"8", product_url:"https://brand.test/two", checked_at:"2026-11-22T12:00:00Z", detected_price:30},
  ];
  const v=deriveMaterializedViews(history,[{id:7,source_url:"https://brand.test/one",bulgaritam_product_id:"10",title:"Catalog"},{id:8,source_url:"https://brand.test/two",title:"External"}]);
  assert.equal(v.product_count,2);
  const c=v.prices.find((r)=>r[0]==="catalog:10"); assert.equal(c[4],15); assert.equal(c[9],"ambiguous");
  const ext=v.prices.find((r)=>r[0]==="observed:8"); assert.equal(ext[1],"External"); assert.equal(ext[4],30);
  const row=v.timeline.find((r)=>r[0]==="catalog:10"); assert.equal(row[v.timeline[0].indexOf("2026-11-23")],"15 EUR");
});

test("ambiguous catalog URL does not select an arbitrary catalog product", () => {
  const r={checked_at:"2026-11-23T09:00:00Z",product_url:"https://brand.test/p",detected_price:9,currency:"EUR",status:"verified",confidence:"high"};
  const v=deriveMaterializedViews([{...r,product_id:"1"},{...r,product_id:"2"},{...r,entity_type:"observed_product",entity_id:"3"}]);
  assert.equal(v.product_count,3); assert.ok(v.prices.some((x)=>x[0]==="observed:3"));
});

test("both view replacements are included in one atomic Sheets batch", () => {
  const metadata={sheets:[{properties:{title:"Prices",sheetId:1,gridProperties:{rowCount:2,columnCount:13}}},{properties:{title:"Price Timeline",sheetId:2,gridProperties:{rowCount:2,columnCount:5}}}]};
  const req=viewBatchRequests(metadata,{prices:[["id"],["one"],["two"]],timeline:[["id"],["one"],["two"]]});
  assert.equal(req.filter((x)=>x.updateCells).length,2); assert.equal(req.filter((x)=>x.repeatCell).length,2);
});
