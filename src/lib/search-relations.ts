import {mentionPolarity} from "./search-evidence-scope";
/** Query-time typed relation reader/resolver. No source-text extraction here. */
import type { RelationClaim } from "./search-relations-build";
import taxonomy from "./search-relation-taxonomy.json";
type Card = { dataset: Record<string, string | undefined> };
export type RequestedAge = {
  min: number;
  max: number | null;
  unit: "years" | "months";
  minInclusive?: boolean;
  maxInclusive?: boolean;
  coverage?: "overlap" | "all";
};
const cache = new WeakMap<object, RelationClaim[]>();
export function discoveryRelations(card: Card): RelationClaim[] {
  const cached = cache.get(card);
  if (cached) return cached;
  let value: RelationClaim[] = [];
  try {
    const data = JSON.parse(card.dataset.sourceEvidence || "null");
    if (
      data?.relationVersion === "discovery-relations-v2" &&
      data.binding && Object.keys(data.binding).length === 7 &&
      ["productId","productSlug","productName","productType","publicCategory","publicSubcategory","materials"].every(k=>typeof data.binding[k]==="string") &&
      Object.entries(data.binding || {}).every(
        ([k, v]) => card.dataset[k] === v,
      ) &&
      Array.isArray(data.relations)
    )
      value = data.relations.filter(
        (r: RelationClaim) =>
          r.productId === card.dataset.productId &&
          r.version === "discovery-relations-v2" &&
          typeof r.text === "string" && r.text.length > 0 &&
          Number.isInteger(r.start) && r.start >= 0 &&
          ["main","component","variant"].includes(r.scope),
      );
  } catch {}
  cache.set(card, value);
  return value;
}
export function relationProof(
  card: Card,
  kind: RelationClaim["kind"],
  concept: string,
) {
  const records = discoveryRelations(card).filter(
    (r) => r.kind === kind && r.concept === concept && r.status === "approved",
  );
  return records.some((r) => r.polarity === "negative")
    ? []
    : records.filter((r) => r.polarity === "positive");
}
export function relatedItem(
  card: Card,
  key: string,
  materials: string[] = [],
  colors: string[] = [],
) {
  // Component color propagation is not implemented: explicit item color stays strict.
  if (colors.length) return false;
  return relationProof(card, "contains_item", key).some((r) =>
    r.scope === "component" && materials.every((m) => Array.isArray(r.materials) && r.materials.includes(m)),
  );
}
export function excludedItemTerms(card: Card, terms: string[]) {
  const chain = ["verizhka", "verizhki", "sindzhir", "sindzhiri", "chain"];
  return (
    terms.some((t) => chain.includes(t)) &&
    discoveryRelations(card).some(
      (r) =>
        r.kind === "contains_item" &&
        r.concept === "chain" &&
        r.polarity === "negative" &&
        r.status === "approved",
    )
  );
}
export function requestedAgesFromFolded(text:string): {age:RequestedAge;text:string;start:number;end:number}[] {
  const re=/(?<![a-z0-9])(?:na\s+(\d{1,4})\s+(godini|godina|mesetsa|mesetsi|mesets)|ot\s+(\d{1,4})\s+do\s+(\d{1,4})\s+(godini|godina|mesetsa|mesetsi)|nad\s+(\d{1,4})\s+(godini|godina|mesetsa|mesetsi)|do\s+(\d{1,4})\s+(godini|godina|mesetsa|mesetsi))(?=\s|$)/g;
  const out:{age:RequestedAge;text:string;start:number;end:number}[]=[];
  for(const m of text.matchAll(re)) {
    const u=m[2]||m[5]||m[7]||m[9],unit=u.startsWith("mes")?"months":"years";
    const min=Number(m[1]||m[3]||m[6]||0),max=m[6]?null:Number(m[1]||m[4]||m[8]);
    if(max!==null&&(min>max||max>(unit==="months"?1440:120)))continue;
    out.push({age:{min,max,unit,...(m[6]?{minInclusive:false}:{}),...((m[3]||m[6]||m[8])?{coverage:/(?:za vsichki vazrasti|za vsyaka vazrast|all ages|every age)/.test(text)?"all":"overlap"} :{})},text:m[0],start:m.index!,end:m.index!+m[0].length});
  }
  return out;
}
/** Retained single-clause API; the search parser uses ALL conditions. */
export function requestedAgeFromFolded(text:string) { return requestedAgesFromFolded(text)[0]; }
type Interval={lo:number;hi:number;li:boolean;ui:boolean};
const intersect=(a:Interval,b:Interval):Interval=>({lo:Math.max(a.lo,b.lo),hi:Math.min(a.hi,b.hi),li:a.lo>b.lo?a.li:b.lo>a.lo?b.li:a.li&&b.li,ui:a.hi<b.hi?a.ui:b.hi<a.hi?b.ui:a.ui&&b.ui});
const nonempty=(a:Interval)=>a.lo<a.hi||(a.lo===a.hi&&Number.isFinite(a.lo)&&a.li&&a.ui);
const contains=(a:Interval,b:Interval)=>a.lo<=b.lo&&a.hi>=b.hi&&(a.lo!==b.lo||a.li||!b.li)&&(a.hi!==b.hi||a.ui||!b.ui);
export function ageEvidence(card:Card,age:RequestedAge,recipients:string[]):"supported"|"contradicted"|"unknown" {
  const f=age.unit==="years"?12:1;
  const q:Interval={lo:age.min*f,hi:(age.max??Infinity)*f,li:age.minInclusive!==false,ui:age.maxInclusive!==false};
  const interval=(r:RelationClaim):Interval=>{const a=r.age!,f=a.unit==="years"?12:1;return {lo:a.min*f,hi:a.max===9999?Infinity:a.max*f,li:a.minInclusive,ui:a.maxInclusive};};
  const source=q.lo<216?discoveryRelations(card).filter(r=>r.kind==="age"&&r.status==="approved"&&r.age):[];
  const positives=source.filter(r=>r.polarity==="positive").map(interval);
  const negatives=source.filter(r=>r.polarity==="negative").map(interval);
  if(negatives.some(n=>contains(n,q)))return "contradicted";
  const subtract=(a:Interval,b:Interval):Interval[]=>{
    const i=intersect(a,b);if(!nonempty(i))return [a];
    return [{lo:a.lo,hi:i.lo,li:a.li,ui:!i.li},{lo:i.hi,hi:a.hi,li:!i.ui,ui:a.ui}].filter(nonempty);
  };
  if(positives.length) {
    const safe=positives.reduce(intersect);
    const anyOverlap=positives.some(a=>nonempty(intersect(a,q)));
    if(age.coverage==="all"||age.min===age.max) {
      if(contains(safe,q)&&!negatives.some(n=>nonempty(intersect(n,q))))return "supported";
      return anyOverlap?"unknown":"contradicted";
    }
    const overlap=intersect(safe,q);
    const permitted=negatives.reduce((xs,n)=>xs.flatMap(a=>subtract(a,n)),[overlap]);
    if(permitted.some(nonempty))return "supported";
    return anyOverlap?"unknown":"contradicted";
  }
  const requested=recipients.length?recipients:String(card.dataset.recipients||"").split("|");
  const canonical=requested.flatMap(r=>(taxonomy.ages as Record<string,string[]>)[r]||[]);
  const values=String(card.dataset.recipientAge||"").split("|").filter(v=>canonical.includes(v)).map(v=>Number(v)*12);
  const supported=values.filter(v=>contains(q,{lo:v,hi:v,li:true,ui:true})&&!negatives.some(n=>contains(n,{lo:v,hi:v,li:true,ui:true})));
  if(age.coverage==="all"&&q.lo!==q.hi)return "unknown";
  return supported.length?"supported":"unknown";
}
export function occasionEvidence(
  card: Card,
  concept: string,
  legacyTerms: string[],
) {
  if (relationProof(card, "occasion", concept).length) return true;
  const raw = String(card.dataset.searchRaw || "").toLocaleLowerCase("bg");
  // Legacy text retrieval is retained by the caller's original lexical token rules.
  return (
    legacyTerms.length > 0 &&
    legacyTerms.every((t) =>
      new RegExp(`(?<![\\p{L}\\p{N}])${t}(?![\\p{L}\\p{N}])`, "iu").test(raw),
    )
  );
}

const legacyRoleCache = new WeakMap<object,boolean>();
export function roleEvidence(card:Card,concept:string) {
  const claims=discoveryRelations(card).filter(r=>r.kind==="role"&&r.concept===concept);
  if(claims.some(r=>r.status==="approved"&&r.polarity==="negative"))return false;
  if(relationProof(card,"role",concept).length)return true;
  const cached=legacyRoleCache.get(card);if(cached!==undefined)return cached;
  const raw=String(card.dataset.searchRaw||"");
  const pattern=/(?<!\p{L})учител(?:ка|ката|я|и|ите)?(?!\p{L})/iu;
  const result=pattern.test(raw)&&mentionPolarity(raw,pattern)!=="negative";
  legacyRoleCache.set(card,result);return result;
}
