import {
  CACHE_TTL_MS,
  DEFAULT_RETRY_AFTER_MS,
  MAX_RATE_LIMIT_RETRIES,
  REQUEST_SPACING_MS,
} from '../../config/constants';
import { AppError } from '../../utils/errors';
import { sleep } from '../../utils/async';
import { parseRateLimit } from './rateLimit';
import type { HttpResponse } from './transport';

interface CacheEntry {
  at: number;
  response: HttpResponse;
}

export interface ScheduleOptions {
  /** Serve from cache when a response for the same key is younger than this. */
  cacheTtlMs?: number;
  /** Skip the cache entirely, e.g. a user-pressed Refresh. */
  force?: boolean;
  /** Requests that must not be retried automatically (anything with side effects). */
  noRetry?: boolean;
}

/**
 * One gate in front of every Roblox request (spec section 32).
 *
 * Roblox's limits are per-account and per-IP, and the page transport cannot read the
 * remaining budget at all, so the only safe strategy is to pace unconditionally rather
 * than react to headers. Requests run one at a time with a fixed minimum spacing.
 *
 * Three separate things are handled here so no feature has to:
 *   - dedupe:   two surfaces asking for the same URL share one in-flight request
 *   - cache:    a short TTL absorbs the popup and side panel opening together
 *   - backoff:  429 and 503 are retried, honouring Retry-After when present
 */
export class RequestScheduler {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<HttpResponse>>();
  private queue: Promise<unknown> = Promise.resolve();
  private lastStartedAt = 0;

  /**
   * `spacing` is read per request rather than fixed at construction, because whether we
   * are in the guest bucket or the authenticated one is measured at runtime by
   * AdaptiveTransport - and a scan paced for a guest when we actually hold the
   * authenticated quota wastes seconds on every page for nothing.
   */
  constructor(private readonly spacing: () => number = () => REQUEST_SPACING_MS) {}

  /**
   * `key` identifies the request for dedupe and caching. Callers pass the URL for GETs;
   * writes should pass a unique key so they are never deduped with one another.
   */
  async run(
    key: string,
    task: () => Promise<HttpResponse>,
    options: ScheduleOptions = {},
  ): Promise<HttpResponse> {
    const ttl = options.cacheTtlMs ?? CACHE_TTL_MS;

    if (!options.force && ttl > 0) {
      const hit = this.cache.get(key);
      if (hit && Date.now() - hit.at < ttl) return hit.response;
    }

    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const promise = this.enqueue(() => this.withRetry(task, options))
      .then((response) => {
        if (ttl > 0 && response.ok) this.cache.set(key, { at: Date.now(), response });
        return response;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clearCache(): void {
    this.cache.clear();
  }

  /** Chains onto a single queue so requests never overlap, then spaces them apart. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = this.lastStartedAt + this.spacing() - Date.now();
      if (wait > 0) await sleep(wait);
      this.lastStartedAt = Date.now();
      return task();
    });
    // Keep the chain alive after a rejection, or one failure stalls everything after it.
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async withRetry(
    task: () => Promise<HttpResponse>,
    options: ScheduleOptions,
  ): Promise<HttpResponse> {
    let attempt = 0;

    for (;;) {
      const response = await task();
      const retryable = response.status === 429 || response.status === 503;

      if (!retryable || options.noRetry || attempt >= MAX_RATE_LIMIT_RETRIES) {
        if (retryable) {
          const info = parseRateLimit(response.headers);
          throw new AppError('RATE_LIMITED', undefined, {
            httpStatus: response.status,
            ...(info.retryAfterMs !== null ? { retryAfterMs: info.retryAfterMs } : {}),
          });
        }
        return response;
      }

      const info = parseRateLimit(response.headers);
      // Exponential backoff, but Retry-After wins when Roblox states a number.
      const backoff = DEFAULT_RETRY_AFTER_MS * 2 ** attempt;
      await sleep(info.retryAfterMs ?? backoff);
      attempt += 1;
    }
  }
}
