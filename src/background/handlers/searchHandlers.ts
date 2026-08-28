import { EMPTY_SEARCH } from '../../models/search';
import { gamePageUrl } from '../../services/roblox/endpoints';
import type { AppContext } from '../context';

/**
 * Experience search (phase 7).
 *
 * The query is stored alongside the results so a surface can never show one query's
 * results under another's heading - which is what happens when two searches are in
 * flight and the slower one lands last.
 */
export async function search(context: AppContext, query: string): Promise<void> {
  const trimmed = query.trim();
  if (!trimmed) {
    context.searchState = EMPTY_SEARCH;
    return;
  }

  const { results, totalReturned } = await context.search.search(trimmed);
  context.searchState = { query: trimmed, results, totalReturned, searchedAt: Date.now() };
}

/**
 * Opens a search result.
 *
 * Roblox's search response turned out to carry `rootPlaceId` already, so the common path
 * costs no request at all. The lookup remains for a result that arrives without one:
 * search speaks in universe ids and a game page needs a place id, and a row that cannot
 * be opened is worse than one extra call.
 */
export async function openResult(context: AppContext, universeId: string): Promise<void> {
  const known = context.searchState.results.find((result) => result.universeId === universeId);
  const placeId = known?.rootPlaceId ?? (await context.search.rootPlaceId(universeId));
  if (!placeId) return;
  await chrome.tabs.create({ url: gamePageUrl(placeId) });
}
