import defaults from './search-relation-policy.json';
export type RelationFeatures = typeof defaults;
export type SearchRelationOptions = {discoveryRelations?: boolean; features?: Partial<RelationFeatures>};
export function relationFeatures(options: SearchRelationOptions = {}): RelationFeatures {
  return Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,options.discoveryRelations !== false && (options.features?.[k as keyof RelationFeatures] ?? v)])) as RelationFeatures;
}
