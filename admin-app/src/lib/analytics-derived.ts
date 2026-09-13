import type { AnalyticsEvent } from "./analytics";

const text = (value: unknown) => String(value ?? "").trim();
const value = (event: AnalyticsEvent, key: string) => event.payload[key];
const field = (event: AnalyticsEvent, key: string) => text(value(event, key));
const unique = <T>(items: T[]) => new Set(items).size;
const ratio = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : null;

export type ProductIdentity = { key: string; productId: string; brandId: string; productSlug: string; brandSlug: string };
export type BrandIdentity = { key: string; brandId: string; brandSlug: string };

export type DiscoveryStateRow = {
  discovery_state_id: string;
  occurred_at: string | Date;
  anonymous_session_id: string;
  anonymous_journey_id: string;
  surface_type: string;
  page_path: string;
  search_id?: string | null;
  query?: string | null;
  category?: string | null;
  subcategory?: string | null;
  product_type?: string | null;
  sort_value?: string | null;
  result_count: number;
};

export type DiscoveryResultRow = {
  discovery_state_id: string;
  entity_type: "product" | "brand";
  product_id?: string | null;
  brand_id?: string | null;
  product_slug?: string | null;
  brand_slug?: string | null;
  position: number;
};

export type AnalyticsDerivedSource = {
  loadEvents(start: Date, end: Date): Promise<AnalyticsEvent[]>;
  loadDiscoveryStates(start: Date, end: Date): Promise<DiscoveryStateRow[]>;
  loadDiscoveryResults(stateIds: string[]): Promise<DiscoveryResultRow[]>;
};

export type StageFact = {
  event: AnalyticsEvent;
  visitorId: string;
  sessionId: string;
  product: ProductIdentity | null;
  brand: BrandIdentity | null;
  directSurface: string;
  directStateId: string;
  directSearchId: string;
  directPosition: number | null;
  influencedStateId: string;
};

export type ProductFunnelRow = {
  product: ProductIdentity;
  eligible: number;
  exposed: number;
  selected: number;
  pageViewed: number;
  considered: number;
  outbound: number;
  uniqueVisitors: number;
  qualifiedExposureRate: number | null;
  selectionRate: number | null;
  pageViewRate: number | null;
  considerationRate: number | null;
  outboundRate: number | null;
};

export type SearchEpisode = {
  key: string;
  searchId: string;
  sessionId: string;
  visitorId: string;
  query: string;
  stateIds: string[];
  resultCount: number;
  exposed: number;
  selected: number;
  considered: number;
  outbound: number;
  successLevel: 0 | 1 | 2 | 3 | 4;
  legacyInferred: boolean;
  reformulationCandidate: boolean;
};

export type SurfaceAggregate = {
  surface: string;
  eligible: number;
  exposed: number;
  selected: number;
  pageViewed: number;
  considered: number;
  outbound: number;
};

export type DerivedAnalyticsDomain = {
  visitors: Array<{ id: string; sessionIds: string[]; returning: boolean }>;
  sessions: Array<{ id: string; visitorId: string; startedAt: Date; endedAt: Date; discoveryActive: boolean }>;
  journeys: Array<{ id: string; sessionIds: string[]; eventCount: number }>;
  discoveryOpportunities: DiscoveryStateRow[];
  discoveryMembers: DiscoveryResultRow[];
  productExposures: StageFact[];
  productSelections: StageFact[];
  productPageViews: StageFact[];
  considerationActions: StageFact[];
  productOutboundIntents: StageFact[];
  brandOutboundIntents: StageFact[];
  legacyUndifferentiatedProductViews: StageFact[];
  productJourneyFacts: Array<{ visitorId: string; product: ProductIdentity; stages: string[]; sessionIds: string[] }>;
  brandJourneyFacts: Array<{ visitorId: string; brand: BrandIdentity; stages: string[]; productKeys: string[] }>;
  productFunnel: ProductFunnelRow[];
  searchEpisodes: SearchEpisode[];
  surfaces: SurfaceAggregate[];
  summary: {
    uniqueVisitors: number;
    sessions: number;
    returningAnonymousVisitors: number;
    discoveryActiveSessions: number;
    canonicalDiscoveryOpportunities: number;
    eligibleProductOpportunities: number;
    qualifiedProductExposures: number;
    productSelections: number;
    productPageViews: number;
    considerationActions: number;
    productOutboundIntents: number;
    brandOutboundIntents: number;
  };
};

export function productIdentity(input: { productId?: unknown; brandId?: unknown; productSlug?: unknown; brandSlug?: unknown }): ProductIdentity | null {
  const productId = text(input.productId), brandId = text(input.brandId);
  const productSlug = text(input.productSlug), brandSlug = text(input.brandSlug);
  const productPart = productId || `slug:${productSlug}`;
  const brandPart = brandId || `slug:${brandSlug}`;
  if (!productPart || productPart === "slug:") return null;
  return { key: `${productPart}::${brandPart}`, productId, brandId, productSlug, brandSlug };
}

export function brandIdentity(input: { brandId?: unknown; brandSlug?: unknown }): BrandIdentity | null {
  const brandId = text(input.brandId), brandSlug = text(input.brandSlug);
  const key = brandId || (brandSlug ? `slug:${brandSlug}` : "");
  return key ? { key, brandId, brandSlug } : null;
}

const stageFact = (event: AnalyticsEvent): StageFact => ({
  event,
  visitorId: event.journeyId,
  sessionId: event.sessionId,
  product: productIdentity({ productId: event.productId, brandId: event.brandId, productSlug: event.productSlug, brandSlug: event.brandSlug }),
  brand: brandIdentity({ brandId: event.brandId, brandSlug: event.brandSlug }),
  directSurface: field(event, "source_surface") || event.listContext || event.sourceContext,
  directStateId: field(event, "source_discovery_state_id"),
  directSearchId: field(event, "source_search_id") || event.searchId,
  directPosition: Number.isInteger(Number(value(event, "source_position"))) ? Number(value(event, "source_position")) : (event.payload.position ? Number(event.payload.position) : null),
  influencedStateId: field(event, "last_discovery_state_id"),
});

const viewStage = (event: AnalyticsEvent) => field(event, "view_stage");
const eventKey = (fact: StageFact) => fact.event.eventId || `${fact.event.id}:${fact.event.at.toISOString()}:${fact.event.sequenceNumber}`;
const uniqueFacts = (facts: StageFact[]) => [...new Map(facts.map(fact => [eventKey(fact), fact])).values()];
const productFacts = (events: AnalyticsEvent[], names: Set<string>) => uniqueFacts(events.filter(e => names.has(e.event)).map(stageFact).filter(f => f.product));

export function deriveAnalyticsDomain(
  events: AnalyticsEvent[],
  discoveryStates: DiscoveryStateRow[] = [],
  discoveryResults: DiscoveryResultRow[] = [],
): DerivedAnalyticsDomain {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime() || a.sequenceNumber - b.sequenceNumber || a.id - b.id);
  const stateMap = new Map(discoveryStates.map(state => [state.discovery_state_id, state]));
  const sessionsById = new Map<string, AnalyticsEvent[]>();
  sorted.filter(e => e.sessionId).forEach(e => sessionsById.set(e.sessionId, [...(sessionsById.get(e.sessionId) || []), e]));
  const stateSessions = new Set(discoveryStates.map(s => s.anonymous_session_id));
  const sessions = [...sessionsById.entries()].map(([id, rows]) => ({
    id, visitorId: rows.find(e => e.journeyId)?.journeyId || "", startedAt: rows[0].at, endedAt: rows.at(-1)!.at,
    discoveryActive: stateSessions.has(id) || rows.some(e => Boolean(e.searchId || field(e, "source_discovery_state_id"))),
  }));
  for (const state of discoveryStates) if (!sessionsById.has(state.anonymous_session_id)) sessions.push({
    id: state.anonymous_session_id, visitorId: state.anonymous_journey_id,
    startedAt: new Date(state.occurred_at), endedAt: new Date(state.occurred_at), discoveryActive: true,
  });
  const sessionIdsByVisitor = new Map<string, string[]>();
  sessions.filter(s => s.visitorId).forEach(s => sessionIdsByVisitor.set(s.visitorId, [...new Set([...(sessionIdsByVisitor.get(s.visitorId) || []), s.id])]));
  const visitors = [...sessionIdsByVisitor.entries()].map(([id, sessionIds]) => ({ id, sessionIds, returning: sessionIds.length > 1 }));

  const exposures = productFacts(sorted.filter(e => e.event === "product_impression"), new Set(["product_impression"]));
  const productViews = sorted.filter(e => e.event === "view_product").map(stageFact).filter(f => f.product);
  const selections = uniqueFacts(productViews.filter(f => viewStage(f.event) === "selection_click"));
  const pageViews = uniqueFacts(productViews.filter(f => viewStage(f.event) === "page_load"));
  const legacyViews = uniqueFacts(productViews.filter(f => !viewStage(f.event)));
  const considerations = productFacts(sorted, new Set(["save_product", "add_to_collection", "share_product"]));
  const productOutbound = productFacts(sorted, new Set(["outbound_product_click"]));
  const brandOutbound = uniqueFacts(sorted.filter(e => e.event === "outbound_brand_click").map(stageFact).filter(f => f.brand));

  const eligible = discoveryResults.filter(r => r.entity_type === "product").map(row => ({
    row,
    state: stateMap.get(row.discovery_state_id),
    product: productIdentity({ productId: row.product_id, brandId: row.brand_id, productSlug: row.product_slug, brandSlug: row.brand_slug }),
  })).filter(x => x.product && x.state);
  const allProductKeys = new Set([...eligible.map(x => x.product!.key), ...[...exposures, ...selections, ...pageViews, ...considerations, ...productOutbound].map(f => f.product!.key)]);
  const factsFor = (facts: StageFact[], key: string) => facts.filter(f => f.product?.key === key);
  const productFunnel = [...allProductKeys].map(key => {
    const sample = [...eligible.map(x => x.product!), ...exposures.map(f => f.product!)].find(p => p.key === key)!;
    const e = eligible.filter(x => x.product!.key === key), x = factsFor(exposures, key), s = factsFor(selections, key);
    const p = factsFor(pageViews, key), c = factsFor(considerations, key), o = factsFor(productOutbound, key);
    const dedup = (facts: StageFact[]) => unique(facts.map(f => `${f.visitorId}:${f.directStateId}:${f.directPosition ?? ""}:${key}`));
    const eligibleKeys = unique(e.map(item => `${item.state!.anonymous_journey_id}:${item.row.discovery_state_id}:${item.row.position}:${key}`));
    const visitorsForProduct = unique([...x, ...s, ...p, ...c, ...o].map(f => f.visitorId).filter(Boolean));
    return { product: sample, eligible: eligibleKeys, exposed: dedup(x), selected: dedup(s), pageViewed: dedup(p), considered: dedup(c), outbound: dedup(o), uniqueVisitors: visitorsForProduct,
      qualifiedExposureRate: ratio(dedup(x), eligibleKeys), selectionRate: ratio(dedup(s), dedup(x)), pageViewRate: ratio(dedup(p), dedup(s)), considerationRate: ratio(dedup(c), dedup(p)), outboundRate: ratio(dedup(o), dedup(p)) };
  });

  const surfaceNames = new Set([...discoveryStates.map(s => s.surface_type), ...[...exposures, ...selections, ...pageViews, ...considerations, ...productOutbound].map(f => f.directSurface).filter(Boolean)]);
  const surfaces = [...surfaceNames].map(surface => ({
    surface,
    eligible: eligible.filter(x => x.state!.surface_type === surface).length,
    exposed: exposures.filter(f => f.directSurface === surface).length,
    selected: selections.filter(f => f.directSurface === surface).length,
    pageViewed: pageViews.filter(f => f.directSurface === surface).length,
    considered: considerations.filter(f => f.directSurface === surface).length,
    outbound: productOutbound.filter(f => f.directSurface === surface).length,
  }));

  const searchStates = discoveryStates.filter(s => Boolean(s.search_id || s.query) && /search/.test(s.surface_type));
  const searchGroups = new Map<string, DiscoveryStateRow[]>();
  searchStates.forEach(s => { const k = s.search_id || `legacy:${s.anonymous_session_id}:${text(s.query).toLocaleLowerCase("bg")}`; searchGroups.set(k, [...(searchGroups.get(k) || []), s]); });
  const orderedSearches = [...searchGroups.entries()].map(([key, states]) => ({ key, states: [...states].sort((a,b)=>new Date(a.occurred_at).getTime()-new Date(b.occurred_at).getTime()) })).sort((a,b)=>new Date(a.states[0].occurred_at).getTime()-new Date(b.states[0].occurred_at).getTime());
  const searchEpisodes = orderedSearches.map(({ key, states }, index): SearchEpisode => {
    const ids = states.map(s => s.discovery_state_id), searchId = states.find(s => s.search_id)?.search_id || "";
    const matches = (fact: StageFact) => (searchId && fact.directSearchId === searchId) || ids.includes(fact.directStateId);
    const ex = exposures.filter(matches).length, se = selections.filter(matches).length, co = considerations.filter(matches).length, ou = productOutbound.filter(matches).length;
    const current = states[0], next = orderedSearches[index + 1]?.states[0];
    const reformulation = Boolean(next && next.anonymous_session_id === current.anonymous_session_id && text(next.query).toLocaleLowerCase("bg") !== text(current.query).toLocaleLowerCase("bg") && new Date(next.occurred_at).getTime() - new Date(current.occurred_at).getTime() <= 30 * 60_000);
    return { key, searchId, sessionId: current.anonymous_session_id, visitorId: current.anonymous_journey_id, query: text(current.query), stateIds: ids,
      resultCount: states.at(-1)!.result_count, exposed: ex, selected: se, considered: co, outbound: ou,
      successLevel: (ou ? 4 : co ? 3 : se ? 2 : ex ? 1 : 0), legacyInferred: !searchId, reformulationCandidate: reformulation };
  });

  const productJourneyMap = new Map<string, { visitorId: string; product: ProductIdentity; stages: Set<string>; sessionIds: Set<string> }>();
  for (const [stage, facts] of [["exposed", exposures], ["selected", selections], ["page_viewed", pageViews], ["considered", considerations], ["outbound", productOutbound]] as const) for (const fact of facts) {
    const k = `${fact.visitorId}:${fact.product!.key}`, row = productJourneyMap.get(k) || { visitorId: fact.visitorId, product: fact.product!, stages: new Set<string>(), sessionIds: new Set<string>() };
    row.stages.add(stage); row.sessionIds.add(fact.sessionId); productJourneyMap.set(k, row);
  }
  const productJourneyFacts = [...productJourneyMap.values()].map(r => ({ ...r, stages: [...r.stages], sessionIds: [...r.sessionIds] }));
  const brandJourneyMap = new Map<string, { visitorId: string; brand: BrandIdentity; stages: Set<string>; productKeys: Set<string> }>();
  for (const fact of [...exposures, ...selections, ...pageViews, ...considerations, ...productOutbound, ...brandOutbound]) if (fact.brand) {
    const k = `${fact.visitorId}:${fact.brand.key}`, row = brandJourneyMap.get(k) || { visitorId: fact.visitorId, brand: fact.brand, stages: new Set<string>(), productKeys: new Set<string>() };
    row.stages.add(fact.event.event); if (fact.product) row.productKeys.add(fact.product.key); brandJourneyMap.set(k, row);
  }
  const brandJourneyFacts = [...brandJourneyMap.values()].map(r => ({ ...r, stages: [...r.stages], productKeys: [...r.productKeys] }));

  return {
    visitors, sessions, journeys: visitors.map(v => ({ id: v.id, sessionIds: v.sessionIds, eventCount: sorted.filter(e => e.journeyId === v.id).length })),
    discoveryOpportunities: discoveryStates, discoveryMembers: discoveryResults, productExposures: exposures, productSelections: selections,
    productPageViews: pageViews, considerationActions: considerations, productOutboundIntents: productOutbound, brandOutboundIntents: brandOutbound,
    legacyUndifferentiatedProductViews: legacyViews, productJourneyFacts, brandJourneyFacts, productFunnel, searchEpisodes, surfaces,
    summary: { uniqueVisitors: visitors.length, sessions: sessions.length, returningAnonymousVisitors: visitors.filter(v => v.returning).length,
      discoveryActiveSessions: sessions.filter(s => s.discoveryActive).length, canonicalDiscoveryOpportunities: discoveryStates.length,
      eligibleProductOpportunities: eligible.length, qualifiedProductExposures: exposures.length, productSelections: selections.length,
      productPageViews: pageViews.length, considerationActions: considerations.length, productOutboundIntents: productOutbound.length,
      brandOutboundIntents: brandOutbound.length },
  };
}

export async function loadDerivedAnalytics(source: AnalyticsDerivedSource, start: Date, end: Date) {
  const [events, states] = await Promise.all([source.loadEvents(start, end), source.loadDiscoveryStates(start, end)]);
  const results = await source.loadDiscoveryResults(states.map(state => state.discovery_state_id));
  return deriveAnalyticsDomain(events, states, results);
}
