#!/usr/bin/env node
try { process.loadEnvFile?.(); } catch (error) { if (error?.code !== "ENOENT") throw error; }
import { classifyDealCategory, DEAL_CATEGORIES, normalizeDealCategory } from "../src/lib/deal-category.mjs";
const write=process.argv.includes("--write"); const observedId=process.env.BASEROW_OBSERVED_PRODUCTS_TABLE_ID; const productsId=process.env.BASEROW_TABLE_ID||"906650";
if(!observedId)throw new Error("BASEROW_OBSERVED_PRODUCTS_TABLE_ID is required");
const authResponse=await fetch("https://api.baserow.io/api/user/token-auth/",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:process.env.BASEROW_SCHEMA_EMAIL,password:process.env.BASEROW_SCHEMA_PASSWORD})});
const auth=await authResponse.json(); const jwt=auth.token||auth.access_token;if(!authResponse.ok||!jwt)throw new Error("Baserow schema authentication failed");
const headers={Authorization:`JWT ${jwt}`,"Content-Type":"application/json"};
const request=async(url,init={})=>{const response=await fetch(url,{...init,headers});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`Baserow ${response.status}: ${JSON.stringify(body).slice(0,400)}`);return body;};
async function rows(table){let next=`https://api.baserow.io/api/database/rows/table/${table}/?user_field_names=true&size=200`,out=[];while(next){const url=new URL(next);url.protocol="https:";const page=await request(url);out.push(...(page.results||[]));next=page.next;}return out;}
const [observed,products,fields]=await Promise.all([rows(observedId),rows(productsId),request(`https://api.baserow.io/api/database/fields/table/${observedId}/`)]);
if(write&&!fields.some((field)=>field.name==="deal_category"&&field.type==="text"))throw new Error("deal_category text field is missing; refusing backfill");
const byId=new Map(products.map((row)=>[String(row.id),row]));const active=(value)=>value===true||String(value).toLowerCase()==="true"||String(value)==="1";
const audited=observed.filter((row)=>active(row.is_active)).map((row)=>{const product=byId.get(String(row.bulgaritam_product_id||""));const result=classifyDealCategory({catalog_category:product?.category,title:row.title,product_url:row.canonical_url||row.source_url});return {id:row.id,title:row.title,catalog_matched:Boolean(product),...result,current:normalizeDealCategory(row.deal_category)};});
const changes=audited.filter((row)=>row.current!==row.category).map((row)=>({id:row.id,deal_category:row.category}));
if(write)for(let index=0;index<changes.length;index+=200)await request(`https://api.baserow.io/api/database/rows/table/${observedId}/batch/?user_field_names=true`,{method:"PATCH",body:JSON.stringify({items:changes.slice(index,index+200)})});
const distribution=Object.fromEntries(DEAL_CATEGORIES.map((category)=>[category,audited.filter((row)=>row.category===category).length]));
console.log(JSON.stringify({mode:write?"write":"dry-run",writes_performed:write,active:audited.length,classified:audited.filter((row)=>row.category).length,null:audited.filter((row)=>!row.category).length,questionable:audited.filter((row)=>row.state==="QUESTIONABLE").length,coverage_percent:+(100*audited.filter((row)=>row.category).length/audited.length).toFixed(2),catalog_matched:audited.filter((row)=>row.catalog_matched).length,changes:changes.length,distribution},null,2));
