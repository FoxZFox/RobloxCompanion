import type { AppState, UiRequest } from '../models/messages';
import type { ServerStatus } from '../models/server';
import { formatAgo, formatPing, shortJobId } from '../utils/format';

const FLAGS: Array<{ status: ServerStatus; label: string }> = [
  { status: 'clean', label: '👍 Clean' },
  { status: 'exploiters', label: '⚠ Exploiter' },
  { status: 'bugged', label: '🐛 Bugged' },
  { status: 'avoid', label: '🚫 Avoid' },
];

interface Props {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
}

/**
 * The flag panel, pinned at the top of every surface.
 *
 * This is the whole point of spec sections 15 and 16: the user alt-tabs back from a game
 * having just seen an exploiter, and marking that server has to be the very first thing
 * they can click - not something behind History, Servers, Details, Edit.
 */
export function LastJoinedCard({ state, busy, send }: Props): React.JSX.Element | null {
  const last = state.lastJoined;
  if (!last) return null;

  const current = last.report?.status ?? 'unknown';

  return (
    <div className="rc-card">
      <div className="rc-card__label">Last joined</div>

      <div className="rc-meta">
        <strong>{last.gameName ?? `Place ${last.placeId}`}</strong>
        <span className="rc-meta__sep">·</span>
        <span title={last.jobId}>{shortJobId(last.jobId)}</span>
      </div>

      <div className="rc-meta">
        <span>
          {last.playersAtJoin} / {last.maxPlayers || '?'}
        </span>
        <span className="rc-meta__sep">·</span>
        <span title="Server-side average across its players. Not your latency.">
          {formatPing(last.ping)}
        </span>
        <span className="rc-meta__sep">·</span>
        <span>{formatAgo(last.joinedAt)}</span>
      </div>

      <div className="rc-btn-row" style={{ marginTop: 8 }}>
        {FLAGS.map((flag) => (
          <button
            key={flag.status}
            type="button"
            className={`rc-btn${current === flag.status ? ' rc-btn--primary' : ''}`}
            aria-pressed={current === flag.status}
            disabled={busy}
            onClick={() =>
              send({
                type: 'report/setStatus',
                placeId: last.placeId,
                jobId: last.jobId,
                // Clicking the active flag clears it, so a misclick is one click to undo.
                status: current === flag.status ? 'unknown' : flag.status,
              })
            }
          >
            {flag.label}
          </button>
        ))}
      </div>

      <div className="rc-btn-row" style={{ marginTop: 6 }}>
        <button
          type="button"
          className="rc-btn"
          disabled={busy}
          onClick={() => send({ type: 'join/server', placeId: last.placeId, jobId: last.jobId })}
        >
          ↻ Rejoin
        </button>
      </div>
    </div>
  );
}
