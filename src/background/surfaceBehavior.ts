import type { SurfacePreference } from '../models/settings';

export interface SurfaceBehavior {
  /** Empty string clears the popup, which is what lets the action open the panel. */
  actionPopup: string;
  openPanelOnActionClick: boolean;
}

export const POPUP_PATH = 'src/popup/index.html';

/**
 * Maps the user's surface preference onto what clicking the toolbar icon does.
 *
 * Chrome will not let an extension open the side panel from a message handler: user
 * gestures do not survive `chrome.runtime.sendMessage`, so `sidePanel.open()` called
 * from the service worker throws "may only be called in response to a user gesture"
 * (crbug 355266358). The only fully reliable way to open the panel in one click is to
 * let Chrome do it natively via `openPanelOnActionClick`.
 *
 * That behaviour is ignored while an action popup is registered, so choosing the panel
 * means clearing the popup as well. Hence one setting driving both fields.
 */
export function surfaceBehavior(surface: SurfacePreference): SurfaceBehavior {
  switch (surface) {
    case 'panel':
      return { actionPopup: '', openPanelOnActionClick: true };
    case 'inpage':
      // Both cleared: the click has to reach chrome.action.onClicked so it can be
      // forwarded to the content script, which is what actually owns the window.
      return { actionPopup: '', openPanelOnActionClick: false };
    case 'popup':
    default:
      return { actionPopup: POPUP_PATH, openPanelOnActionClick: false };
  }
}

/**
 * Applied on install, on startup and whenever the setting changes. Both calls are
 * best-effort: on a Chrome without the sidePanel API the popup path still works.
 */
export async function applySurfaceBehavior(surface: SurfacePreference): Promise<void> {
  const behavior = surfaceBehavior(surface);

  try {
    await chrome.action.setPopup({ popup: behavior.actionPopup });
  } catch {
    // Nothing actionable; the manifest default stays in effect.
  }

  try {
    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: behavior.openPanelOnActionClick,
    });
  } catch {
    // Older Chrome without setPanelBehavior; the popup remains reachable.
  }
}
