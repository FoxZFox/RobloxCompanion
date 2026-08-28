import { useState } from 'react';
import { describeCheck } from '../features/playerBlacklist/blacklistCheck';
import { describePresence } from '../features/playerBlacklist/presence';
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
        The honest disclosure required by spec section 13, in two parts now that presence
        exists. Roblox does not publish who is in a public server, and identifying them
        from the opaque tokens it does publish would mean fingerprinting avatar
        thumbnails - reversing a privacy decision rather than reading a published fact.
        Presence is the one route that stays on the right side of that line: it reports
        only what each person's own settings allow, so it answers for a minority and says
        how large that minority was.
      */}
      <div className="rc-banner" style={{ marginTop: 12 }}>
        <span>
          {describeCheck(state.health.blacklistCheck)} — Roblox does not publish who is in a
          public server. Identifying them anyway would mean matching avatar thumbnails
          against people on this list, which this extension will not do.
        </span>
      </div>

      <PresenceCheck state={state} busy={busy} send={send} />

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

/**
 * The presence lookup for blacklisted players (phase 5).
 *
 * Three things had to be true before this could exist at all: the endpoint verified, the
 * user opted in, and the host permission granted. Where each is missing, the button says
 * which one rather than failing.
 */
function PresenceCheck({
  state,
  busy,
  send,
}: {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
}): React.JSX.Element | null {
  if (state.blacklist.length === 0) return null;

  const allowed = state.settings.privacy.allowPresenceChecks;
  const summary = state.presence;

  return (
    <div className="rc-card" style={{ marginTop: 8, marginBottom: 8 }}>
      <div className="rc-card__label">Where are they now?</div>

      {!allowed ? (
        <p className="rc-header__sub" style={{ marginTop: 0 }}>
          Off by default: this asks Roblox about other people, so it waits until you turn on
          “Allow presence lookups” in Settings.
        </p>
      ) : (
        <>
          <p className="rc-header__sub" style={{ marginTop: 0 }}>
            {summary
              ? describePresence(summary)
              : 'Asks Roblox where the people on this list are. It answers only for those whose privacy settings allow it.'}
          </p>

          {summary?.players
            .filter((player) => player.kind !== 'offline' && player.kind !== 'unknown')
            .map((player) => {
              const known = state.blacklist.find((entry) => entry.userId === player.userId);
              return (
                <div className="rc-meta" key={player.userId}>
                  <strong>{known?.usernameAtReport ?? player.userId}</strong>
                  <span className="rc-meta__sep">·</span>
                  <span>{player.kind === 'in-game' ? 'in a game' : 'on the website'}</span>
                  {player.lastLocation ? (
                    <>
                      <span className="rc-meta__sep">·</span>
                      <span>{player.lastLocation}</span>
                    </>
                  ) : null}
                  {/*
                    The one case that changes a decision: Roblox named the exact server, so
                    that server can be marked in the browser above.
                  */}
                  {player.jobId ? (
                    <>
                      <span className="rc-meta__sep">·</span>
                      <span className="rc-chip rc-chip--exploiters">server disclosed</span>
                    </>
                  ) : null}
                </div>
              );
            })}
        </>
      )}

      <div className="rc-btn-row">
        <button
          type="button"
          className="rc-btn"
          disabled={busy || !allowed}
          title={allowed ? 'Ask Roblox once, now' : 'Turn on presence lookups in Settings first'}
          onClick={() => send({ type: 'blacklist/checkPresence' })}
        >
          Check now
        </button>
        <button type="button" className="rc-btn" onClick={() => send({ type: 'ui/openOptions' })}>
          Settings
        </button>
      </div>
    </div>
  );
}
