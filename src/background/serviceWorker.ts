import type { UiRequest } from '../models/messages';
import { registerAlarms } from './alarms';
import { AppContext } from './context';
import { handleRequest } from './messageRouter';
import { applySurfaceBehavior } from './surfaceBehavior';

/**
 * MV3 service workers are torn down when idle and restarted on the next event, so the
 * context is built lazily and every handler awaits it rather than assuming it exists.
 */
let contextPromise: Promise<AppContext> | null = null;

function getContext(): Promise<AppContext> {
  contextPromise ??= AppContext.create().then((context) => {
    registerAlarms(context);
    return context;
  });
  return contextPromise;
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isUiRequest(message)) return false;

  void (async () => {
    try {
      const context = await getContext();
      sendResponse(await handleRequest(context, message));
    } catch (err) {
      sendResponse({
        ok: false,
        error: { code: 'INTERNAL', message: err instanceof Error ? err.message : String(err) },
      });
    }
  })();

  // Keeps the message channel open for the async response above.
  return true;
});

/**
 * What the toolbar icon does is driven by the user's surface preference, so it has to be
 * re-applied whenever the worker starts, not just at install time.
 */
async function syncSurface(): Promise<void> {
  const context = await getContext();
  const settings = await context.settings.get();
  await applySurfaceBehavior(settings.surface);
}

chrome.runtime.onInstalled.addListener(() => {
  void syncSurface();
});

chrome.runtime.onStartup.addListener(() => {
  void syncSurface();
});

/**
 * Only fires when no action popup is registered, which is exactly the `inpage` and
 * `panel` cases. The in-page window lives in the content script, so the click is
 * forwarded there rather than handled here.
 */
chrome.action.onClicked.addListener((tab) => {
  void (async () => {
    const context = await getContext();
    const settings = await context.settings.get();
    if (settings.surface !== 'inpage') return;

    if (tab.id !== undefined && tab.url?.startsWith('https://www.roblox.com/')) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'cs/togglePanel' });
        return;
      } catch {
        // Content script not ready on this page; fall through.
      }
    }

    // Off Roblox there is no page to inject into, so give them the full dashboard
    // rather than doing nothing at all.
    await chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
  })();
});

function isUiRequest(value: unknown): value is UiRequest {
  return typeof value === 'object' && value !== null && typeof (value as UiRequest).type === 'string';
}
