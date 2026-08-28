/**
 * Experience search (phase 7).
 *
 * Unblocked on 28 Aug 2026: omni-search answers properly once the query carries a
 * `sessionId`, which is what the first probe run was missing. Every field below was read
 * off that real response.
 */
export interface SearchResult {
  universeId: string;
  name: string;
  /** Roblox's own creator name, when it sends one. */
  creatorName: string | null;
  playerCount: number | null;
  upVotes: number | null;
  downVotes: number | null;
  /**
   * Roblox mixes paid placements into search results and marks them.
   *
   * Kept and surfaced rather than filtered out: hiding them silently is an editorial
   * decision made on the user's behalf, and showing them unmarked would pass an
   * advertisement off as a search result. Labelling is the only option that is neither.
   */
  sponsored: boolean;
  /**
   * The place to open, when the search response carried one.
   *
   * It does, in every sample seen so far - which saves a lookup per click. Kept nullable
   * because a result without it must still be openable, by resolving the universe.
   */
  rootPlaceId: string | null;
}

export interface SearchState {
  /** The query these results are for, so a stale list is never shown under a new query. */
  query: string;
  results: SearchResult[];
  /** Total results Roblox returned before our own cap, for honest counting. */
  totalReturned: number;
  searchedAt: number | null;
}

export const EMPTY_SEARCH: SearchState = {
  query: '',
  results: [],
  totalReturned: 0,
  searchedAt: null,
};
