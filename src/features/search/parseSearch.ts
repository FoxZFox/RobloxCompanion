import type { SearchResult } from '../../models/search';

/**
 * Turns an omni-search response into results, and nothing else.
 *
 * Pure so the parsing can be tested against the real 28 Aug 2026 response without a
 * browser. The shape is nested twice - results are grouped by content type, and only the
 * `Game` groups are experiences - which is exactly the kind of structure that goes wrong
 * quietly when it is parsed inline in a component.
 */

/** How many results are kept. Roblox returned 40 groups for a one-word query. */
export const SEARCH_LIMIT = 24;

export interface RawContent {
  universeId?: number | string;
  name?: string;
  creatorName?: string;
  playerCount?: number;
  totalUpVotes?: number;
  totalDownVotes?: number;
  isSponsored?: boolean;
  rootPlaceId?: number | string;
}

interface RawGroup {
  contentGroupType?: string;
  contents?: RawContent[];
}

export interface RawSearchResponse {
  searchResults?: RawGroup[];
}

function parseContent(raw: RawContent): SearchResult | null {
  if (raw.universeId === undefined || raw.universeId === null) return null;
  const name = raw.name?.trim();
  if (!name) return null;

  return {
    universeId: String(raw.universeId),
    name,
    creatorName: raw.creatorName?.trim() || null,
    // A count of zero is a fact; a missing count is not. Keeping them apart is what lets
    // the UI show "—" instead of inventing "0 playing" for a game it was told nothing about.
    playerCount: typeof raw.playerCount === 'number' ? raw.playerCount : null,
    upVotes: typeof raw.totalUpVotes === 'number' ? raw.totalUpVotes : null,
    downVotes: typeof raw.totalDownVotes === 'number' ? raw.totalDownVotes : null,
    sponsored: raw.isSponsored === true,
    rootPlaceId:
      raw.rootPlaceId === undefined || raw.rootPlaceId === null ? null : String(raw.rootPlaceId),
  };
}

/**
 * Only `Game` groups become results.
 *
 * Omni-search also returns groups of users, creators and "sdui" layout blobs. Rendering
 * those as experiences would produce rows that cannot be opened, so they are dropped
 * here rather than guarded against everywhere downstream.
 */
export function parseSearch(body: RawSearchResponse): {
  results: SearchResult[];
  totalReturned: number;
} {
  const groups = Array.isArray(body.searchResults) ? body.searchResults : [];
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    if (group.contentGroupType !== 'Game') continue;
    for (const content of group.contents ?? []) {
      const parsed = parseContent(content);
      if (!parsed) continue;
      // The same experience can appear in more than one group - a sponsored placement
      // and an organic hit, typically - and listing it twice looks like a bug.
      if (seen.has(parsed.universeId)) continue;
      seen.add(parsed.universeId);
      results.push(parsed);
    }
  }

  return { results: results.slice(0, SEARCH_LIMIT), totalReturned: results.length };
}
