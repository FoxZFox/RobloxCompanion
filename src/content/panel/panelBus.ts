/**
 * How anything in the content script asks the panel to open.
 *
 * A DOM event rather than a direct call so the Quick Action Bar - plain DOM, mounted on
 * Roblox's own markup - stays decoupled from the React tree inside the shadow root.
 * Neither has to know the other exists, and either can fail without the other.
 */
export const PANEL_EVENT = 'roblox-companion:panel';

export type PanelCommand = 'open' | 'close' | 'toggle';

export function requestPanel(command: PanelCommand): void {
  window.dispatchEvent(new CustomEvent(PANEL_EVENT, { detail: command }));
}

export function onPanelRequest(handler: (command: PanelCommand) => void): () => void {
  const listener = (event: Event): void => {
    const command = (event as CustomEvent<PanelCommand>).detail;
    if (command === 'open' || command === 'close' || command === 'toggle') handler(command);
  };
  window.addEventListener(PANEL_EVENT, listener);
  return () => window.removeEventListener(PANEL_EVENT, listener);
}
