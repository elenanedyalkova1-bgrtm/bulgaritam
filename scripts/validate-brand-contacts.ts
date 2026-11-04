/** Read-only Baserow data quality audit. Does not create or update fields/rows. */
import fs from 'node:fs';
import { brandContactFields, contactMethods, contactQualityIssue } from '../src/lib/brand-contact';
const token = process.env.BASEROW_API_TOKEN;
if (!token) throw new Error('Missing BASEROW_API_TOKEN');
const table = process.env.BASEROW_BRANDS_TABLE_ID || '1133942';
const headers = {Authorization:`Token ${token}`};
const schemaResponse = await fetch(`https://api.baserow.io/api/database/fields/table/${table}/`,{headers});
if(!schemaResponse.ok)throw new Error(`Schema read failed: ${schemaResponse.status}`);
const fields = (await schemaResponse.json()).map((f:any)=>({name:f.name,type:f.type}));
const rows:any[]=[];
let next:string|null=`https://api.baserow.io/api/database/rows/table/${table}/?user_field_names=true&size=200`;
while(next){const r=await fetch(next,{headers});if(!r.ok)throw new Error(`Brand read failed: ${r.status}`);const d=await r.json();rows.push(...d.results);next=d.next;}
const emailField = fields.find((field:any)=>field.name === "email");
const populatedEmails = rows.filter(row=>String(row.email || "").trim());
const usableEmails = rows.filter(row=>contactMethods(brandContactFields(row)).email);
const report={checked_at:new Date().toISOString(),schema:fields,brands:rows.length,no_site_brands:rows.filter(r=>r.no_site===true).length,
 email_pipeline: {field_exists:Boolean(emailField),field_type:emailField?.type || null,
 recognized_as_string:!emailField || ['email','text','long_text'].includes(emailField.type),
 populated_brands:populatedEmails.length,usable_email_brands:usableEmails.length,
 no_site_with_usable_email:usableEmails.filter(row=>row.no_site===true).length,
 invalid_email_brand_ids:populatedEmails.filter(row=>!contactMethods(brandContactFields(row)).email).map(row=>row.id)},
 missing_fields:['no_site','email'].filter(name=>!fields.some((f:any)=>f.name===name)),
 issues:rows.filter(r=>r.is_active===true).flatMap(r=>{const issue=contactQualityIssue(brandContactFields(r));return issue?[{brand_id:r.id,brand_slug:r.brand_slug,issue}]:[]}),
 publication_warnings:rows.filter(row=>row.is_active===true && row.no_site===true && Array.isArray(row.products) && row.products.length===0).map(row=>({brand_id:row.id,brand_slug:row.brand_slug,issue:'no_site_without_linked_products',impact:'Existing product-derived routing cannot generate a brand profile or product inquiry page until a publishable product is linked.'})),
 retail_types:['Магазин','Шоурум'], notes:[emailField ? 'Brands.email exists and is read by shared brandContactFields normalization and the linked product pipeline.' : 'Brands.email is missing; email contact options cannot appear until it is manually added.','Office, production, workshop and atelier addresses do not imply customer-facing retail.']};
fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/no-site-data-quality.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({brands:report.brands,no_site_brands:report.no_site_brands,missing_fields:report.missing_fields,email_pipeline:report.email_pipeline,publication_warnings:report.publication_warnings,issues:report.issues}));
