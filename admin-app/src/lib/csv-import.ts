import { BRANDS_TABLE, PRODUCTS_TABLE, createRow, listRows, updateRow } from "./baserow";

export const CSV_COLUMNS = [
  "product_id","legacy_product_id","name_bg","brand_ref","brand_slug","slug","category","tags",
  "price_min_eur","price_max_eur","currency","short_desc_bg","long_desc_bg","product_url","image_urls",
  "is_active","meta_title_bg","meta_desc_bg","rating","created_at",
] as const;

const EDITABLE = ["name_bg","slug","category","tags","price_min_eur","price_max_eur","currency","short_desc_bg","long_desc_bg","product_url","image_urls","meta_title_bg","meta_desc_bg","rating","created_at"] as const;
type CsvRow = Record<string, string>;
export type ImportItem = { line:number; action:"create"|"update"|"unchanged"|"invalid"; row:CsvRow; productId?:number; brandId?:number; errors:string[]; warnings:string[]; fields?:Record<string,unknown> };
export type ImportPlan = { total:number; created:number; updated:number; unchanged:number; invalid:number; unknownBrands:string[]; duplicateSlugs:string[]; missingRequired:number; warnings:string[]; items:ImportItem[] };

export function parseCsv(source: string): CsvRow[] {
  const matrix:string[][]=[]; let row:string[]=[]; let cell=""; let quoted=false;
  const text=source.replace(/^\uFEFF/, "");
  for(let i=0;i<text.length;i++) { const c=text[i];
    if(quoted){ if(c==='"' && text[i+1]==='"'){cell+='"';i++;} else if(c==='"') quoted=false; else cell+=c; }
    else if(c==='"') quoted=true; else if(c===','){row.push(cell);cell="";} else if(c==='\n'){row.push(cell.replace(/\r$/, ""));matrix.push(row);row=[];cell="";} else cell+=c;
  }
  if(quoted) throw new Error("CSV contains an unclosed quoted value.");
  if(cell || row.length){row.push(cell.replace(/\r$/, ""));matrix.push(row);}
  if(!matrix.length) throw new Error("CSV is empty.");
  const headers=matrix.shift()!.map(v=>v.trim());
  const unknown=headers.filter(h=>h && !CSV_COLUMNS.includes(h as any));
  if(unknown.length) throw new Error(`Unknown CSV columns: ${unknown.join(", ")}`);
  if(new Set(headers).size!==headers.length) throw new Error("CSV contains duplicate column headers.");
  return matrix.filter(values=>values.some(v=>v.trim())).map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]?.trim() ?? ""])));
}

const boolValue=(v:string)=>{const n=v.toLowerCase(); if(["true","1","yes","y"].includes(n)) return "true"; if(["false","0","no","n"].includes(n)) return "false"; return null;};
const normalized=(v:unknown)=>String(v??"").trim();
const linkedId=(v:any)=>Number(v?.[0]?.id || 0);
const validUrl=(v:string)=>{try{const u=new URL(v);return u.protocol==="http:"||u.protocol==="https:";}catch{return false;}};

export async function prepareImport(rows: CsvRow[], fixture?: {products:any[];brands:any[]}): Promise<ImportPlan> {
  const [products,brands]=fixture?[fixture.products,fixture.brands]:await Promise.all([listRows(PRODUCTS_TABLE),listRows(BRANDS_TABLE)]);
  const byId=new Map(products.map(p=>[Number(p.id),p]));
  const bySlug=new Map<string,any>(); for(const p of products){const s=normalized(p.slug);if(s)bySlug.set(s,p);}
  const brandsById=new Map(brands.map(b=>[Number(b.id),b]));
  const brandsBySlug=new Map(brands.filter(b=>normalized(b.brand_slug)).map(b=>[normalized(b.brand_slug),b]));
  const counts=new Map<string,number>(); rows.forEach(r=>{const s=normalized(r.slug);if(s)counts.set(s,(counts.get(s)||0)+1);});
  const duplicateSlugs=[...counts].filter(([,n])=>n>1).map(([s])=>s);
  const unknown=new Set<string>(); const globalWarnings=new Set<string>(); let missingRequired=0;
  const items:ImportItem[]=rows.map((row,index)=>{
    const errors:string[]=[]; const warnings:string[]=[]; const line=index+2;
    const requestedId=Number(row.product_id || 0); const byRequestedId=requestedId?byId.get(requestedId):undefined; const byRequestedSlug=row.slug?bySlug.get(row.slug):undefined;
    if(row.product_id && (!Number.isInteger(requestedId)||requestedId<=0)) errors.push("product_id must be a positive integer");
    if(requestedId && !byRequestedId) errors.push(`Product ID ${requestedId} does not exist`);
    if(byRequestedId && byRequestedSlug && byRequestedId.id!==byRequestedSlug.id) errors.push("product_id and slug match different Products");
    const existing=byRequestedId || (!row.product_id ? byRequestedSlug : undefined);
    if(duplicateSlugs.includes(row.slug)) errors.push("Duplicate slug in CSV");
    let brand:any; const ref=Number(row.brand_ref||0);
    if(row.brand_ref && (!Number.isInteger(ref)||ref<=0)) errors.push("brand_ref must be a positive integer");
    const refBrand=ref?brandsById.get(ref):undefined; const slugBrand=row.brand_slug?brandsBySlug.get(row.brand_slug):undefined;
    if(ref && !refBrand){errors.push(`Unknown Brand ID ${ref}`);unknown.add(row.brand_ref);}
    if(row.brand_slug && !slugBrand){errors.push(`Unknown Brand slug ${row.brand_slug}`);unknown.add(row.brand_slug);}
    if(refBrand && slugBrand && refBrand.id!==slugBrand.id) errors.push("brand_ref and brand_slug match different Brands");
    brand=refBrand||slugBrand||(existing?brandsById.get(linkedId(existing.brand_ref)):undefined);
    const merged=(key:string)=>Object.hasOwn(row,key)?row[key]:normalized(existing?.[key]);
    const required=["name_bg","slug","product_url"].filter(k=>!merged(k)); if(!brand)required.push("brand");
    if(required.length){errors.push(`Missing required: ${required.join(", ")}`);missingRequired++;}
    const slug=merged("slug"); if(slug&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))errors.push("Invalid slug");
    const url=merged("product_url");if(url&&!validUrl(url))errors.push("Invalid product_url");
    for(const key of ["price_min_eur","price_max_eur","rating"]){const v=merged(key);if(v&&!Number.isFinite(Number(v.replace(",","."))))errors.push(`${key} must be numeric`);}
    let active=Object.hasOwn(row,"is_active")?boolValue(row.is_active):boolValue(normalized(existing?.is_active));
    if(Object.hasOwn(row,"is_active")&&active===null)errors.push("is_active must be true or false");
    if(active===null)active="false";
    if(row.legacy_product_id)warnings.push("legacy_product_id is informational and is not used for matching or writing");
    if(!Object.hasOwn(row,"currency") && !existing) warnings.push("currency defaulted to EUR");
    const fields:Record<string,unknown>={};
    for(const key of EDITABLE){ if(Object.hasOwn(row,key)) fields[key]=row[key]; else if(!existing) fields[key]=key==="currency"?"EUR":""; }
    if(!existing&&!normalized(fields.currency))fields.currency="EUR";
    fields.is_active=active; if(brand)fields.brand_ref=[brand.id];
    if(brand){fields.brand_name=brand.brand_name||"";fields.brand_slug=brand.brand_slug||"";fields.brand_url=brand.brand_url||"";fields.intro_bg=brand.description_bg||"";fields.address=brand.address||"";}
    let action:ImportItem["action"]="create";
    if(errors.length)action="invalid"; else if(existing){
      const changed=Object.entries(fields).some(([k,v])=>k==="brand_ref"?linkedId(existing.brand_ref)!==brand.id:normalized(existing[k])!==normalized(v));
      action=changed?"update":"unchanged";
    }
    warnings.forEach(w=>globalWarnings.add(w));
    return {line,action,row,productId:existing?.id,brandId:brand?.id,errors,warnings,fields};
  });
  return {total:items.length,created:items.filter(i=>i.action==="create").length,updated:items.filter(i=>i.action==="update").length,unchanged:items.filter(i=>i.action==="unchanged").length,invalid:items.filter(i=>i.action==="invalid").length,unknownBrands:[...unknown],duplicateSlugs,missingRequired,warnings:[...globalWarnings],items};
}

export async function executeImport(plan: ImportPlan) {
  const result={created:0,updated:0,skipped:0,failed:0,warnings:[...plan.warnings],errors:[] as string[]};
  const products=await listRows(PRODUCTS_TABLE); let nextLegacy=Math.max(0,...products.map(p=>Number(p["id 2"])).filter(Number.isFinite))+1;
  for(const item of plan.items){
    if(item.action==="invalid"||item.action==="unchanged"){result.skipped++;continue;}
    try{const fields={...(item.fields||{})}; if(item.action==="create"){fields["id 2"]=String(nextLegacy++);if(!fields.created_at)fields.created_at=new Date().toISOString();await createRow(PRODUCTS_TABLE,fields);result.created++;}else{await updateRow(PRODUCTS_TABLE,item.productId!,fields);result.updated++;}}
    catch(error){result.failed++;result.errors.push(`Line ${item.line}: ${error instanceof Error?error.message:"Import failed"}`);}
  }
  return result;
}

export const csvTemplate = () => `${CSV_COLUMNS.join(",")}\n,,Example product,,existing-brand-slug,example-product,Category,"tag one, tag two",10,15,EUR,Short description,Long description,https://merchant.example/product,https://merchant.example/image.jpg,false,SEO title,SEO description,5,\n`;
