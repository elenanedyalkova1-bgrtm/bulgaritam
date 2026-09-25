import assert from "node:assert/strict";
import { filterAndSortPriceHealthRows, normalizePriceHealthRow, priceHealthOverview } from "../src/lib/price-health";

const now = Date.parse("2026-09-17T12:00:00Z");
const products = [
  { id:1,name_bg:"Changed",brand_name:"A",product_url:"https://a.test/p",offer_price_amount:"59",offer_price_currency:"EUR",price_detected_amount:"65",price_detected_currency:"EUR",price_check_status:{value:"changed"},price_confidence:{value:"high"},price_extraction_method:"json_ld_product_offer",price_last_checked_at:"2026-09-17T10:00:00Z",brand_ref:[{id:10}] },
  { id:2,name_bg:"Verified",brand_name:"B",product_url:"https://b.test/p",offer_price_amount:"20",offer_price_currency:"EUR",price_detected_amount:"20",price_detected_currency:"EUR",price_check_status:"verified",price_confidence:"high",price_last_checked_at:"2026-09-01T10:00:00Z",brand_ref:[{id:20}] },
  { id:3,name_bg:"Blocked",brand_name:"A",product_url:"https://a.test/b",price_check_status:"blocked",price_last_checked_at:"2026-09-17T11:00:00Z",brand_ref:[{id:10}] },
  { id:4,name_bg:"Never",brand_name:"C",product_url:"https://c.test/p" },
];
const rows = products.map((product) => normalizePriceHealthRow(product));
assert.equal(rows[0].difference, 6, "difference requires matching currencies");
assert.equal(normalizePriceHealthRow({...products[0],price_detected_currency:"BGN"}).difference, null, "currency mismatch is not numerically compared");
assert.deepEqual(priceHealthOverview(rows,{now,staleDays:7}),{totalMonitored:3,verified:1,changed:1,needsReview:0,notDetected:0,blocked:1,deadUrls:0,redirected:0,notCheckedRecently:1,neverChecked:1});
assert.deepEqual(filterAndSortPriceHealthRows(rows,{status:"changed",now}).map((row)=>row.id),[1]);
assert.deepEqual(filterAndSortPriceHealthRows(rows,{brandId:10,confidence:"high",now}).map((row)=>row.id),[1]);
assert.deepEqual(filterAndSortPriceHealthRows(rows,{checked:"stale",now,staleDays:7}).map((row)=>row.id),[2]);
assert.deepEqual(filterAndSortPriceHealthRows(rows,{sort:"largest_difference",now}).map((row)=>row.id),[1,2,3,4]);
assert.deepEqual(filterAndSortPriceHealthRows(rows,{sort:"oldest_verification",now}).map((row)=>row.id).slice(0,1),[2]);
console.log("Price Health tests passed.");
