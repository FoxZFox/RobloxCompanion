import { useCallback, useEffect, useState } from 'react';
import { useAppState } from '../../hooks/useAppState';
import { useLiveStats } from '../../hooks/useLiveStats';
import type { UiRequest } from '../../models/messages';
import { useDraggable, type Point, type Size } from './useDraggable';
import { resolveTool, visibleTools } from './tools';
import { onPanelRequest } from './panelBus';
import { CommandPalette } from './CommandPalette';
import { usePaletteHotkey } from './useHotkey';
import { detectPageContext, parseUserId } from '../../utils/robloxUrl';

const DEFAULT_SIZE: Size = { width: 420, height: 560 };

/**
 * The floating Command Center, living inside the Roblox page.
 *
 * This is the primary surface. The popup closes the instant the user alt-tabs, and the
 * side panel takes a fixed slice of the window whether or not it is being used; this
 * window sits over the page the user is already looking at, can be dragged out of the
 * way, and keeps its place between visits.
 */
export function PanelShell(): React.JSX.Element | null {
  const { state, error, busy, toasts, send } = useAppState();
  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [toolId, setToolId] = useState('servers');
  const [hydrated, setHydrated] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const dispatch = useCallback(
    (request: UiRequest): void => {
      void send(request);
    },
    [send],
  );

  // Adopt the stored window state once, on the first snapshot that arrives.
  useEffect(() => {
    if (hydrated || !state) return;
    setOpen(state.settings.panel.open);
    setMinimised(state.settings.panel.minimised);
    setToolId(state.settings.panel.tool);
    setHydrated(true);
  }, [state, hydrated]);

  const persistPlacement = useCallback(
    (point: Point) => {
      dispatch({ type: 'settings/set', patch: { panel: { x: point.x, y: point.y } } });
    },
    [dispatch],
  );

  const stored = state?.settings.panel;
  const initial: Point | null =
    stored && (stored.x !== 0 || stored.y !== 0) ? { x: stored.x, y: stored.y } : null;

  const { position, size, dragging, startDrag, startResize } = useDraggable(
    initial,
    DEFAULT_SIZE,
    persistPlacement,
  );

  const setOpenState = (next: boolean): void => {
    setOpen(next);
    dispatch({ type: 'settings/set', patch: { panel: { open: next } } });
  };

  const selectTool = (id: string): void => {
    setToolId(id);
    dispatch({ type: 'settings/set', patch: { panel: { tool: id } } });
  };

  const toggleMinimised = (): void => {
    const next = !minimised;
    setMinimised(next);
    dispatch({ type: 'settings/set', patch: { panel: { minimised: next } } });
  };

  /*
   * Stats start loading the moment the window opens, not when the Time tool is picked,
   * so they are already there by the time the user goes looking. Gated on `open` so a
   * closed panel never causes traffic.
   */
  useLiveStats(state, dispatch, open);

  /*
   * The palette works whether or not the window is open - it is a way in, not a feature
   * of the window - so the hotkey is live even while the panel is closed. It still
   * honours its feature flag: a shortcut that hijacks Ctrl+K has to be switchable off.
   */
  usePaletteHotkey(
    () => setPaletteOpen(true),
    state?.settings.features.commandPalette ?? false,
  );

  // Two ways in: the toolbar icon, which arrives via the service worker, and anything
  // else in the content script - notably the Quick Action Bar beside Roblox's Play button.
  useEffect(() => {
    const onMessage = (message: { type?: string }): void => {
      if (message?.type === 'cs/togglePanel') setOpenState(!open);
    };
    chrome.runtime.onMessage.addListener(onMessage);
    const stopBus = onPanelRequest((command) => {
      setOpenState(command === 'toggle' ? !open : command === 'open');
    });
    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
      stopBus();
    };
  });

  if (!state) return null;

  const palette = paletteOpen ? (
    <CommandPalette
      ctx={{
        state,
        page: detectPageContext(window.location.href),
        userId: parseUserId(window.location.href),
        send: dispatch,
        copy: copyText,
        openPanel: (tool) => {
          if (tool) selectTool(tool);
          setOpenState(true);
        },
      }}
      onClose={() => setPaletteOpen(false)}
    />
  ) : null;

  const tools = visibleTools(state);
  const active = resolveTool(state, toolId);
  const attention = state.health.flagged;

  if (!open) {
    return (
      <>
        {palette}
        <button
          type="button"
          className="rc-launcher"
          title="Open Roblox Companion (Ctrl+K for commands)"
          onClick={() => setOpenState(true)}
        >
          <span className="rc-launcher__mark" aria-hidden="true" />
          <span>Companion</span>
          {attention > 0 ? <span className="rc-launcher__badge">{attention}</span> : null}
        </button>
      </>
    );
  }

  return (
    <>
    {palette}
    <div
      className={`rc-panel${minimised ? ' rc-panel--minimised' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        ...(minimised ? {} : { height: size.height }),
      }}
      role="dialog"
      aria-label="Roblox Companion"
    >
      <div
        className={`rc-titlebar${dragging ? ' rc-titlebar--dragging' : ''}`}
        onPointerDown={startDrag}
      >
        <span className="rc-titlebar__grip" aria-hidden="true">
          ⠿
        </span>
        <span className="rc-titlebar__title">
          {active.title}
          <span className="rc-titlebar__sub">
            {state.experience?.name ??
              (state.experience?.placeId ? `Place ${state.experience.placeId}` : 'No experience open')}
          </span>
        </span>
        <button
          type="button"
          className="rc-iconbtn"
          aria-label="Settings"
          title="Settings"
          onClick={() => dispatch({ type: 'ui/openOptions' })}
        >
          ⚙
        </button>
        <button
          type="button"
          className="rc-iconbtn"
          aria-label={minimised ? 'Expand' : 'Collapse'}
          title={minimised ? 'Expand' : 'Collapse'}
          onClick={toggleMinimised}
        >
          {minimised ? '▢' : '—'}
        </button>
        <button
          type="button"
          className="rc-iconbtn"
          aria-label="Close"
          title="Close"
          onClick={() => setOpenState(false)}
        >
          ✕
        </button>
      </div>

      {minimised ? null : (
        <>
          <div className="rc-body">
            <nav className="rc-rail" aria-label="Tools">
              {tools.map((tool) => {
                const count = tool.badge?.(state) ?? 0;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    className={`rc-rail__btn${tool.id === active.id ? ' rc-rail__btn--on' : ''}`}
                    aria-current={tool.id === active.id}
                    title={tool.title}
                    onClick={() => selectTool(tool.id)}
                  >
                    <span className="rc-rail__icon" aria-hidden="true">
                      {tool.icon}
                    </span>
                    <span className="rc-rail__label">{tool.label}</span>
                    {count > 0 ? <span className="rc-rail__dot" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </nav>

            <div className="rc-content">
              {error ? <div className="rc-banner">{error.message}</div> : null}
              {toasts.map((toast) => (
                <div key={toast.id} className={`rc-toast rc-toast--${toast.level}`} role="status">
                  {toast.message}
                </div>
              ))}
              {active.render({ state, busy, send: dispatch })}
            </div>
          </div>

          <div
            className="rc-resize"
            role="separator"
            aria-label="Resize panel"
            onPointerDown={startResize}
          />
        </>
      )}
    </div>
    </>
  );
}

/**
 * Clipboard from a content script.
 *
 * navigator.clipboard needs a secure context and can be refused, so a textarea fallback
 * keeps "copy user ID" working rather than failing silently.
 */
function copyText(text: string): void {
  void navigator.clipboard?.writeText(text).catch(() => {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    try {
      document.execCommand('copy');
    } finally {
      area.remove();
    }
  });
}
