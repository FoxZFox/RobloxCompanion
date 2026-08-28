import { parseSearch, type RawSearchResponse } from '../../features/search/parseSearch';
import type { SearchResult } from '../../models/search';
import { gameDetailsUrl, omniSearchUrl } from './endpoints';
import type { RobloxHttpClient } from './RobloxHttpClient';

/**
 * Experience search (phase 7), verified live on 28 Aug 2026.
 *
 * The first probe run got an empty result set from this endpoint and the second, with a
 * `sessionId`, got forty groups back for the same query - so the parameter list here is
 * the finding, not an implementation detail.
 */
export class SearchApi {
  /**
   * One id for the life of the service worker.
   *
   * Roblox uses it to group the searches of a single sitting, which is what it is for.
   * Minting a fresh one per keystroke would misrepresent one person's search as dozens
   * of separate sessions.
   */
  private readonly sessionId = crypto.randomUUID();

  constructor(private readonly http: RobloxHttpClient) {}

  async search(query: string): Promise<{ results: SearchResult[]; totalReturned: number }> {
    const trimmed = query.trim();
    if (!trimmed) return { results: [], totalReturned: 0 };

    const body = await this.http.getJson<RawSearchResponse>(
      omniSearchUrl(trimmed, this.sessionId),
    );
    return parseSearch(body);
  }

  /**
   * Search returns a universeId; a game page needs a placeId.
   *
   * Resolved on click rather than for every row: one lookup when somebody actually wants
   * to go somewhere costs a single request, while resolving a whole page of results would
   * spend the user's rate limit on rows they never touched.
   */
  async rootPlaceId(universeId: string): Promise<string | null> {
    const body = await this.http.getJson<{ data?: Array<{ rootPlaceId?: number }> }>(
      gameDetailsUrl([universeId]),
    );
    const rootPlaceId = body.data?.[0]?.rootPlaceId;
    return typeof rootPlaceId === 'number' ? String(rootPlaceId) : null;
  }
}
