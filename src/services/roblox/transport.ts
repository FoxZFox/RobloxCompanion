import { GUEST_RATE_LIMIT_THRESHOLD } from '../../config/constants';
import type { CsFetchResponse, TransportState } from '../../models/messages';
import { AppError } from '../../utils/errors';
import { parseRateLimit } from './rateLimit';
import type { RobloxTabBridge } from './robloxTab';

export type TransportMode = 'auto' | 'sw' | 'page';

export interface HttpResponse {
  status: number;
  ok: boolean;
  bodyText: string;
  headers: Record<string, string>;
}

export interface Transport {
  readonly mode: 'sw' | 'page';
  get(url: string): Promise<HttpResponse>;
  post(url: string, body: string, csrfToken?: string): Promise<HttpResponse>;
}

function collectHeaders(res: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return headers;
}

/**
 * Fetches straight from the service worker. CORS is not enforced here, so every
 * rate-limit header is readable - but whether the session cookie is attached is not
 * guaranteed, which is exactly what AdaptiveTransport measures.
 */
export class SwTransport implements Transport {
  readonly mode = 'sw' as const;

  async get(url: string): Promise<HttpResponse> {
    return this.send(url, { method: 'GET', headers: { Accept: 'application/json' } });
  }

  async post(url: string, body: string, csrfToken?: string): Promise<HttpResponse> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (csrfToken) headers['X-CSRF-TOKEN'] = csrfToken;
    return this.send(url, { method: 'POST', headers, body });
  }

  private async send(url: string, init: RequestInit): Promise<HttpResponse> {
    let res: Response;
    try {
      res = await fetch(url, { ...init, credentials: 'include' });
    } catch (err) {
      throw new AppError('NETWORK', undefined, { cause: err });
    }
    return {
      status: res.status,
      ok: res.ok,
      bodyText: await res.text(),
      headers: collectHeaders(res),
    };
  }
}

/**
 * Proxies the fetch through a content script on roblox.com. That origin is the only one
 * Roblox's CORS policy allows and its cookies are first-party there, so the request
 * lands in the authenticated bucket. The trade-off is that rate-limit headers are not
 * CORS-safelisted and come back empty, so callers must pace themselves rather than read
 * a budget.
 */
export class PageTransport implements Transport {
  readonly mode = 'page' as const;

  constructor(private readonly tabs: RobloxTabBridge) {}

  async get(url: string): Promise<HttpResponse> {
    const res = await this.tabs.sendToAny<CsFetchResponse | undefined>({ type: 'cs/fetch', url });
    return this.unwrap(res);
  }

  async post(url: string, body: string, csrfToken?: string): Promise<HttpResponse> {
    const request = csrfToken
      ? ({ type: 'cs/post', url, body, csrfToken } as const)
      : ({ type: 'cs/post', url, body } as const);
    const res = await this.tabs.sendToAny<CsFetchResponse | undefined>(request);
    return this.unwrap(res);
  }

  private unwrap(res: CsFetchResponse | undefined): HttpResponse {
    if (!res) throw new AppError('NO_ROBLOX_TAB');
    // The content script reports its own failures rather than throwing across the
    // message boundary, so a missing status means the fetch never completed.
    if (typeof res.status !== 'number') throw new AppError('NETWORK');
    return res;
  }
}

/**
 * Picks a transport by measuring instead of guessing.
 *
 * The service worker route is tried first because it reports rate-limit headers. If
 * those reveal the guest bucket (3 requests per minute), the extension is running
 * without Roblox cookies and switches to the page transport for the rest of the session.
 */
export class AdaptiveTransport implements Transport {
  private active: Transport;
  private authenticated: boolean | null = null;
  private lastLimit: number | null = null;

  constructor(
    private readonly sw: SwTransport,
    private readonly page: PageTransport,
    preferred: TransportMode,
    private readonly onModeResolved: (mode: 'sw' | 'page') => void,
  ) {
    this.active = preferred === 'page' ? page : sw;
  }

  get mode(): 'sw' | 'page' {
    return this.active.mode;
  }

  get state(): TransportState {
    return {
      mode: this.active.mode,
      authenticated: this.authenticated,
      limitPerMin: this.lastLimit,
    };
  }

  /**
   * Whether we can pace requests at the authenticated rate.
   *
   * The page transport counts because it is authenticated by construction: it runs on
   * roblox.com where the session cookie is first-party. The worker transport only counts
   * once a rate-limit header has actually confirmed it - guessing there would mean
   * hammering the three-per-minute guest bucket.
   */
  get canPaceFast(): boolean {
    if (this.active.mode === 'page') return true;
    return this.authenticated === true;
  }

  async get(url: string): Promise<HttpResponse> {
    return this.route((t) => t.get(url));
  }

  /**
   * Writes take the same route as reads: an authenticated POST needs both the cookie
   * and a CSRF token minted for that same session, so they must not diverge.
   */
  async post(url: string, body: string, csrfToken?: string): Promise<HttpResponse> {
    return this.route((t) => t.post(url, body, csrfToken));
  }

  private async route(call: (t: Transport) => Promise<HttpResponse>): Promise<HttpResponse> {
    if (this.active.mode === 'page') {
      try {
        return await call(this.page);
      } catch (err) {
        // Every roblox.com tab was closed. The worker path is slower and may be
        // unauthenticated, but degrading beats failing outright.
        if (AppError.from(err).code !== 'NO_ROBLOX_TAB') throw err;
        return call(this.sw);
      }
    }

    const res = await call(this.sw);
    const rate = parseRateLimit(res.headers);
    if (rate.limit !== null) {
      this.lastLimit = rate.limit;
      this.authenticated = rate.limit > GUEST_RATE_LIMIT_THRESHOLD;
    }

    const looksUnauthenticated =
      (rate.limit !== null && rate.limit <= GUEST_RATE_LIMIT_THRESHOLD) || res.status === 401;
    if (!looksUnauthenticated) return res;

    // Cookies did not travel with the worker request. Retry through the page, where
    // they always do, and stay there for the rest of the session.
    try {
      const viaPage = await call(this.page);
      this.active = this.page;
      // The page path is presumed better, but nothing here measured it, so the badge
      // stays honest by reporting "unknown" rather than "authenticated".
      this.authenticated = null;
      this.lastLimit = null;
      this.onModeResolved('page');
      return viaPage;
    } catch (err) {
      if (res.ok) return res; // No roblox.com tab, but the guest response is still usable.
      throw AppError.from(err);
    }
  }
}
