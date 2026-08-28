/**
 * How anything in the content script asks the panel to open.
 *
 * A DOM event rather than a direct call so the Quick Action Bar - plain DOM, mounted on
 * Roblox's own markup - stays decoupled from the React tree inside the shadow root.
 * Neither has to know the other exists, and either can fail without the other.
 */
export const PANEL_EVENT = 'roblox-companion:panel';

export type PanelCommand = 'open' | 'close' | 'toggle';

/** Which tool to show on arrival, so a button can open the pane it is about. */
export interface PanelRequest {
  command: PanelCommand;
  tool?: string;
}

export function requestPanel(command: PanelCommand, tool?: string): void {
  const detail: PanelRequest = tool ? { command, tool } : { command };
  window.dispatchEvent(new CustomEvent(PANEL_EVENT, { detail }));
}

export function onPanelRequest(handler: (command: PanelCommand, tool?: string) => void): () => void {
  const listener = (event: Event): void => {
    const detail = (event as CustomEvent<PanelRequest>).detail;
    const command = detail?.command;
    if (command === 'open' || command === 'close' || command === 'toggle') {
      handler(command, detail.tool);
    }
  };
  window.addEventListener(PANEL_EVENT, listener);
  return () => window.removeEventListener(PANEL_EVENT, listener);
}
