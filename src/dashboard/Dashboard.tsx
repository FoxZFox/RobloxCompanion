import '../components/theme.css';
import '../components/CommandCenter.css';
import { useAppState } from '../hooks/useAppState';
import { useThemeTokens } from '../hooks/useThemeTokens';
import type { AppState } from '../models/messages';
import { STATUS_META } from '../models/server';
import { formatAgo, formatTime, shortJobId } from '../utils/format';

/**
 * Full-page overview (spec section 39).
 *
 * Phase 2 fills in the panels backed by data that actually exists. Profiles, avatar and
 * trading are listed as upcoming rather than shown as empty widgets, so the page never
 * implies it is tracking something it is not.
 */
export function Dashboard(): React.JSX.Element {
  const { state, error } = useAppState();
  useThemeTokens(state);

  if (!state) {
    return (
      <div className="rc-root">
        <div className="rc-empty">{error ? error.message : 'Loading…'}</div>
      </div>
    );
  }

  return (
    <div className="rc-root" style={{ maxWidth: 980, margin: '0 auto', minHeight: '100vh' }}>
      <header className="rc-header">
        <h1 className="rc-header__title">
          Roblox Companion
          <div className="rc-header__sub">Dashboard</div>
        </h1>
        <button
          type="button"
          className="rc-icon-btn"
          aria-label="Settings"
          onClick={() => void chrome.runtime.openOptionsPage()}
        >
          ⚙
        </button>
      </header>

      <div className="rc-body">
        <Overview state={state} />

        <section className="rc-card" style={{ marginBottom: 12 }}>
          <div className="rc-card__label">Flagged servers</div>
          {state.flagged.length === 0 ? (
            <div className="rc-empty">
              Nothing flagged yet.
              <div className="rc-empty__hint">
                Flag a server from the popup or side panel right after you leave it.
              </div>
            </div>
          ) : (
            state.flagged.map((view) => (
              <div className="rc-row" key={view.jobId}>
                <div className="rc-row__top">
                  <span className={`rc-chip rc-chip--${view.status}`}>
                    {STATUS_META[view.status].icon} {STATUS_META[view.status].label}
                  </span>
                  <span className="rc-row__region">{describeLiveness(view.liveness)}</span>
                </div>
                <div className="rc-meta">
                  <span>
                    {view.playing} / {view.maxPlayers || '?'}
                  </span>
                  <span className="rc-meta__sep">·</span>
                  <span title={view.jobId}>{shortJobId(view.jobId)}</span>
                  {view.reportedAt ? (
                    <>
                      <span className="rc-meta__sep">·</span>
                      <span>flagged {formatAgo(view.reportedAt)}</span>
                    </>
                  ) : null}
                </div>
                {view.note ? <div className="rc-meta">{view.note}</div> : null}
              </div>
            ))
          )}
        </section>

        <section className="rc-card" style={{ marginBottom: 12 }}>
          <div className="rc-card__label">Recent joins</div>
          {state.history.slice(0, 10).map((entry) => (
            <div className="rc-row" key={`${entry.jobId}-${entry.joinedAt}`}>
              <div className="rc-row__top">
                <strong>{entry.gameName ?? `Place ${entry.placeId}`}</strong>
                <span className="rc-row__region">{formatTime(entry.joinedAt)}</span>
              </div>
              <div className="rc-meta">
                <span className={`rc-chip rc-chip--${entry.status}`}>
                  {STATUS_META[entry.status].label}
                </span>
                <span className="rc-meta__sep">·</span>
                <span title={entry.jobId}>{shortJobId(entry.jobId)}</span>
              </div>
            </div>
          ))}
          {state.history.length === 0 ? <div className="rc-empty">No joins recorded yet.</div> : null}
        </section>

        <section className="rc-card">
          <div className="rc-card__label">Coming later</div>
          <div className="rc-meta">
            Profiles (phase 8) · Avatar (phase 8) · Trading (phase 9). These are listed rather than
            shown as empty widgets, because nothing is being tracked for them yet.
          </div>
        </section>
      </div>
    </div>
  );
}

function Overview({ state }: { state: AppState }): React.JSX.Element {
  const exploitEncounters = state.flagged.filter((v) => v.status === 'exploiters').length;

  return (
    <section className="rc-card" style={{ marginBottom: 12 }}>
      <div className="rc-card__label">Overview</div>
      <div className="rc-health">
        <Stat label="Servers loaded" value={state.scan.scanned} />
        <Stat label="Clean" value={state.health.clean} />
        <Stat label="Flagged" value={state.health.flagged} />
        <Stat label="Exploiter reports" value={exploitEncounters} />
        <Stat label="Joins recorded" value={state.history.length} />
        <Stat label="Blacklisted players" value={state.blacklist.length} />
      </div>
      {!state.scan.complete && state.scan.scanned > 0 ? (
        <div className="rc-health__caveat" style={{ marginTop: 6 }}>
          Counts cover the servers Roblox let us page through, not every server in the experience.
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <span className="rc-health__item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
      <strong style={{ fontSize: 18 }}>{value}</strong>
      <span className="rc-header__sub">{label}</span>
    </span>
  );
}

function describeLiveness(liveness: string): string {
  // "unseen" is not "offline": Roblox's pagination cap means absence proves nothing.
  if (liveness === 'online') return 'online';
  if (liveness === 'offline') return 'offline';
  return 'not in the last scan';
}
