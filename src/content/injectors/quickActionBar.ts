import { INJECT_MARKER, INJECT_TIMEOUT_MS } from '../../config/constants';
import type { Result, UiRequest } from '../../models/messages';
import { parsePlaceId } from '../../utils/robloxUrl';
import { el } from '../../utils/dom';
import { waitForAny } from '../observers/domObserver';
import { requestPanel } from '../panel/panelBus';

/**
 * Anchors for the Play button, in priority order.
 *
 * Roblox reworks this markup regularly, which is exactly why this is a list rather than
 * a selector: when the first stops matching, the next usually still does, and if none
 * match the bar simply never appears while the rest of the extension keeps working
 * (spec section 38).
 */
const PLAY_ANCHORS = [
  '#game-details-play-button-container',
  '.game-calls-to-action',
  '[data-testid="play-button"]',
  '.btn-common-play-game-lg',
  '#game-detail-meta-data',
] as const;

async function send(request: UiRequest): Promise<Result<unknown> | undefined> {
  try {
    return (await chrome.runtime.sendMessage(request)) as Result<unknown>;
  } catch {
    // The service worker was asleep or the extension was reloaded mid-click.
    return undefined;
  }
}

/**
 * Adds the quick action bar next to Play (spec section 2).
 *
 * Actions that are not implemented yet are rendered disabled with an explanation rather
 * than hidden, so the bar's shape stays honest about what the extension can currently do.
 */
export async function injectQuickActionBar(): Promise<void> {
  const placeId = parsePlaceId(window.location.href);
  if (!placeId) return;

  const anchor = await waitForAny(PLAY_ANCHORS, INJECT_TIMEOUT_MS);
  // Give up quietly. The side panel is fully functional without this.
  if (!anchor) return;
  if (anchor.parentElement?.querySelector(`[${INJECT_MARKER}]`)) return;

  const status = el('div', { class: 'rc-quick-bar__status', role: 'status' });

  const bar = el('div', { class: 'rc-quick-bar', [INJECT_MARKER]: 'quick-bar' }, [
    el('span', { class: 'rc-quick-bar__label', text: 'Companion' }),
  ]);

  const lowest = button('\u{1F464} Join Lowest', 'primary', async () => {
    setStatus(status, 'Finding the emptiest server...');
    const result = await send({ type: 'join/lowest', placeId });
    setStatus(status, describe(result, 'Launching Roblox...'));
  });

  /*
   * Both of these were disabled placeholders long after the features behind them shipped:
   * Smart Join arrived in phase 3 and this bar still said "arrives in phase 3", so the
   * most prominent button the extension puts on a game page was dead. A placeholder is
   * honest only until the thing exists; after that it is just wrong.
   */
  const smart = button('⚡ Smart Join', 'primary', async () => {
    setStatus(status, 'Scoring the servers we can see...');
    const result = await send({ type: 'join/smart', placeId });
    setStatus(status, describe(result, 'Launching Roblox...'));
  });

  const priv = button('\u{1F512} Private', 'plain', () => {
    requestPanel('open', 'private');
    setStatus(status, '');
  });
  priv.title = 'The private servers you own for this experience.';

  /*
   * Opens the in-page panel directly.
   *
   * This used to ask the service worker to open Chrome's side panel, which Chrome
   * refuses from a message handler because user gestures do not survive the trip
   * (crbug 355266358) - so the button could only tell the user to go and click the
   * toolbar icon themselves. The panel now lives in this same content script, so the
   * click can simply do the thing it says it does.
   */
  const panel = button('\u{1F50E} Panel', 'plain', () => {
    requestPanel('toggle');
    setStatus(status, '');
  });

  bar.append(smart, lowest, priv, panel, status);
  anchor.insertAdjacentElement('afterend', bar);
}

function button(
  label: string,
  variant: 'primary' | 'plain',
  onClick: () => void | Promise<void>,
): HTMLButtonElement {
  const node = el('button', {
    class: `rc-quick-bar__btn${variant === 'primary' ? ' rc-quick-bar__btn--primary' : ''}`,
    type: 'button',
    'aria-label': label,
    text: label,
  });
  node.addEventListener('click', () => {
    void onClick();
  });
  return node;
}

function setStatus(node: HTMLElement, message: string): void {
  node.textContent = message;
}

function describe(result: Result<unknown> | undefined, success: string): string {
  if (!result) return 'Extension is not responding - try reloading the page.';
  return result.ok ? success : result.error.message;
}
