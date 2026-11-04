/** Read-only release audit: compare the normalized current catalog and local build with production. */
import fs from 'node:fs';
import path from 'node:path';
import { baserowUrl } from '../src/lib/baserow-url';
import { loadProducts } from '../src/lib/products';
import { brandContactFields, contactMethods } from '../src/lib/brand-contact';
const headers={Authorization:`Token ${process.env.BASEROW_API_TOKEN || ''}`};
async function rows(table:string){
 const result:any[]=[];let next:string|null=`https://api.baserow.io/api/database/rows/table/${table}/?user_field_names=true&size=200`;
 while(next){const response=await fetch(baserowUrl(next),{headers});if(!response.ok)throw Error(`Baserow read ${response.status}`);const page=await response.json();result.push(...page.results);next=page.next;}
 return result;
}
const response=await fetch('https://bulgaritam.bg/deploy-manifest.json');
if(!response.ok)throw Error(`Production manifest ${response.status}`);
const baseline=await response.json();
const [products,rawProducts,brands]=await Promise.all([loadProducts(),rows(process.env.BASEROW_TABLE_ID||'906650'),rows(process.env.BASEROW_BRANDS_TABLE_ID||'1133942')]);
const oldProducts=new Set<string>(baseline.product_paths),oldBrands=new Set<string>(baseline.brand_paths);
const productPaths=new Set(products.map(p=>`/p/${p.slug}/`));
const brandSlugs=new Set(products.map(p=>p.brand_slug).filter(Boolean));
const brandPaths=new Set([...brandSlugs].map(slug=>`/brand/${slug}/`));
const active=(v:unknown)=>v===true||['true','1','yes','y'].includes(String(v).toLowerCase());
const web=(v:string)=>{try{return ['http:','https:'].includes(new URL(v).protocol);}catch{return false;}};
const newProducts=products.filter(p=>!oldProducts.has(`/p/${p.slug}/`));
const newBrands=brands.filter(b=>brandSlugs.has(b.brand_slug)&&!oldBrands.has(`/brand/${b.brand_slug}/`));
const noSite=products.filter(p=>p.no_site);
const slugGroups=new Map<string,typeof products>();
for(const product of products)slugGroups.set(product.slug,[...(slugGroups.get(product.slug)||[]),product]);
const duplicateSlugs=[...slugGroups].filter(([,rows])=>rows.length>1).map(([slug,rows])=>({slug,products:rows.map(p=>({row_id:p.row_id,product_id:p.id,name:p.name_bg,brand_slug:p.brand_slug}))}));
const eligibleIds=new Set(products.map(p=>p.row_id));
const buildExists=fs.existsSync('dist/index.html');
const missingBuildPaths=buildExists?[...productPaths,...brandPaths].filter(route=>!fs.existsSync(path.join('dist',route,'index.html'))):[];
const noSiteChecks=buildExists?noSite.map(p=>{
 const file=path.join('dist','p',p.slug,'index.html');const html=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
 const methods=contactMethods(p);
 return {product_id:p.row_id,slug:p.slug,brand_id:p.brand_id,has_available_contact:methods.available,has_email:Boolean(methods.email),inquiry_rendered:html.includes('data-inquiry-open'),email_copy_rendered:html.includes('data-copy-email='),online_offer_present:/"offers"\s*:/.test(html),brand_profile_generated:fs.existsSync(path.join('dist','brand',p.brand_slug,'index.html'))};
}):[];
const report={checked_at:new Date().toISOString(),baseline:{commit:baseline.commit,generated_at:baseline.generated_at,products:baseline.products,brands:baseline.brands,health_excluded_products:baseline.health_excluded_products},
 current:{raw_products:rawProducts.length,raw_brands:brands.length,eligible_products:products.length,unique_product_paths:productPaths.size,published_brands:brandSlugs.size,no_site_products:noSite.length},
 new_products:newProducts.map(p=>({row_id:p.row_id,product_id:p.id,slug:p.slug,brand_slug:p.brand_slug,no_site:Boolean(p.no_site),image_present:Boolean(p.image_urls[0]),outbound_valid:p.no_site?contactMethods(p).available:web(p.product_url)})),
 new_brands:newBrands.map(b=>({row_id:b.id,slug:b.brand_slug,no_site:b.no_site===true})),
 removed_product_paths:[...oldProducts].filter(route=>!productPaths.has(route)),removed_brand_paths:[...oldBrands].filter(route=>!brandPaths.has(route)),
 active_unpublished_brand_slugs:brands.filter(b=>b.is_active===true&&!brandSlugs.has(b.brand_slug)).map(b=>b.brand_slug),
 active_excluded_products:rawProducts.filter(p=>active(p.is_active)&&!eligibleIds.has(Number(p.id))).map(p=>({row_id:p.id,slug:p.slug,brand_ref_ids:(p.brand_ref||[]).map((b:any)=>b.id),missing_identity:!p.slug||!p.name_bg,missing_image:!p.image_urls})),
 invalid_website_product_destinations:products.filter(p=>!p.no_site&&!web(p.product_url)).map(p=>({row_id:p.row_id,slug:p.slug})),
 duplicate_product_slugs:duplicateSlugs,
 local_build_present:buildExists,missing_build_paths:missingBuildPaths,no_site_build_checks:noSiteChecks,
 new_brand_profile_checks:buildExists?newBrands.map(b=>{const file=path.join('dist','brand',b.brand_slug,'index.html');const html=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';return {slug:b.brand_slug,page_exists:Boolean(html),website_cta_present:html.includes('class="visit"'),email_copy_present:html.includes('data-copy-email='),valid_email:Boolean(contactMethods(brandContactFields(b)).email)};}):[]};
fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/no-site-release-catalog.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({baseline:report.baseline,current:report.current,new_products:report.new_products,new_brands:report.new_brands,removed_product_paths:report.removed_product_paths,invalid_website_product_destinations:report.invalid_website_product_destinations,missing_build_paths:missingBuildPaths,no_site_build_checks:noSiteChecks},null,2));
