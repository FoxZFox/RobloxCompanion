import type { CsContextResponse, JoinStrategyName } from '../../models/messages';
import { gameStartUrl } from '../../services/roblox/endpoints';
import type { RobloxTabBridge } from '../../services/roblox/robloxTab';
import { AppError } from '../../utils/errors';

export interface JoinStrategy {
  readonly name: JoinStrategyName;
  join(placeId: string, jobId: string, tabId: number): Promise<void>;
}

/**
 * Calls the same function roblox.com's own server browser calls, verified against
 * Roblox's ServerList bundle, which invokes it with exactly this argument list. Runs in
 * the page's MAIN world, since window.Roblox does not exist in the isolated content
 * script world.
 */
export class GameLauncherStrategy implements JoinStrategy {
  readonly name = 'gameLauncher' as const;

  constructor(private readonly tabs: RobloxTabBridge) {}

  async join(placeId: string, jobId: string, tabId: number): Promise<void> {
    const result = await this.tabs.send<{ ok: boolean; reason?: string } | undefined>(tabId, {
      type: 'cs/join',
      placeId,
      jobId,
      strategy: this.name,
    });
    if (!result?.ok) {
      throw new AppError(result?.reason === 'no-launcher' ? 'LAUNCHER_MISSING' : 'JOIN_FAILED');
    }
  }
}

/** Roblox's documented web entry point. Navigates the tab, so the page reloads. */
export class StartUrlStrategy implements JoinStrategy {
  readonly name = 'startUrl' as const;

  async join(placeId: string, jobId: string, tabId: number): Promise<void> {
    await chrome.tabs.update(tabId, { url: gameStartUrl(placeId, jobId) });
  }
}

/**
 * Last resort. Roblox documents gameInstanceId on this deep link, but reports from 2025
 * onward say the client frequently ignores it and drops the player into an arbitrary
 * server, so callers must warn the user when this one is reached.
 */
export class DeeplinkStrategy implements JoinStrategy {
  readonly name = 'deeplink' as const;

  constructor(private readonly tabs: RobloxTabBridge) {}

  async join(placeId: string, jobId: string, tabId: number): Promise<void> {
    const result = await this.tabs.send<{ ok: boolean; reason?: string } | undefined>(tabId, {
      type: 'cs/join',
      placeId,
      jobId,
      strategy: this.name,
    });
    if (!result?.ok) throw new AppError('JOIN_FAILED');
  }
}

export interface JoinReport {
  strategy: JoinStrategyName;
  /** True when we fell through to a strategy that may not honour the jobId. */
  unreliable: boolean;
}

/**
 * Tries each strategy in order and stops at the first that works.
 *
 * Every strategy is driven from a roblox.com tab on purpose: Chrome stores the
 * "always allow" decision for the roblox-player protocol per origin, and Roblox players
 * have almost always granted it to roblox.com already, so launching from there skips the
 * confirmation dialog entirely. Launching from the extension's own origin would prompt
 * again, and Chrome silently blocks protocol launches that do not follow a user gesture.
 */
export class JoinService {
  private readonly strategies: JoinStrategy[];

  constructor(
    private readonly tabs: RobloxTabBridge,
    strategies?: JoinStrategy[],
  ) {
    this.strategies = strategies ?? [
      new GameLauncherStrategy(tabs),
      new StartUrlStrategy(),
      new DeeplinkStrategy(tabs),
    ];
  }

  async join(placeId: string, jobId: string): Promise<JoinReport> {
    const tab = await this.tabs.ensureTab(placeId, true);
    if (tab.id === undefined) throw new AppError('NO_ROBLOX_TAB');
    await this.tabs.focus(tab.id);

    await this.assertLoggedIn(tab.id);

    let lastError: unknown = new AppError('JOIN_FAILED');
    for (const strategy of this.strategies) {
      try {
        await strategy.join(placeId, jobId, tab.id);
        return { strategy: strategy.name, unreliable: strategy.name === 'deeplink' };
      } catch (err) {
        lastError = err;
      }
    }
    throw AppError.from(lastError);
  }

  /**
   * Roblox's launcher opens a login modal and silently gives up when signed out.
   * Detecting that first turns a mystifying no-op into a message the user can act on.
   */
  private async assertLoggedIn(tabId: number): Promise<void> {
    try {
      const ctx = await this.tabs.send<CsContextResponse | undefined>(tabId, { type: 'cs/context' });
      if (ctx?.loggedIn === false) throw new AppError('NOT_LOGGED_IN');
    } catch (err) {
      if (err instanceof AppError && err.code === 'NOT_LOGGED_IN') throw err;
      // Any other failure here is inconclusive; let the join attempt speak for itself.
    }
  }
}
