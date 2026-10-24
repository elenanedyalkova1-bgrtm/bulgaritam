/** Scope and polarity of a named concept; never borrow another item's negation. */
export function clauses(text:string): {text:string;start:number}[] {
  const out:{text:string;start:number}[]=[];
  const boundary=/[;.!?](?!\d)|,\s*(?:а|но|обаче)\s+/giu;
  let start=0;
  for(const m of text.matchAll(boundary)){out.push({text:text.slice(start,m.index),start});start=m.index!+m[0].length;}
  out.push({text:text.slice(start),start});return out;
}
export function negativeClause(text:string) {
  return /(?<!\p{L})(?:не(?:\s+и)?|неподходящ[аои]?)(?!\p{L})/iu.test(text);
}
export function mentionPolarity(text:string,re:RegExp): 'positive'|'negative'|'absent' {
  const hits=clauses(text).flatMap(c=>{return [...c.text.matchAll(new RegExp(re.source,re.flags.replace(/g/g,"")+"g"))].map(m=>({before:c.text.slice(0,m.index),after:c.text.slice(m.index!+m[0].length)}));});
  return hits.some(h=>negativeClause(h.before)||/(?<!\p{L})без\s*$/iu.test(h.before)||/^\s+не\s+(?:се\s+)?(?:предлага|включ|препоръч)/iu.test(h.after))?'negative':hits.length?'positive':'absent';
}
export function excludedMention(text:string,re:RegExp) {
  return clauses(text).some(c=>{const m=c.text.match(re);if(!m)return false;const before=c.text.slice(0,m.index),after=c.text.slice(m.index!+m[0].length);return /(?:без(?:\s+\p{L}+){0,2}|не\s+(?:е|са)\s+включен[аои]?)\s*$/iu.test(before)||/^(?:\s+(?:за|към)\s+\p{L}+)?\s+не\s+(?:е|са)\s+включен/iu.test(after)||/^\s+(?:се\s+)?(?:закупува|продава|предлага)\p{L}*\s+(?:се\s+)?отделно/iu.test(after);});
}
