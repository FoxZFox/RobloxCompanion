import { useEffect, useState } from 'react';
import { SEARCH_LIMIT } from '../features/search/parseSearch';
import type { AppState, UiRequest } from '../models/messages';
import type { SearchResult } from '../models/search';

interface Props {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
}

/** Long enough that typing a game name is one request, short enough to feel immediate. */
const DEBOUNCE_MS = 450;

/**
 * Quick search (phase 7), unblocked on 28 Aug 2026.
 *
 * Debounced rather than searched per keystroke: these requests share the user's own
 * Roblox rate limit with the server browser, so a nine-letter game name must not cost
 * nine searches (§32).
 */
export function SearchPane({ state, busy, send }: Props): React.JSX.Element {
  const [query, setQuery] = useState(state.search.query);
  const { search } = state;

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === search.query) return;
    if (!trimmed) return;

    const timer = setTimeout(() => send({ type: 'search/experiences', query: trimmed }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, search.query, send]);

  return (
    <>
      <div className="rc-card" style={{ marginBottom: 10 }}>
        <div className="rc-card__label">Find an experience</div>
        <input
          className="rc-input"
          style={{ width: '100%' }}
          value={query}
          placeholder="Search Roblox…"
          aria-label="Search experiences"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            send({ type: 'search/experiences', query: query.trim() });
          }}
        />

        {search.searchedAt !== null && search.totalReturned > SEARCH_LIMIT ? (
          <p className="rc-footnote">
            Showing {search.results.length} of {search.totalReturned} experiences Roblox
            returned.
          </p>
        ) : null}
      </div>

      {search.results.length === 0 ? (
        <div className="rc-empty">
          {search.searchedAt === null
            ? 'Type to search Roblox for an experience.'
            : `Nothing came back for “${search.query}”.`}
        </div>
      ) : (
        search.results.map((result) => (
          <ResultRow key={result.universeId} result={result} busy={busy} send={send} />
        ))
      )}
    </>
  );
}

function ResultRow({
  result,
  busy,
  send,
}: {
  result: SearchResult;
  busy: boolean;
  send: (request: UiRequest) => void;
}): React.JSX.Element {
  return (
    <div className="rc-row">
      <div className="rc-row__top">
        <strong>{result.name}</strong>
        {/*
          Roblox mixes paid placements into its search results and flags them. Hiding them
          would be an editorial decision made on the user's behalf; showing them unmarked
          would pass an advertisement off as a result. So they are marked.
        */}
        {result.sponsored ? <span className="rc-chip rc-chip--unknown">sponsored</span> : null}
      </div>

      <div className="rc-meta">
        {result.creatorName ? <span>by {result.creatorName}</span> : null}
        {result.playerCount !== null ? (
          <>
            <span className="rc-meta__sep">·</span>
            <span>{result.playerCount.toLocaleString()} playing</span>
          </>
        ) : null}
        {/*
          Shown as the two counts rather than as a percentage. A game with 6 up and 9 down
          and one with 6,000 and 9,000 have the same ratio and are not the same thing.
        */}
        {result.upVotes !== null && result.downVotes !== null ? (
          <>
            <span className="rc-meta__sep">·</span>
            <span>
              👍 {result.upVotes.toLocaleString()} · 👎 {result.downVotes.toLocaleString()}
            </span>
          </>
        ) : null}
      </div>

      <div className="rc-btn-row">
        <button
          type="button"
          className="rc-btn"
          disabled={busy}
          title="Roblox's search gives a universe id, so opening resolves the place first"
          onClick={() => send({ type: 'search/open', universeId: result.universeId })}
        >
          Open
        </button>
      </div>
    </div>
  );
}
