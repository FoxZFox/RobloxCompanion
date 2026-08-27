import { useState } from 'react';
import { describeCheck } from '../features/playerBlacklist/blacklistCheck';
import type { AppState, UiRequest } from '../models/messages';
import { BLACKLIST_REASONS, REASON_LABEL, type BlacklistReason } from '../models/blacklist';
import { STATUS_META } from '../models/server';
import { formatAgo, formatDate, formatTime, shortJobId } from '../utils/format';
import { ServerRow } from './ServerRow';

interface TabProps {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
}

export function ServersTab({ state, busy, send }: TabProps): React.JSX.Element {
  const placeId = state.experience?.placeId;
  if (!placeId) {
    return (
      <div className="rc-empty">
        Open a Roblox experience page.
        <div className="rc-empty__hint">The server browser needs to know which game you mean.</div>
      </div>
    );
  }

  if (state.servers.length === 0) {
    return (
      <div className="rc-empty">
        {state.scan.status === 'loading' ? 'Loading servers…' : 'No servers match your filters.'}
        <div className="rc-empty__hint">
          {state.scan.lastScanAt === null
            ? 'Press Refresh to load the server list.'
            : 'Try turning off "exclude full" or clearing the player-count filter.'}
        </div>
      </div>
    );
  }

  return (
    <>
      {state.scan.truncated ? (
        <div className="rc-banner">
          <span>
            Roblox caps how deep the server list can be paginated, so this is a window onto the
            experience, not all of it.
          </span>
        </div>
      ) : null}

      {state.servers.map((view) => (
        <ServerRow
          key={view.jobId}
          view={view}
          flags={state.customFlags}
          busy={busy}
          onJoin={(jobId) => send({ type: 'join/server', placeId, jobId })}
          onToggleFavorite={(jobId, favorite) =>
            send({ type: 'report/setFavorite', placeId, jobId, favorite })
          }
          onToggleFlag={(jobId, flagId, applied) =>
            send({ type: 'flags/toggleOnServer', placeId, jobId, flagId, applied })
          }
          onSetNote={(jobId, note) => send({ type: 'report/setNote', placeId, jobId, note })}
        />
      ))}

      {state.scan.canLoadMore ? (
        <div className="rc-btn-row" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="rc-btn"
            disabled={busy}
            onClick={() => send({ type: 'servers/loadMore', placeId })}
          >
            Load more
          </button>
        </div>
      ) : null}

      {/*
        "of N shown" rather than "N servers": Roblox's pagination cap means we can never
        prove we have seen them all (spec section 33).
      */}
      <div className="rc-footnote">
        Showing {state.totalShown} of {state.scan.scanned} servers loaded
        {state.scan.complete ? '' : ' (list is capped by Roblox)'}
      </div>
    </>
  );
}

export function HistoryTab({ state, busy, send }: TabProps): React.JSX.Element {
  if (state.history.length === 0) {
    return (
      <div className="rc-empty">
        No servers joined yet.
        <div className="rc-empty__hint">Join one and it will show up here with its flag.</div>
      </div>
    );
  }

  return (
    <>
      {state.history.map((entry) => (
        <div className="rc-row" key={`${entry.jobId}-${entry.joinedAt}`}>
          <div className="rc-row__top">
            <strong>{entry.gameName ?? `Place ${entry.placeId}`}</strong>
            <span className="rc-row__region">{formatTime(entry.joinedAt)}</span>
          </div>
          <div className="rc-meta">
            <span>
              {entry.playersAtJoin ?? '?'} / {entry.maxPlayers || '?'}
            </span>
            <span className="rc-meta__sep">·</span>
            <span title={entry.jobId}>{shortJobId(entry.jobId)}</span>
            <span className="rc-meta__sep">·</span>
            <span>{formatAgo(entry.joinedAt)}</span>
          </div>
          <div className="rc-row__top">
            <span className={`rc-chip rc-chip--${entry.status}`}>
              {STATUS_META[entry.status].icon} {STATUS_META[entry.status].label}
            </span>
            <button
              type="button"
              className="rc-btn"
              disabled={busy}
              onClick={() =>
                send({ type: 'join/server', placeId: entry.placeId, jobId: entry.jobId })
              }
            >
              ↻ Rejoin
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

export function BlacklistTab({ state, busy, send }: TabProps): React.JSX.Element {
  const [username, setUsername] = useState('');
  const [reason, setReason] = useState<BlacklistReason>('exploit');

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;
    send({ type: 'blacklist/add', username: trimmed, reason });
    setUsername('');
  };

  return (
    <>
      <form onSubmit={submit}>
        <div className="rc-field">
          <label className="rc-field__label" htmlFor="rc-blacklist-username">
            Username
          </label>
          <input
            id="rc-blacklist-username"
            className="rc-input"
            value={username}
            placeholder="SomeUser123"
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="rc-field">
          <label className="rc-field__label" htmlFor="rc-blacklist-reason">
            Reason
          </label>
          <select
            id="rc-blacklist-reason"
            className="rc-select"
            value={reason}
            onChange={(e) => setReason(e.target.value as BlacklistReason)}
          >
            {BLACKLIST_REASONS.map((value) => (
              <option key={value} value={value}>
                {REASON_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="rc-btn rc-btn--primary" disabled={busy || !username.trim()}>
          Add to blacklist
        </button>
      </form>

      {/*
        The honest disclosure required by spec section 13. Roblox returns an empty
        playerTokens array and only discloses presence for users whose privacy allows it,
        so we cannot tell the user a server is clear of these people.
      */}
      <div className="rc-banner" style={{ marginTop: 12 }}>
        <span>{describeCheck(state.health.blacklistCheck)} — Roblox does not disclose who is in a public server, so this list cannot be checked against the server browser.</span>
      </div>

      {state.blacklist.length === 0 ? (
        <div className="rc-empty">
          No blacklisted players.
          <div className="rc-empty__hint">Stored on this machine only. Nothing is uploaded.</div>
        </div>
      ) : (
        state.blacklist.map((player) => (
          <div className="rc-row" key={player.userId}>
            <div className="rc-row__top">
              <strong>{player.usernameAtReport}</strong>
              <span className="rc-row__region">ID {player.userId}</span>
            </div>
            <div className="rc-meta">
              <span>{REASON_LABEL[player.reason]}</span>
              <span className="rc-meta__sep">·</span>
              <span>{player.encounters} encounter(s)</span>
              <span className="rc-meta__sep">·</span>
              <span>added {formatDate(player.addedAt)}</span>
            </div>
            {player.notes ? <div className="rc-meta">{player.notes}</div> : null}
            <div className="rc-btn-row">
              <button
                type="button"
                className="rc-btn"
                disabled={busy}
                onClick={() => send({ type: 'blacklist/remove', userId: player.userId })}
              >
                Remove
              </button>
            </div>
          </div>
        ))
      )}
    </>
  );
}
