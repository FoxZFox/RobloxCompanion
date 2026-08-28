import { PAGE_MESSAGE_NAMESPACE, RPC_TIMEOUT_MS } from '../config/constants';
import type { JoinStrategyName, PageJoinResponse } from '../models/messages';
import { nextId } from '../utils/async';

interface JoinResultEnvelope extends PageJoinResponse {
  __ns: typeof PAGE_MESSAGE_NAMESPACE;
  kind: 'joinResult';
}

function isJoinResult(value: unknown): value is JoinResultEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<JoinResultEnvelope>;
  return v.__ns === PAGE_MESSAGE_NAMESPACE && v.kind === 'joinResult' && typeof v.reqId === 'string';
}

/**
 * Asks the MAIN-world script to launch a server, correlating request and response by id
 * so two concurrent joins cannot resolve each other's promise.
 */
export function requestJoin(
  placeId: string,
  jobId: string,
  accessCode?: string,
): Promise<PageJoinResponse> {
  const reqId = nextId('join');

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve({ reqId, ok: false, reason: 'timeout' });
    }, RPC_TIMEOUT_MS);

    function onMessage(event: MessageEvent): void {
      if (event.source !== window) return;
      if (!isJoinResult(event.data) || event.data.reqId !== reqId) return;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(event.data);
    }

    window.addEventListener('message', onMessage);
    window.postMessage(
      {
        __ns: PAGE_MESSAGE_NAMESPACE,
        kind: 'join',
        reqId,
        placeId,
        jobId,
        ...(accessCode ? { accessCode } : {}),
      },
      window.location.origin,
    );
  });
}

/**
 * The deep link. Roblox documents gameInstanceId here, but the client frequently ignores
 * it, so this is only ever reached after the two better strategies have failed and the
 * user is warned when it is used.
 */
export function requestDeeplink(placeId: string, jobId: string): PageJoinResponse {
  const reqId = nextId('deep');
  try {
    const url = `roblox://placeId=${encodeURIComponent(placeId)}&gameInstanceId=${encodeURIComponent(jobId)}`;
    window.location.href = url;
    return { reqId, ok: true };
  } catch (err) {
    return { reqId, ok: false, reason: err instanceof Error ? err.message : 'deeplink-failed' };
  }
}

export function runStrategy(
  strategy: JoinStrategyName,
  placeId: string,
  jobId: string,
  accessCode?: string,
): Promise<PageJoinResponse> {
  if (strategy === 'deeplink') return Promise.resolve(requestDeeplink(placeId, jobId));
  return requestJoin(placeId, jobId, accessCode);
}
