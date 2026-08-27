import '../components/theme.css';
import './injectors/quickActionBar.css';

import type { CsContextResponse, CsRequest } from '../models/messages';
import { runStrategy } from './joinBridge';
import { pageGet, pagePost } from './pageFetch';
import { onLocationChange } from './observers/domObserver';
import { injectQuickActionBar } from './injectors/quickActionBar';
import { mountPanel } from './panel/mountPanel';
import { parsePlaceId } from '../utils/robloxUrl';

/**
 * Content script entry (ISOLATED world).
 *
 * Two jobs: proxy Roblox requests from an origin whose cookies are first-party, and
 * mount the injected page UI. Each injector is isolated so a selector Roblox renames
 * takes down only its own feature.
 */

type Responder = (response: unknown) => void;

chrome.runtime.onMessage.addListener((message: CsRequest, _sender, sendResponse: Responder) => {
  switch (message.type) {
    case 'cs/ping':
      sendResponse({ ok: true });
      return false;

    case 'cs/context':
      sendResponse(readContext());
      return false;

    case 'cs/fetch':
      pageGet(message.url).then(sendResponse, () => sendResponse(undefined));
      return true;

    case 'cs/post':
      pagePost(message.url, message.body, message.csrfToken).then(sendResponse, () =>
        sendResponse(undefined),
      );
      return true;

    // Handled by the panel's own listener; acknowledged here so the sender sees success.
    case 'cs/togglePanel':
      sendResponse({ ok: true });
      return false;

    case 'cs/join':
      runStrategy(message.strategy, message.placeId, message.jobId).then(sendResponse, () =>
        sendResponse({ ok: false, reason: 'bridge-failed' }),
      );
      return true;

    default:
      return false;
  }
});

/**
 * Roblox exposes the signed-in user id on the page. Reading it tells us whether a join
 * will silently open a login modal instead of launching, which turns a mystifying no-op
 * into an actionable message.
 */
function readContext(): CsContextResponse {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="user-data"]');
  const userId = meta?.getAttribute('data-userid');
  const loggedIn = userId ? userId !== '0' && userId !== '' : null;

  const root = document.documentElement;
  const theme = root.classList.contains('dark-theme')
    ? 'dark'
    : root.classList.contains('light-theme')
      ? 'light'
      : null;

  return { loggedIn, placeId: parsePlaceId(window.location.href), theme };
}

/**
 * Roblox's theme class sits on an ancestor that is not always <html>, so mirror it up
 * to the root. Our tokens key off the root, which keeps injected UI in step with
 * whatever theme the user picked on Roblox.
 */
function syncTheme(): void {
  const source = document.querySelector('.dark-theme, .light-theme');
  if (!source) return;
  const dark = source.classList.contains('dark-theme');
  document.documentElement.classList.toggle('dark-theme', dark);
  document.documentElement.classList.toggle('light-theme', !dark);
}

function mount(): void {
  syncTheme();
  // Each injector is isolated: one failing must not prevent the others from running.
  // The panel goes first because it is the primary surface and does not depend on
  // Roblox's markup at all, so it survives any layout change they make.
  try {
    mountPanel();
  } catch {
    // Never leave the page worse than we found it.
  }
  void injectQuickActionBar().catch(() => undefined);
}

mount();
onLocationChange(mount);
