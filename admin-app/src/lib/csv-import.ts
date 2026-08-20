import { BRANDS_TABLE, PRODUCTS_TABLE, createRow, listFields, listRows, updateRow } from "./baserow";

export const CSV_COLUMNS = [
  "product_id","legacy_product_id","brand_name","brand_slug","brand_url","brand_description_bg","brand_logo_url","brand_instagram_url","brand_address",
  "name_bg","slug","product_url","image_urls","category","subcategory","product_type","attributes","gift_occasion","colors","materials","audience","recipient","tags",
  "price_min_eur","price_max_eur","currency","short_desc_bg","long_desc_bg","is_active","meta_title_bg","meta_desc_bg","rating","created_at",
] as const;

const EDITABLE = ["name_bg","slug","category","tags","price_min_eur","price_max_eur","currency","short_desc_bg","long_desc_bg","product_url","image_urls","meta_title_bg","meta_desc_bg","rating","created_at"] as const;
const SINGLE_SELECT = ["subcategory","product_type"] as const;
const MULTI_SELECT = ["attributes","gift_occasion","colors","materials","audience","recipient"] as const;
type CsvRow = Record<string, string>;
type BrandPlan = { key:string; brand_name:string; brand_slug:string; fields:Record<string,unknown>; products:number };
export type ImportItem = { line:number; action:"create"|"update"|"unchanged"|"invalid"; row:CsvRow; productId?:number; brandId?:number; brandKey?:string; errors:string[]; warnings:string[]; fields?:Record<string,unknown> };
export type ImportPlan = { total:number; created:number; updated:number; unchanged:number; invalid:number; unknownBrands:string[]; duplicateSlugs:string[]; missingRequired:number; warnings:string[]; brandsReused:number; brandsToCreate:BrandPlan[]; productsLinked:number; ambiguousRecords:number; malformedBrandRecords:number; items:ImportItem[] };

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
const fold=(v:unknown)=>normalized(v).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("bg").replace(/[^\p{L}\p{N}]+/gu,"");
const validSlug=(v:string)=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const placeholderBrand=(v:string)=>!v||/^(unknown|brand|n\/a|няма|без бранд)$/i.test(v);
const splitSelect=(v:string)=>v.split(/[|;,]/).map(item=>item.trim()).filter(Boolean);

export async function prepareImport(rows: CsvRow[], fixture?: {products:any[];brands:any[];fields?:any[]}): Promise<ImportPlan> {
  const [products,brands,schema]=fixture?[fixture.products,fixture.brands,fixture.fields||[]]:await Promise.all([listRows(PRODUCTS_TABLE),listRows(BRANDS_TABLE),listFields(PRODUCTS_TABLE)]);
  const byId=new Map(products.map(p=>[Number(p.id),p]));
  const bySlug=new Map<string,any>(); for(const p of products){const s=normalized(p.slug);if(s)bySlug.set(s,p);}
  const brandsById=new Map(brands.map(b=>[Number(b.id),b]));
  const brandsBySlug=new Map(brands.filter(b=>normalized(b.brand_slug)).map(b=>[normalized(b.brand_slug),b]));
  const brandsBySafeName=new Map<string,any[]>(); const brandsBySafeSlug=new Map<string,any[]>();
  for(const brand of brands){for(const [map,value] of [[brandsBySafeName,fold(brand.brand_name)],[brandsBySafeSlug,fold(brand.brand_slug)]] as const){if(!value)continue;const list=map.get(value)||[];list.push(brand);map.set(value,list);}}
  const brandPlans=new Map<string,BrandPlan>(); const reusedBrandIds=new Set<number>(); let ambiguousRecords=0;let malformedBrandRecords=0;let productsLinked=0;
  const optionIds=(fieldName:string,raw:string,errors:string[])=>{if(!raw)return [];const field=schema.find((item:any)=>item.name===fieldName);if(!field){errors.push(`Baserow field ${fieldName} is missing`);return [];}return splitSelect(raw).map(value=>{const option=field.select_options?.find((item:any)=>fold(item.value)===fold(value));if(!option)errors.push(`Unknown ${fieldName} option: ${value}`);return option?.id;}).filter(Number.isFinite);};
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
    let brand:any;let brandKey=""; const incomingName=normalized(row.brand_name);const incomingSlug=normalized(row.brand_slug);
    const explicitSlugBrand=incomingSlug?brandsBySlug.get(incomingSlug):undefined;
    const safeCandidates=[...new Map([...(brandsBySafeName.get(fold(incomingName))||[]),...(brandsBySafeSlug.get(fold(incomingSlug))||[])].map(item=>[item.id,item])).values()];
    if(explicitSlugBrand&&!safeCandidates.some(item=>item.id===explicitSlugBrand.id))safeCandidates.push(explicitSlugBrand);
    const existingBrand=existing?brandsById.get(linkedId(existing.brand_ref)):undefined;
    if(existingBrand)brand=existingBrand;
    else if(safeCandidates.length===1){brand=safeCandidates[0];reusedBrandIds.add(Number(brand.id));}
    else if(safeCandidates.length>1){errors.push("Ambiguous Brand identity");ambiguousRecords++;}
    else if(placeholderBrand(incomingName)||!validSlug(incomingSlug)){errors.push("Malformed Brand identity: brand_name and valid brand_slug are required");unknown.add(incomingName||incomingSlug);malformedBrandRecords++;}
    else {
      brandKey=fold(incomingName);const current=brandPlans.get(brandKey);
      if(current&&(current.brand_slug!==incomingSlug||fold(current.brand_name)!==fold(incomingName))){errors.push("Ambiguous Brand identity within CSV");ambiguousRecords++;}
      else if(!current)brandPlans.set(brandKey,{key:brandKey,brand_name:incomingName,brand_slug:incomingSlug,products:0,fields:{brand_name:incomingName,brand_slug:incomingSlug,brand_url:normalized(row.brand_url),description_bg:normalized(row.brand_description_bg),logo_url:normalized(row.brand_logo_url),instagram_url:normalized(row.brand_instagram_url),address:normalized(row.brand_address),is_active:true}});
      const plan=brandPlans.get(brandKey);if(plan)plan.products++;
    }
    const merged=(key:string)=>Object.hasOwn(row,key)?row[key]:normalized(existing?.[key]);
    const required=["name_bg","slug","product_url"].filter(k=>!merged(k)); if(!brand&&!brandKey)required.push("brand");
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
    for(const key of SINGLE_SELECT){if(Object.hasOwn(row,key)){const ids=optionIds(key,row[key],errors);fields[key]=ids[0]||null;}}
    for(const key of MULTI_SELECT){if(Object.hasOwn(row,key))fields[key]=optionIds(key,row[key],errors);}
    if(!existing&&!normalized(fields.currency))fields.currency="EUR";
    fields.is_active=active; if(brand)fields.brand_ref=[brand.id];
    if(brand){fields.brand_name=brand.brand_name||"";fields.brand_slug=brand.brand_slug||"";fields.brand_url=brand.brand_url||"";fields.intro_bg=brand.description_bg||"";fields.address=brand.address||"";}
    else if(brandKey){const planned=brandPlans.get(brandKey)!;fields.brand_name=planned.brand_name;fields.brand_slug=planned.brand_slug;fields.brand_url=planned.fields.brand_url||"";}
    let action:ImportItem["action"]="create";
    if(errors.length)action="invalid"; else if(existing){
      const changed=brandKey?true:Object.entries(fields).some(([k,v])=>k==="brand_ref"?linkedId(existing.brand_ref)!==brand.id:normalized(existing[k])!==normalized(v));
      action=changed?"update":"unchanged";
    }
    if(!errors.length&&(brand||brandKey))productsLinked++;
    warnings.forEach(w=>globalWarnings.add(w));
    return {line,action,row,productId:existing?.id,brandId:brand?.id,brandKey:brandKey||undefined,errors,warnings,fields};
  });
  return {total:items.length,created:items.filter(i=>i.action==="create").length,updated:items.filter(i=>i.action==="update").length,unchanged:items.filter(i=>i.action==="unchanged").length,invalid:items.filter(i=>i.action==="invalid").length,unknownBrands:[...unknown],duplicateSlugs,missingRequired,warnings:[...globalWarnings],brandsReused:reusedBrandIds.size,brandsToCreate:[...brandPlans.values()],productsLinked,ambiguousRecords,malformedBrandRecords,items};
}

export async function executeImport(plan: ImportPlan) {
  const result={created:0,updated:0,skipped:0,failed:0,warnings:[...plan.warnings],errors:[] as string[]};
  const products=await listRows(PRODUCTS_TABLE); let nextLegacy=Math.max(0,...products.map(p=>Number(p["id 2"])).filter(Number.isFinite))+1;
  const resolvedBrands=new Map<string,any>();
  for(const planned of plan.brandsToCreate){
    const latest=await listRows(BRANDS_TABLE);const matches=latest.filter(brand=>fold(brand.brand_name)===fold(planned.brand_name)||fold(brand.brand_slug)===fold(planned.brand_slug));
    if(matches.length>1)throw new Error(`Ambiguous Brand after refresh: ${planned.brand_name}`);
    const brand=matches[0]||await createRow(BRANDS_TABLE,planned.fields);resolvedBrands.set(planned.key,brand);
  }
  for(const item of plan.items){
    if(item.action==="invalid"||item.action==="unchanged"){result.skipped++;continue;}
    try{const fields={...(item.fields||{})};const resolved=item.brandKey?resolvedBrands.get(item.brandKey):null;if(resolved){fields.brand_ref=[resolved.id];fields.brand_name=resolved.brand_name;fields.brand_slug=resolved.brand_slug;fields.brand_url=resolved.brand_url||"";} if(item.action==="create"){fields["id 2"]=String(nextLegacy++);if(!fields.created_at)fields.created_at=new Date().toISOString();await createRow(PRODUCTS_TABLE,fields);result.created++;}else{await updateRow(PRODUCTS_TABLE,item.productId!,fields);result.updated++;}}
    catch(error){result.failed++;result.errors.push(`Line ${item.line}: ${error instanceof Error?error.message:"Import failed"}`);}
  }
  return result;
}

export const csvTemplate = () => `${CSV_COLUMNS.join(",")}\n,,Example Brand,example-brand,https://brand.example,,,,,Example product,example-product,https://brand.example/product,https://brand.example/image.jpg,Category,Subcategory,Product type,Ръчна изработка,Рожден ден,Бежово,Памук,Жени,За жена,"tag one, tag two",10,15,EUR,Short description,Long description,false,SEO title,SEO description,5,\n`;
