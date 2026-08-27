import { describe, expect, it } from 'vitest';
import { POPUP_PATH, surfaceBehavior } from './surfaceBehavior';

describe('surfaceBehavior', () => {
  it('clears the action popup when the panel is preferred', () => {
    // Chrome ignores openPanelOnActionClick while a popup is registered, so leaving the
    // popup in place would make the panel unreachable from the icon. This is the exact
    // bug that made the side panel impossible to open.
    const behavior = surfaceBehavior('panel');
    expect(behavior.actionPopup).toBe('');
    expect(behavior.openPanelOnActionClick).toBe(true);
  });

  it('restores the popup when the popup is preferred', () => {
    const behavior = surfaceBehavior('popup');
    expect(behavior.actionPopup).toBe(POPUP_PATH);
    expect(behavior.openPanelOnActionClick).toBe(false);
  });

  it('never enables both, since Chrome would silently pick the popup', () => {
    for (const surface of ['panel', 'popup'] as const) {
      const behavior = surfaceBehavior(surface);
      expect(behavior.actionPopup !== '' && behavior.openPanelOnActionClick).toBe(false);
    }
  });

  it('points at a popup path the manifest actually ships', () => {
    expect(POPUP_PATH).toBe('src/popup/index.html');
  });
});

describe('in-page surface', () => {
  it('clears both, so the click reaches chrome.action.onClicked', () => {
    // The in-page window lives in the content script, so the service worker has to
    // receive the click to forward it. A registered popup would swallow it, and
    // openPanelOnActionClick would open the wrong surface.
    const behavior = surfaceBehavior('inpage');
    expect(behavior.actionPopup).toBe('');
    expect(behavior.openPanelOnActionClick).toBe(false);
  });

  it('is distinguishable from the side-panel surface', () => {
    expect(surfaceBehavior('inpage').openPanelOnActionClick).toBe(false);
    expect(surfaceBehavior('panel').openPanelOnActionClick).toBe(true);
  });

  it('never registers a popup for any surface that is not the popup', () => {
    for (const surface of ['inpage', 'panel'] as const) {
      expect(surfaceBehavior(surface).actionPopup).toBe('');
    }
    expect(surfaceBehavior('popup').actionPopup).toBe(POPUP_PATH);
  });
});
