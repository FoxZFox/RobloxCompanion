import { approvalRatio, formatVoteCount } from '../features/experience/liveStats';
import { useLiveStats } from '../hooks/useLiveStats';
import { sessionDuration, startOfDay } from '../features/playtime/playtime';
import { describeDuration, describeServerAge } from '../features/playtime/sessionLog';
import type { AppState, UiRequest } from '../models/messages';
import { formatAgo, formatDuration, formatTime, shortJobId } from '../utils/format';

interface Props {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
}

/**
 * Playtime and live experience stats (spec section 23).
 */
export function PlaytimePane({ state, busy, send }: Props): React.JSX.Element {
  const now = Date.now();
  const today = startOfDay(now);
  const todayMs = state.playtime.reduce(
    (sum, entry) => sum + (entry.lastPlayedAt >= today ? entry.totalMs : 0),
    0,
  );

  return (
    <>
      <LiveStats state={state} busy={busy} send={send} />

      <div className="rc-card" style={{ marginBottom: 10 }}>
        <div className="rc-card__label">Tracked time</div>

        {/*
          The wording is the feature. We can see the moment someone presses Join and
          nothing after it - Roblox gives a browser extension no view of a running game -
          so this is time since joining, which counts alt-tabbing away too. Calling it
          "played" would overstate what was measured.
        */}
        <p className="rc-header__sub" style={{ marginTop: 0 }}>
          Measured from when you press Join until you join somewhere else. Roblox tells a
          browser extension nothing about a running game, so this is an upper bound rather
          than time actually spent playing.
        </p>

        <div className="rc-health">
          <span className="rc-health__item">
            <strong>{formatDuration(todayMs)}</strong>&nbsp;today
          </span>
          <span className="rc-health__item">
            {state.playtime.reduce((sum, entry) => sum + entry.sessions, 0)} sessions
          </span>
        </div>

        {state.openSession ? (
          <div className="rc-btn-row" style={{ marginTop: 8 }}>
            <span className="rc-health__item" style={{ flex: 1 }}>
              ▶ {state.openSession.gameName ?? `Place ${state.openSession.placeId}`} ·{' '}
              {formatDuration(sessionDuration(state.openSession, now))}
            </span>
            <button
              type="button"
              className="rc-btn"
              disabled={busy}
              title="Close the current session now"
              onClick={() => send({ type: 'playtime/end' })}
            >
              ■ Stop
            </button>
          </div>
        ) : null}

        <FollowStatus state={state} now={now} send={send} />
      </div>

      <SessionLog state={state} now={now} />

      {state.playtime.length === 0 ? (
        <div className="rc-empty">
          Nothing tracked yet.
          <div className="rc-empty__hint">
            Join a server through the extension and a session starts.
          </div>
        </div>
      ) : (
        state.playtime.map((entry) => (
          <div className="rc-row" key={entry.placeId}>
            <div className="rc-row__top">
              <strong>{entry.gameName ?? `Place ${entry.placeId}`}</strong>
              <span className="rc-row__count">{formatDuration(entry.totalMs)}</span>
            </div>
            <div className="rc-meta">
              <span>{entry.sessions} session(s)</span>
              <span className="rc-meta__sep">·</span>
              <span>last {formatAgo(entry.lastPlayedAt, now)}</span>
            </div>
          </div>
        ))
      )}

      {state.playtime.length > 0 ? (
        <div className="rc-btn-row" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="rc-btn"
            disabled={busy}
            onClick={() => send({ type: 'playtime/clear' })}
          >
            Clear playtime history
          </button>
        </div>
      ) : null}
    </>
  );
}

/**
 * Whether sessions are being followed, and when Roblox last answered.
 *
 * A tracker that has correctly decided to do nothing looks exactly like a broken one, so
 * the last poll is shown with the sentence that came with it. Off, this is one line and
 * a way to turn it on rather than silence.
 */
function FollowStatus({
  state,
  now,
  send,
}: {
  state: AppState;
  now: number;
  send: (request: UiRequest) => void;
}): React.JSX.Element {
  const following = state.settings.playtime.followPresence;
  const last = state.presenceFollow;

  if (!following) {
    return (
      <div className="rc-footnote" style={{ marginTop: 8 }}>
        Only joins made through this extension are tracked. To count games you start from
        Roblox itself — and to end a session when you actually leave — turn on{' '}
        <button
          type="button"
          className="rc-linkish"
          onClick={() => send({ type: 'ui/openOptions' })}
        >
          Track sessions from my Roblox presence
        </button>{' '}
        in Settings.
      </div>
    );
  }

  return (
    <div className="rc-footnote" style={{ marginTop: 8 }} role="status">
      Following your Roblox presence.{' '}
      {last
        ? `Last checked ${formatAgo(last.at, now)} — ${last.reason}`
        : 'Waiting for the first check, which runs within a minute.'}
    </div>
  );
}

/**
 * Every visit, server by server (spec section 18, with the duration it was missing).
 *
 * Three facts per row, and each one is worded for how well it is actually known:
 *
 *   - which experience and which instance: certain, we launched it
 *   - how long: measured from the join, so an upper bound - the same caveat the totals
 *     above carry, which is why it is not repeated on every row
 *   - how old the server was: a floor, from our own first sighting, or "not known" where
 *     the join was the first sighting. Roblox publishes no server start time at all, so
 *     there is no version of this row that could say "uptime: 42m" honestly.
 */
function SessionLog({ state, now }: { state: AppState; now: number }): React.JSX.Element | null {
  if (state.sessions.length === 0) return null;

  return (
    <div className="rc-card" style={{ marginBottom: 10 }}>
      <div className="rc-card__label">Your visits</div>
      <p className="rc-header__sub" style={{ marginTop: 0 }}>
        Which server, in which experience, and for how long. Server age is measured from
        the first time this extension saw that server — Roblox publishes no start time, so
        it is a floor, never the real uptime.
      </p>

      {state.sessions.map((entry) => (
        <div className="rc-row" key={`${entry.jobId}-${entry.joinedAt}`}>
          <div className="rc-row__top">
            <strong>{entry.gameName ?? `Place ${entry.placeId}`}</strong>
            <span className="rc-row__count">
              {entry.open ? '▶ ' : ''}
              {formatDuration(entry.durationMs)}
            </span>
          </div>
          <div className="rc-meta">
            {/*
              Roblox names the server for one's own account, but not always - and a blank
              where an id should be would look like a bug rather than a disclosure that
              did not happen.
            */}
            <span title={entry.jobId || undefined}>
              {entry.jobId ? shortJobId(entry.jobId) : 'server not named'}
            </span>
            <span className="rc-meta__sep">·</span>
            <span>joined {formatTime(entry.joinedAt)}</span>
            <span className="rc-meta__sep">·</span>
            <span>{formatAgo(entry.joinedAt, now)}</span>
            {entry.detected ? (
              <>
                <span className="rc-meta__sep">·</span>
                <span title="You started this outside the extension; Roblox presence reported it">
                  detected
                </span>
              </>
            ) : null}
          </div>
          <div className="rc-footnote">
            {describeDuration(entry)} {describeServerAge(entry)}
          </div>
        </div>
      ))}
    </div>
  );
}

function LiveStats({ state, busy, send }: Props): React.JSX.Element | null {
  // Fetches itself as soon as this pane is on screen; the button below is now only for
  // forcing a refresh sooner than the cache window would.
  useLiveStats(state, send);

  const placeId = state.experience?.placeId;
  if (!placeId) return null;

  const stats = state.liveStats;
  const ratio = approvalRatio(stats);

  return (
    <div className="rc-card" style={{ marginBottom: 10 }}>
      <div className="rc-card__label">Live stats</div>

      {stats ? (
        <>
          <div className="rc-health">
            {stats.playing !== undefined ? (
              <span className="rc-health__item">👥 {formatVoteCount(stats.playing)} playing</span>
            ) : null}
            {stats.upVotes !== undefined ? (
              <span className="rc-health__item">👍 {formatVoteCount(stats.upVotes)}</span>
            ) : null}
            {stats.downVotes !== undefined ? (
              <span className="rc-health__item">👎 {formatVoteCount(stats.downVotes)}</span>
            ) : null}
            {/*
              Null when nobody has voted. A new experience has an unknown reception, not
              a 0% one, so it must not render as though it were disliked.
            */}
            {ratio !== null ? (
              <span className="rc-health__item">{Math.round(ratio * 100)}% liked</span>
            ) : (
              <span className="rc-health__caveat">No votes yet</span>
            )}
          </div>
          <div className="rc-header__sub" style={{ marginTop: 4 }}>
            fetched {formatAgo(stats.fetchedAt)}
          </div>
        </>
      ) : (
        <div className="rc-header__sub">
          {state.experience?.universeId ? 'Loading…' : 'Open a Roblox experience page.'}
        </div>
      )}

      <div className="rc-btn-row" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="rc-btn"
          disabled={busy}
          onClick={() => send({ type: 'stats/refresh', placeId })}
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  );
}
