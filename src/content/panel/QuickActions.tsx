import type { AppState, UiRequest } from '../../models/messages';

interface Props {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
}

/**
 * The actions used on every loop, kept at the top of the Servers tool.
 *
 * Shared shape with the popup's version rather than a second implementation: the panel
 * is a different surface, not a different product.
 */
export function QuickActions({ state, busy, send }: Props): React.JSX.Element | null {
  const placeId = state.experience?.placeId;
  if (!placeId) {
    return (
      <div className="rc-empty">
        Open a Roblox experience to use the server tools.
        <div className="rc-empty__hint">The panel stays available on every Roblox page.</div>
      </div>
    );
  }

  const smartJoinOn = state.settings.features.smartJoin;

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        type="button"
        className="rc-btn rc-btn--primary rc-btn--big"
        style={{ width: '100%' }}
        disabled={busy || !smartJoinOn}
        title={
          smartJoinOn
            ? 'Score every loaded server and join the best one'
            : 'Smart Join is switched off in Settings'
        }
        onClick={() => send({ type: 'join/smart', placeId })}
      >
        ⚡ SMART JOIN
      </button>

      <div className="rc-btn-row" style={{ marginTop: 6 }}>
        <button
          type="button"
          className="rc-btn"
          disabled={busy}
          onClick={() => send({ type: 'join/lowest', placeId })}
        >
          👤 Lowest
        </button>
        <button
          type="button"
          className="rc-btn"
          disabled={busy}
          onClick={() => send({ type: 'join/random', placeId })}
        >
          🎲 Random
        </button>
        {smartJoinOn ? (
          <button
            type="button"
            className="rc-btn"
            disabled={busy}
            title="Work out which server Smart Join would pick, without joining it"
            onClick={() => send({ type: 'smartJoin/plan', placeId })}
          >
            👁 Preview
          </button>
        ) : null}
        <button
          type="button"
          className="rc-btn"
          disabled={busy}
          onClick={() => send({ type: 'servers/scan', placeId, force: true })}
        >
          ↻ Refresh
        </button>
      </div>

      <div className="rc-health" style={{ marginTop: 8 }}>
        <span className="rc-health__item">🟢 {state.health.clean}</span>
        <span className="rc-health__item">🔴 {state.health.flagged}</span>
        <span className="rc-health__item">❓ {state.health.unknown}</span>
        <span className="rc-health__item">⭐ {state.health.favorites}</span>
        {state.transport.authenticated === false ? (
          <span className="rc-health__caveat">
            ⚠ Guest quota (3/min). Log in to roblox.com to speed scans up.
          </span>
        ) : null}
      </div>
    </div>
  );
}
