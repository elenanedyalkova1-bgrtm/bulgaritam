#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { monitorProduct, productDomain, runDomainThrottled } from "../src/lib/price-monitor/index.mjs";
import { candidateFromMonitorResult, formatVerifiedOfferAmount, offerJsonLd, resolvePublishableOffer } from "../src/lib/verified-offer";

try { process.loadEnvFile?.(); } catch (error: any) { if (error?.code !== "ENOENT") throw error; }
const token = process.env.BASEROW_API_TOKEN; const productsTable = process.env.BASEROW_TABLE_ID || "906650"; const brandsTable = process.env.BASEROW_BRANDS_TABLE_ID || "1133942";
if (!token) throw new Error("BASEROW_API_TOKEN is required");
const output = path.resolve(process.argv.find((value)=>value.startsWith("--output="))?.slice(9) || "reports/verified-offer-canary-20.json");
async function rows(table: string) { const values:any[]=[]; let next:any=`https://api.baserow.io/api/database/rows/table/${table}/?user_field_names=true&size=200`; while(next){const response=await fetch(next,{headers:{Authorization:`Token ${token}`}});if(!response.ok)throw new Error(`Baserow read ${response.status}`);const data=await response.json();values.push(...(data.results||[]));next=data.next;}return values; }
const known = JSON.parse(await fs.readFile("reports/price-monitor-100-after-2026-09-17.json","utf8")).results as any[];
const parseCsv = (raw:string) => { const output:string[][]=[];let row:string[]=[];let value="";let quoted=false;for(let i=0;i<raw.length;i+=1){const char=raw[i];if(char==='"'&&quoted&&raw[i+1]==='"'){value+='"';i+=1;}else if(char==='"')quoted=!quoted;else if(char===','&&!quoted){row.push(value);value="";}else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&raw[i+1]==='\n')i+=1;row.push(value);if(row.some(Boolean))output.push(row);row=[];value="";}else value+=char;}if(value||row.length){row.push(value);output.push(row);}const headers=(output.shift()||[]).map((item)=>item.replace(/^\uFEFF/,""));return output.map((values)=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??""])));};
let products:any[]; let brands:any[];
try { [products, brands] = await Promise.all([rows(productsTable), rows(brandsTable)]); }
catch { const exported=parseCsv(await fs.readFile("bulgaritam_products_reenriched_v2.csv","utf8")); const exportBySlug=new Map(exported.map((item:any)=>[item.slug,item])); products=known.map((item:any)=>{const catalog:any=exportBySlug.get(item.product_slug)||{};return {...catalog,id:item.product_id,slug:item.product_slug,name_bg:item.product_name,brand_name:item.brand_name||catalog.brand_name,product_url:item.product_url,brand_url:catalog.brand_url||`https://${item.domain}/`,price_min_eur:catalog.price_min_eur||null,price_max_eur:catalog.price_max_eur||null,currency:catalog.currency||item.currency||"EUR"};}); brands=[]; }
const brandsById = new Map(brands.map((brand)=>[Number(brand.id),brand]));
const knownIds = known.filter((item)=>item.confidence==="high" && ["json_ld_product_offer","open_graph_product_price","schema_microdata_price"].includes(item.extraction_method)).map((item)=>Number(item.product_id));
const productById = new Map(products.map((product)=>[Number(product.id),product]));
const candidates = [...new Set(knownIds)].map((id)=>productById.get(id)).filter(Boolean).map((product:any)=>{const brand=brandsById.get(Number(product.brand_ref?.[0]?.id))||{};return {...product,product_id:product.id,product_name:product.name_bg,brand_name:brand.brand_name||product.brand_name,brand_url:brand.brand_url||product.brand_url,website_url:brand.brand_url||product.brand_url,domain:productDomain(product.product_url)};});
const attempts:any[]=[]; const accepted:any[]=[];
for(let offset=0;offset<candidates.length&&accepted.length<20;offset+=12){
  const batch=candidates.slice(offset,offset+12);
  const results=await runDomainThrottled(batch,(product:any)=>monitorProduct(product,{timeoutMs:15_000}),{concurrency:4,domainDelayMs:2_000});
  for(let index=0;index<results.length;index+=1){
    const result=results[index]; const product=batch[index]; const candidate=candidateFromMonitorResult(result,product); attempts.push({product_id:product.id,status:result.status,method:result.extraction_method,confidence:result.confidence,eligible:Boolean(candidate)}); if(!candidate||accepted.length>=20)continue;
    const snapshot={...product,offer_price_amount:candidate.amount,offer_price_currency:candidate.currency,offer_price_verified_at:candidate.verifiedAt,offer_price_source:candidate.source,offer_price_source_url:candidate.sourceUrl,offer_price_status:"verified_current"};
    const offer=resolvePublishableOffer(snapshot,new Date(result.checked_at)); if(!offer)continue; const visible=formatVerifiedOfferAmount(offer); const jsonLd=offerJsonLd(offer);
    const visibleAmount=Number((visible.match(/[\d\s.,]+/)?.[0]||"").replace(/\s/g,"").replace(",",".")); const visibleCurrency=visible.match(/\b[A-Z]{3}\b/)?.[0]||"";
    let range={min:product.price_min_eur||null,max:product.price_max_eur||null,currency:product.currency||"EUR"};
    if(range.min==null&&product.slug){try{const built=await fs.readFile(path.resolve("dist/p",product.slug,"index.html"),"utf8");const label=built.match(/meta-item meta-item--price[^>]*>[\s\S]{0,300}?<span class="price"[^>]*>([^<]+)<\/span>/i)?.[1]||"";const values=[...label.matchAll(/\d+(?:[.,]\d+)?/g)].map((match)=>Number(match[0].replace(",",".")));range={min:values[0]??null,max:values[1]??values[0]??null,currency:label.match(/\b[A-Z]{3}\b/)?.[0]||range.currency};}catch{/* build fallback is optional */}}
    accepted.push({product:product.name_bg,product_slug:product.slug,brand:product.brand_name,external_source_url:offer.sourceUrl,existing_orientational_range:range,detected_exact_price:result.detected_price,detected_currency:result.currency,extraction_method:result.extraction_method,confidence:result.confidence,source_evidence:result.evidence,verified_snapshot:{offer_price_amount:snapshot.offer_price_amount,offer_price_currency:snapshot.offer_price_currency,offer_price_verified_at:snapshot.offer_price_verified_at,offer_price_source:snapshot.offer_price_source,offer_price_source_url:snapshot.offer_price_source_url},offer_price_status:snapshot.offer_price_status,rendered_visible_exact_price:visible,resulting_product_json_ld_offer:jsonLd,parity:{price:visibleAmount===Number(jsonLd.price),currency:visibleCurrency===jsonLd.priceCurrency}});
  }
}
if(accepted.length<20)throw new Error(`Only ${accepted.length} eligible live candidates found in bounded canary pool`);
const report={generated_at:new Date().toISOString(),mode:"read-only-local-snapshot",writes_performed:false,requested:20,accepted:accepted.length,all_price_parity:accepted.every((item)=>item.parity.price),all_currency_parity:accepted.every((item)=>item.parity.currency),attempts,products:accepted};
await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify({output,requested:20,accepted:accepted.length,attempted:attempts.length,all_price_parity:report.all_price_parity,all_currency_parity:report.all_currency_parity},null,2));
