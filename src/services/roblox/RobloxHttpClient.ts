import { AppError } from '../../utils/errors';
import { nextId } from '../../utils/async';
import type { RequestScheduler, ScheduleOptions } from './RequestScheduler';
import type { AdaptiveTransport, HttpResponse } from './transport';

/**
 * The single place that talks to Roblox over HTTP (spec section 31).
 *
 * Everything awkward about Roblox's API lives here so no feature re-implements it:
 *
 *   CSRF   Roblox rejects the first authenticated write with 403 and hands back a token
 *          in `x-csrf-token`. The token is cached and the request replayed once. Features
 *          never see this happen.
 *   401    Reported as NOT_AUTHENTICATED, which the UI turns into "log in to roblox.com"
 *          rather than a generic failure.
 *   429    Handled by the scheduler, which honours Retry-After.
 *
 * The auth cookie is never read, stored or forwarded - `credentials: 'include'` lets the
 * browser attach it and it stays entirely inside the browser's cookie jar (spec section 30).
 */
export class RobloxHttpClient {
  private csrfToken: string | null = null;

  constructor(
    private readonly transport: AdaptiveTransport,
    private readonly scheduler: RequestScheduler,
  ) {}

  async getJson<T>(url: string, options: ScheduleOptions = {}): Promise<T> {
    const response = await this.scheduler.run(url, () => this.transport.get(url), options);
    return this.parse<T>(response, url);
  }

  /**
   * Writes are never deduped against each other and are never retried automatically:
   * a POST to Roblox may create a private server or decline a trade, and replaying one
   * of those silently is not acceptable.
   */
  async postJson<T>(url: string, body: unknown, options: ScheduleOptions = {}): Promise<T> {
    const payload = JSON.stringify(body ?? {});
    const key = `POST ${url} ${nextId()}`;

    const send = async (): Promise<HttpResponse> => {
      const first = await this.transport.post(url, payload, this.csrfToken ?? undefined);
      if (first.status !== 403) return first;

      // Roblox answers an authenticated write that lacks a valid token with 403 plus a
      // fresh one. Retry exactly once; a second 403 is a real authorization failure.
      const issued = first.headers['x-csrf-token'];
      if (!issued || issued === this.csrfToken) return first;
      this.csrfToken = issued;
      return this.transport.post(url, payload, issued);
    };

    const response = await this.scheduler.run(key, send, {
      ...options,
      cacheTtlMs: 0,
      noRetry: true,
    });
    return this.parse<T>(response, url);
  }

  get transportState() {
    return this.transport.state;
  }

  private parse<T>(response: HttpResponse, url: string): T {
    if (response.status === 401) {
      throw new AppError('NOT_AUTHENTICATED', undefined, { httpStatus: 401 });
    }
    if (response.status === 429) {
      throw new AppError('RATE_LIMITED', undefined, { httpStatus: 429 });
    }
    if (!response.ok) {
      throw new AppError('API_ERROR', describeFailure(response, url), {
        httpStatus: response.status,
      });
    }
    if (!response.bodyText) return undefined as T;

    try {
      return JSON.parse(response.bodyText) as T;
    } catch {
      throw new AppError('API_ERROR', undefined, { httpStatus: response.status });
    }
  }
}

/**
 * Roblox returns `{ errors: [{ code, message }] }` on failure. Surfacing its own wording
 * beats a bare status code when something unexpected happens.
 */
function describeFailure(response: HttpResponse, url: string): string | undefined {
  try {
    const parsed = JSON.parse(response.bodyText) as { errors?: Array<{ message?: string }> };
    const message = parsed.errors?.[0]?.message;
    if (message) return `${message} (${response.status})`;
  } catch {
    // Not JSON. The status code is all we have.
  }
  return `HTTP ${response.status} - ${new URL(url).pathname}`;
}
