import { useState } from 'react';
import type { CustomFlag } from '../models/flags';
import type { ServerView } from '../models/server';
import { STATUS_META } from '../models/server';
import { formatAgo, formatPing, shortJobId } from '../utils/format';
import { FlagPicker } from './FlagPicker';

export function StatusChip({ view }: { view: ServerView }): React.JSX.Element {
  const meta = STATUS_META[view.status];
  return (
    <span className={`rc-chip rc-chip--${view.status}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

interface ServerRowProps {
  view: ServerView;
  flags: CustomFlag[];
  onJoin: (jobId: string) => void;
  onToggleFavorite: (jobId: string, favorite: boolean) => void;
  onToggleFlag: (jobId: string, flagId: string, applied: boolean) => void;
  onSetNote: (jobId: string, note: string) => void;
  busy: boolean;
}

/**
 * One server.
 *
 * Two labels here are deliberately hedged, because Roblox does not give us what the
 * original mock assumed (see 04_UI_UX.md):
 *   - ping is prefixed "avg" - it is the server's average across its players, not yours
 *   - age reads "first seen" - it is our own first sighting, not a server start time
 *
 * Region is absent entirely rather than shown as a dash: Roblox does not expose it to a
 * browser at all, so a permanent placeholder would only promise something that is not
 * coming (see features/smartJoin/regionSource.ts).
 */
export function ServerRow({
  view,
  flags,
  onJoin,
  onToggleFavorite,
  onToggleFlag,
  onSetNote,
  busy,
}: ServerRowProps): React.JSX.Element {
  const full = view.maxPlayers > 0 && view.playing >= view.maxPlayers;
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(view.note ?? '');

  return (
    <div className="rc-row">
      <div className="rc-row__top">
        <span className="rc-row__count">
          {view.playing} / {view.maxPlayers || '?'}
        </span>
        <span className="rc-row__region" title={view.jobId}>
          {shortJobId(view.jobId)}
        </span>
      </div>

      <div className="rc-meta">
        {/*
          Worded around the server's own players on purpose. This is not your latency and
          it does not indicate how near the server is to you - Roblox seats players on
          nearby servers, so healthy servers everywhere report a low number.
        */}
        <span title="Average latency of the players already in this server, measured from them to it. Not your latency, and not a distance from you.">
          {formatPing(view.ping)}
        </span>
        {view.fps !== undefined ? (
          <>
            <span className="rc-meta__sep">·</span>
            <span title="The server's own simulation rate. Roblox targets 60; well below that means it is overloaded.">
              {Math.round(view.fps)} FPS
            </span>
          </>
        ) : null}
        <span className="rc-meta__sep">·</span>
        <span title="When this extension first saw this server. Roblox exposes no server start time.">
          {view.firstSeenAt ? `first seen ${formatAgo(view.firstSeenAt)}` : 'first seen just now'}
        </span>
        <span className="rc-meta__sep">·</span>
        <span title={view.jobId}>{shortJobId(view.jobId)}</span>
      </div>

      <div className="rc-row__top">
        <StatusChip view={view} />
        <div className="rc-btn-row">
          <button
            type="button"
            className="rc-btn rc-btn--primary"
            disabled={busy || full}
            onClick={() => onJoin(view.jobId)}
          >
            {full ? 'FULL' : 'JOIN'}
          </button>
          <button
            type="button"
            className="rc-btn"
            aria-label={view.favorite ? 'Remove favourite' : 'Add favourite'}
            aria-pressed={view.favorite}
            disabled={busy}
            onClick={() => onToggleFavorite(view.jobId, !view.favorite)}
          >
            {view.favorite ? '⭐' : '☆'}
          </button>
          <button
            type="button"
            className="rc-btn"
            aria-label={expanded ? 'Hide flags and note' : 'Show flags and note'}
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
          >
            ⋯
          </button>
        </div>
      </div>

      {/* Collapsed by default: the list has to stay scannable when nothing is flagged. */}
      {expanded ? (
        <>
          <FlagPicker
            flags={flags}
            applied={view.customFlagIds}
            busy={busy}
            onToggle={(flagId, applied) => onToggleFlag(view.jobId, flagId, applied)}
          />
          <textarea
            className="rc-note"
            value={note}
            placeholder="Note for this server…"
            aria-label="Server note"
            disabled={busy}
            onChange={(e) => setNote(e.target.value)}
            // Saved on blur rather than per keystroke, so one note is one write.
            onBlur={() => {
              if (note !== (view.note ?? '')) onSetNote(view.jobId, note);
            }}
          />
        </>
      ) : (
        <>
          {view.customFlagIds.length > 0 ? (
            <div className="rc-flagpicker">
              {flags
                .filter((flag) => view.customFlagIds.includes(flag.id))
                .map((flag) => (
                  <span key={flag.id} className="rc-flagchip rc-flagchip--on">
                    <span aria-hidden="true">{flag.icon}</span>
                    <span>{flag.name}</span>
                  </span>
                ))}
            </div>
          ) : null}
          {view.note ? <div className="rc-meta">{view.note}</div> : null}
        </>
      )}
    </div>
  );
}
