import { useEffect, useRef, useState } from 'react';
import './theme.css';
import './CommandCenter.css';
import { useAppState } from '../hooks/useAppState';
import type { AppState, UiRequest } from '../models/messages';
import { LastJoinedCard } from './LastJoinedCard';
import { SmartJoinPanel } from './SmartJoinPanel';
import { BlacklistTab, HistoryTab, ServersTab } from './tabs';
import { PlaytimePane } from './PlaytimePane';

type TabKey = 'servers' | 'history' | 'blacklist' | 'playtime';

interface TabDefinition {
  key: TabKey;
  label: string;
  /** Hidden when its feature is switched off, mirroring the in-page panel's rail. */
  flag?: keyof AppState['settings']['features'];
}

const TABS: readonly TabDefinition[] = [
  { key: 'servers', label: 'Servers', flag: 'servers' },
  { key: 'history', label: 'History', flag: 'serverHistory' },
  { key: 'blacklist', label: 'Blacklist', flag: 'playerBlacklist' },
  { key: 'playtime', label: 'Time', flag: 'playtime' },
];

/**
 * The one component both the popup and the side panel render (decision 2).
 *
 * They are equal surfaces on purpose: the popup is faster to reach, but Chrome closes it
 * the instant the user alt-tabs to Roblox, which would break the join -> play -> flag
 * loop. The side panel survives that, so the user picks whichever suits them and gets
 * exactly the same thing.
 */
export function CommandCenter({ surface }: { surface: 'popup' | 'panel' }): React.JSX.Element {
  const { state, error, busy, toasts, send } = useAppState();
  const [tab, setTab] = useState<TabKey>('servers');
  const openPanel = useOpenSidePanel();

  const dispatch = (request: UiRequest): void => {
    void send(request);
  };

  if (!state) {
    return (
      <div className="rc-root">
        <div className="rc-empty">{error ? error.message : 'Loading…'}</div>
      </div>
    );
  }

  const placeId = state.experience?.placeId;

  return (
    <div className="rc-root">
      <header className="rc-header">
        <h1 className="rc-header__title">
          Roblox Companion
          <div className="rc-header__sub">
            {state.experience?.name ?? (placeId ? `Place ${placeId}` : 'No experience open')}
          </div>
        </h1>

        {surface === 'popup' ? (
          <button
            type="button"
            className="rc-icon-btn"
            title="Open the side panel, which stays open when you alt-tab"
            aria-label="Open side panel"
            onClick={openPanel}
          >
            📌
          </button>
        ) : null}

        <button
          type="button"
          className="rc-icon-btn"
          title="Settings"
          aria-label="Settings"
          onClick={() => void chrome.runtime.openOptionsPage()}
        >
          ⚙
        </button>
      </header>

      <div className="rc-pinned">
        <LastJoinedCard state={state} busy={busy} send={dispatch} />
        <QuickActions state={state} busy={busy} send={dispatch} />
        <SmartJoinPanel state={state} />
        <Health state={state} />
      </div>

      <nav className="rc-tabs" role="tablist">
        {TABS.filter((entry) => !entry.flag || state.settings.features[entry.flag]).map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            className="rc-tab"
            aria-selected={tab === entry.key}
            onClick={() => setTab(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      <div className="rc-body" role="tabpanel">
        {error ? <div className="rc-banner">{error.message}</div> : null}
        {tab === 'servers' ? <ServersTab state={state} busy={busy} send={dispatch} /> : null}
        {tab === 'history' ? <HistoryTab state={state} busy={busy} send={dispatch} /> : null}
        {tab === 'blacklist' ? <BlacklistTab state={state} busy={busy} send={dispatch} /> : null}
        {tab === 'playtime' ? <PlaytimePane state={state} busy={busy} send={dispatch} /> : null}
      </div>

      {toasts.length > 0 ? (
        <div className="rc-toasts">
          {toasts.map((toast) => (
            <div key={toast.id} className={`rc-toast rc-toast--${toast.level}`} role="status">
              {toast.message}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Opens the side panel from the popup itself, never through the service worker.
 *
 * Two rules make this work where the message-passing version failed:
 *   1. The popup has its own user gesture, and calling a chrome API from its click
 *      handler keeps it. Routing through sendMessage loses it (crbug 355266358).
 *   2. The window id is resolved on mount, so the click handler calls open() with no
 *      preceding await - an await inside the handler can spend the gesture first.
 */
function useOpenSidePanel(): () => void {
  const windowId = useRef<number | undefined>(undefined);

  useEffect(() => {
    void chrome.windows
      .getCurrent()
      .then((win) => {
        windowId.current = win.id;
      })
      .catch(() => undefined);
  }, []);

  return () => {
    const id = windowId.current;
    if (id === undefined) return;
    // Deliberately not awaited before the call: this must be the first thing that runs.
    void chrome.sidePanel.open({ windowId: id }).then(
      () => window.close(),
      () => undefined,
    );
  };
}

function QuickActions({
  state,
  busy,
  send,
}: {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
}): React.JSX.Element | null {
  const placeId = state.experience?.placeId;
  if (!placeId) return null;

  return (
    <div>
      <button
        type="button"
        className="rc-btn rc-btn--primary rc-btn--big"
        style={{ width: '100%' }}
        disabled={busy || !state.settings.features.smartJoin}
        title={
          state.settings.features.smartJoin
            ? 'Score every loaded server and join the best one'
            : 'Smart Join is switched off in Settings'
        }
        onClick={() => send({ type: 'join/smart', placeId })}
      >
        ⚡ SMART JOIN
      </button>

      {state.settings.features.smartJoin ? (
        <button
          type="button"
          className="rc-btn"
          style={{ width: '100%', marginTop: 4 }}
          disabled={busy}
          title="Work out which server Smart Join would pick, without joining it"
          onClick={() => send({ type: 'smartJoin/plan', placeId })}
        >
          Preview the choice
        </button>
      ) : null}

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
        <button
          type="button"
          className="rc-btn"
          disabled
          title="Arrives in phase 6, once the private server API is verified against live traffic."
        >
          🔒 Private
        </button>
        <button
          type="button"
          className="rc-btn"
          disabled={busy}
          onClick={() => send({ type: 'servers/scan', placeId, force: true })}
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  );
}

function Health({ state }: { state: AppState }): React.JSX.Element {
  const { health, transport } = state;

  return (
    <div className="rc-card">
      <div className="rc-card__label">Server health</div>
      <div className="rc-health">
        <span className="rc-health__item">🟢 {health.clean} clean</span>
        <span className="rc-health__item">🔴 {health.flagged} flagged</span>
        <span className="rc-health__item">❓ {health.unknown} unchecked</span>
        <span className="rc-health__item">⭐ {health.favorites}</span>

        {/*
          Never "N blacklisted players avoided": we cannot see who is in a server, so
          claiming avoidance would be a claim we did not earn (spec section 13).
        */}
        <span className="rc-health__caveat">
          {health.blacklistedPlayers} blacklisted player(s) on your list — Roblox does not reveal
          who is in a public server, so servers cannot be checked against it.
        </span>

        {transport.authenticated === false ? (
          <span className="rc-health__caveat">
            ⚠ Guest quota (3/min). Log in to roblox.com and keep a tab open to speed scans up.
          </span>
        ) : null}
      </div>
    </div>
  );
}
