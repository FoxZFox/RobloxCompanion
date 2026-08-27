export interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
  resetSec: number | null;
  retryAfterMs: number | null;
}

/**
 * `x-ratelimit-limit` arrives as "3, 3;w=60". Only the first number matters to us -
 * a small value means we landed in the unauthenticated bucket.
 *
 * These headers are readable from the service worker (CORS is not enforced there) but
 * not through a content script, since they are not CORS-safelisted. Callers must treat
 * every field as optional.
 */
export function parseRateLimit(headers: Record<string, string>): RateLimitInfo {
  const get = (name: string): string | undefined => headers[name] ?? headers[name.toLowerCase()];

  const limitRaw = get('x-ratelimit-limit');
  const limit = limitRaw ? Number.parseInt(limitRaw.split(',')[0]?.trim() ?? '', 10) : Number.NaN;

  const remainingRaw = get('x-ratelimit-remaining');
  const remaining = remainingRaw ? Number.parseInt(remainingRaw.split(',')[0]?.trim() ?? '', 10) : Number.NaN;

  const resetRaw = get('x-ratelimit-reset');
  const resetSec = resetRaw ? Number.parseInt(resetRaw, 10) : Number.NaN;

  const retryRaw = get('retry-after');
  const retrySec = retryRaw ? Number.parseInt(retryRaw, 10) : Number.NaN;

  return {
    limit: Number.isFinite(limit) ? limit : null,
    remaining: Number.isFinite(remaining) ? remaining : null,
    resetSec: Number.isFinite(resetSec) ? resetSec : null,
    retryAfterMs: Number.isFinite(retrySec) ? retrySec * 1000 : null,
  };
}
