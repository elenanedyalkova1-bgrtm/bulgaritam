/** Historical Phase 1/2/2.5 contracts run with the Phase 3 rollback switch.
 * Historical expected results are immutable. Phase 3 default behavior has its
 * own tests and exact ordered before/after corpus comparison. */
export * from '../../src/lib/homepage-search';
import { searchHomepage as search, interpretHomepageQuery as interpret } from '../../src/lib/homepage-search';
export const searchHomepage = (cards: any[], query: string, manual?: any) => search(cards, query, manual, {discoveryRelations:false});
export const interpretHomepageQuery = (query: string, ...args: any[]) => interpret(query, args[0], {discoveryRelations:false});
