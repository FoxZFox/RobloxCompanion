import { RPC_TIMEOUT_MS, TAB_READY_TIMEOUT_MS } from '../../config/constants';
import type { CsRequest } from '../../models/messages';
import { AppError } from '../../utils/errors';
import { sleep, withTimeout } from '../../utils/async';
import { gamePageUrl } from './endpoints';

const ROBLOX_TAB_PATTERN = 'https://www.roblox.com/*';

/**
 * Every network call and every join has to originate from a roblox.com tab: that origin
 * is the only one Roblox's CORS allows, its cookies lift the request out of the
 * three-per-minute guest bucket, and Chrome's remembered "always allow" grant for the
 * roblox-player protocol is keyed to it.
 */
export class RobloxTabBridge {
  async findTab(): Promise<chrome.tabs.Tab | null> {
    const inWindow = await chrome.tabs.query({ url: ROBLOX_TAB_PATTERN, currentWindow: true });
    const anywhere =
      inWindow.length > 0 ? inWindow : await chrome.tabs.query({ url: ROBLOX_TAB_PATTERN });
    // Prefer a game page: its content script already knows the placeId.
    const gamePage = anywhere.find((t) => t.url?.includes('/games/'));
    return gamePage ?? anywhere[0] ?? null;
  }

  async openGameTab(placeId: string, active = true): Promise<chrome.tabs.Tab> {
    const tab = await chrome.tabs.create({ url: gamePageUrl(placeId), active });
    await this.waitForContentScript(tab.id);
    return tab;
  }

  /** Finds a roblox.com tab, opening one only when none exists. */
  async ensureTab(placeId: string, active = false): Promise<chrome.tabs.Tab> {
    const existing = await this.findTab();
    if (existing?.id !== undefined) return existing;
    return this.openGameTab(placeId, active);
  }

  async focus(tabId: number): Promise<void> {
    try {
      const tab = await chrome.tabs.update(tabId, { active: true });
      if (tab?.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
    } catch {
      // Focusing is a nicety; a failure here must not abort the join.
    }
  }

  async send<T>(tabId: number, request: CsRequest, timeoutMs = RPC_TIMEOUT_MS): Promise<T> {
    const call = chrome.tabs.sendMessage(tabId, request) as Promise<T>;
    return withTimeout(
      call.catch((err: unknown) => {
        throw new AppError('NO_ROBLOX_TAB', undefined, { cause: err });
      }),
      timeoutMs,
      () => new AppError('TIMEOUT'),
    );
  }

  /** Sends to whichever roblox.com tab is available, requiring one to exist. */
  async sendToAny<T>(request: CsRequest, timeoutMs = RPC_TIMEOUT_MS): Promise<T> {
    const tab = await this.findTab();
    if (tab?.id === undefined) throw new AppError('NO_ROBLOX_TAB');
    return this.send<T>(tab.id, request, timeoutMs);
  }

  /**
   * A freshly created tab cannot receive messages until its content script runs. Polls
   * with a cheap ping rather than relying on tabs.onUpdated, which fires before
   * document_idle injection completes.
   */
  private async waitForContentScript(tabId: number | undefined): Promise<void> {
    if (tabId === undefined) throw new AppError('NO_ROBLOX_TAB');
    const deadline = Date.now() + TAB_READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'cs/ping' } satisfies CsRequest);
        return;
      } catch {
        await sleep(300);
      }
    }
    throw new AppError('NO_ROBLOX_TAB');
  }
}
