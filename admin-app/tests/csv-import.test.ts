import assert from "node:assert/strict";
import { parseCsv, prepareImport } from "../src/lib/csv-import";

const brands=[{id:10,brand_name:"Known Brand",brand_slug:"known-brand",brand_url:"https://brand.example",description_bg:"Story",address:"Sofia"}];
const products=[{id:100,"id 2":"7",name_bg:"Existing",slug:"existing",product_url:"https://brand.example/old",currency:"EUR",is_active:"true",brand_ref:[{id:10}],brand_name:"Known Brand",brand_slug:"known-brand",brand_url:"https://brand.example",intro_bg:"Story",address:"Sofia"}];
const csv=`product_id,name_bg,brand_slug,slug,product_url,currency,is_active\n100,Existing,known-brand,existing,https://brand.example/new,EUR,true\n,New product,known-brand,new-product,https://brand.example/new-product,,false\n,Bad product,missing-brand,bad-product,https://brand.example/bad,EUR,true\n,Duplicate A,known-brand,duplicate,https://brand.example/a,EUR,true\n,Duplicate B,known-brand,duplicate,https://brand.example/b,EUR,true\n`;
const rows=parseCsv(csv); const plan=await prepareImport(rows,{products,brands});
assert.equal(plan.total,5); assert.equal(plan.updated,1); assert.equal(plan.created,1); assert.equal(plan.invalid,3);
assert.deepEqual(plan.unknownBrands,["missing-brand"]); assert.deepEqual(plan.duplicateSlugs,["duplicate"]);
assert.equal(plan.items[1].fields?.currency,"EUR");
assert.equal(products[0].product_url,"https://brand.example/old", "planning must not mutate fixture data");

const autoBrandRows=parseCsv(`brand_name,brand_slug,brand_url,name_bg,slug,product_url,image_urls,is_active\nNew Canonical Brand,new-canonical-brand,https://new.example,First,first,https://new.example/first,https://new.example/first.jpg,true\nNew Canonical Brand,new-canonical-brand,https://new.example,Second,second,https://new.example/second,https://new.example/second.jpg,true\n`);
const autoBrandPlan=await prepareImport(autoBrandRows,{products:[],brands:[]});
assert.equal(autoBrandPlan.brandsToCreate.length,1);
assert.equal(autoBrandPlan.brandsToCreate[0].products,2);
assert.equal(autoBrandPlan.productsLinked,2);
assert.equal(autoBrandPlan.invalid,0);
console.log("CSV import dry-run test passed: 1 update, 1 create, 3 invalid, 0 writes.");
