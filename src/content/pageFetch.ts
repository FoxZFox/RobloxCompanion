import type { CsFetchResponse } from '../models/messages';

/**
 * Fetches from the roblox.com page context.
 *
 * This is the only origin Roblox's CORS policy allows for the servers API, and the
 * request is first-party here, so the session cookie travels with it and the response
 * comes out of the authenticated quota instead of the three-per-minute guest bucket.
 *
 * The trade-off: rate-limit headers are not CORS-safelisted, so almost nothing is
 * readable from this side. Callers must pace themselves rather than read a budget.
 */
export async function pageGet(url: string): Promise<CsFetchResponse> {
  return run(url, { method: 'GET', headers: { Accept: 'application/json' } });
}

export async function pagePost(
  url: string,
  body: string,
  csrfToken?: string,
): Promise<CsFetchResponse> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (csrfToken) headers['X-CSRF-TOKEN'] = csrfToken;
  return run(url, { method: 'POST', headers, body });
}

async function run(url: string, init: RequestInit): Promise<CsFetchResponse> {
  const res = await fetch(url, { ...init, credentials: 'include' });

  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  return { status: res.status, ok: res.ok, bodyText: await res.text(), headers };
}
