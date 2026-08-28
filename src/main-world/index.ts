import { PAGE_MESSAGE_NAMESPACE } from '../config/constants';
import type { PageJoinRequest, PageJoinResponse } from '../models/messages';

/**
 * Runs in the page's own JavaScript context, declared with "world": "MAIN" in the
 * manifest. The older trick of appending a script tag pointing at chrome-extension://
 * no longer works here: roblox.com's CSP does not list that scheme in script-src, so
 * Chrome 130+ blocks it. A declared MAIN-world script is injected by the browser itself
 * and never passes through CSP.
 *
 * Its only job is calling the launcher, so nothing sensitive is exposed to the page.
 */

interface GameLauncher {
  joinGameInstance?: (
    placeId: number,
    gameId: string,
    unused?: boolean,
    isPlayTogetherGame?: boolean,
    joinAttemptId?: string,
    joinAttemptOrigin?: string,
  ) => unknown;
  /** Private servers: the same launcher, entered by access code rather than job id. */
  joinPrivateGame?: (
    placeId: number,
    accessCode: string,
    linkCode?: string,
    joinAttemptId?: string,
    joinAttemptOrigin?: string,
  ) => unknown;
  isJoinAttemptIdEnabled?: () => boolean;
}

declare global {
  interface Window {
    Roblox?: { GameLauncher?: GameLauncher };
  }
}

interface JoinEnvelope extends PageJoinRequest {
  __ns: typeof PAGE_MESSAGE_NAMESPACE;
  kind: 'join';
}

function isJoinEnvelope(value: unknown): value is JoinEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<JoinEnvelope>;
  return v.__ns === PAGE_MESSAGE_NAMESPACE && v.kind === 'join' && typeof v.jobId === 'string';
}

function reply(reqId: string, ok: boolean, reason?: string): void {
  const response: PageJoinResponse & { __ns: string; kind: 'joinResult' } = {
    __ns: PAGE_MESSAGE_NAMESPACE,
    kind: 'joinResult',
    reqId,
    ok,
    ...(reason ? { reason } : {}),
  };
  window.postMessage(response, window.location.origin);
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return;
  if (!isJoinEnvelope(event.data)) return;

  const { reqId, placeId, jobId, accessCode } = event.data;
  const launcher = window.Roblox?.GameLauncher;

  /*
   * A private server is entered by access code, not by job id - a different launcher
   * function with its own name, so its absence is reported separately. The code arrives
   * with the request and is used here and nowhere else: nothing stores it, and it is not
   * put back on the page.
   */
  if (accessCode) {
    if (typeof launcher?.joinPrivateGame !== 'function') {
      reply(reqId, false, 'no-private-launcher');
      return;
    }
    try {
      launcher.joinPrivateGame(Number(placeId), accessCode);
      reply(reqId, true);
    } catch (err) {
      reply(reqId, false, err instanceof Error ? err.message : 'launch-threw');
    }
    return;
  }

  if (typeof launcher?.joinGameInstance !== 'function') {
    reply(reqId, false, 'no-launcher');
    return;
  }

  try {
    // Mirrors the call Roblox's own ServerList component makes, argument for argument.
    const attemptIdEnabled =
      typeof launcher.isJoinAttemptIdEnabled === 'function' ? launcher.isJoinAttemptIdEnabled() : false;
    const joinAttemptId = attemptIdEnabled ? crypto.randomUUID() : undefined;
    const joinAttemptOrigin = attemptIdEnabled ? 'ServerList' : undefined;

    launcher.joinGameInstance(Number(placeId), jobId, false, false, joinAttemptId, joinAttemptOrigin);
    reply(reqId, true);
  } catch (err) {
    reply(reqId, false, err instanceof Error ? err.message : 'launch-threw');
  }
});
