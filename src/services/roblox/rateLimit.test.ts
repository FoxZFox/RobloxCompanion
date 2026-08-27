import { describe, expect, it } from 'vitest';
import { GUEST_RATE_LIMIT_THRESHOLD } from '../../config/constants';
import { parseRateLimit } from './rateLimit';
import { normalizeServersPage, parseServersPage, toLiveServer } from './serversApi';
import { publicServersUrl } from './endpoints';

describe('parseRateLimit', () => {
  it('reads only the first number of the "3, 3;w=60" format', () => {
    const info = parseRateLimit({ 'x-ratelimit-limit': '3, 3;w=60' });
    expect(info.limit).toBe(3);
  });

  it('recognises the guest bucket, which is what drives the transport switch', () => {
    const guest = parseRateLimit({ 'x-ratelimit-limit': '3, 3;w=60' });
    const authed = parseRateLimit({ 'x-ratelimit-limit': '100, 100;w=60' });
    expect(guest.limit! <= GUEST_RATE_LIMIT_THRESHOLD).toBe(true);
    expect(authed.limit! > GUEST_RATE_LIMIT_THRESHOLD).toBe(true);
  });

  it('converts retry-after from seconds to milliseconds', () => {
    expect(parseRateLimit({ 'retry-after': '5' }).retryAfterMs).toBe(5000);
  });

  it('returns nulls when headers are absent, which is the page-transport case', () => {
    // Rate-limit headers are not CORS-safelisted, so proxying through the page gives
    // us nothing to read. Every field has to be optional.
    const info = parseRateLimit({});
    expect(info).toEqual({ limit: null, remaining: null, resetSec: null, retryAfterMs: null });
  });

  it('ignores unparseable values rather than producing NaN', () => {
    expect(parseRateLimit({ 'x-ratelimit-limit': 'nonsense' }).limit).toBeNull();
  });
});

describe('normalizeServersPage', () => {
  it('keeps well-formed servers and the cursor', () => {
    const page = normalizeServersPage({
      data: [{ id: 'a', playing: 2, maxPlayers: 7, ping: 43, fps: 59.7 }],
      nextPageCursor: 'abc',
    });
    expect(page.data).toHaveLength(1);
    expect(page.nextPageCursor).toBe('abc');
  });

  it('drops entries that do not look like servers instead of trusting them', () => {
    const page = normalizeServersPage({
      data: [{ id: 'a', playing: 1, maxPlayers: 7 }, { nope: true }, null],
      nextPageCursor: null,
    });
    expect(page.data.map((s) => s.id)).toEqual(['a']);
  });

  it('treats a non-string cursor as the end of the list', () => {
    expect(normalizeServersPage({ data: [], nextPageCursor: null }).nextPageCursor).toBeNull();
    expect(normalizeServersPage({ data: [] }).nextPageCursor).toBeNull();
  });

  it('throws on a body that is not an object', () => {
    expect(() => normalizeServersPage(null)).toThrow();
  });
});

describe('parseServersPage', () => {
  it('throws a typed error on malformed JSON rather than leaking a SyntaxError', () => {
    expect(() => parseServersPage('{not json')).toThrow(/API_ERROR|Roblox|โหลด/);
  });
});

describe('toLiveServer', () => {
  it('rounds fps and carries ping through', () => {
    const server = toLiveServer({ id: 'a', playing: 2, maxPlayers: 7, fps: 59.7, ping: 43 });
    expect(server).toEqual({ jobId: 'a', playing: 2, maxPlayers: 7, fps: 60, ping: 43 });
  });

  it('omits ping and fps when Roblox did not send them', () => {
    const server = toLiveServer({ id: 'a', playing: 2, maxPlayers: 7 });
    expect('ping' in server).toBe(false);
    expect('fps' in server).toBe(false);
  });
});

describe('publicServersUrl', () => {
  it('maps sort and exclude-full straight onto query parameters', () => {
    const url = publicServersUrl({
      placeId: '123',
      sortOrder: 'Asc',
      excludeFullGames: true,
      limit: 100,
    });
    expect(url).toContain('/games/123/servers/Public');
    expect(url).toContain('sortOrder=Asc');
    expect(url).toContain('excludeFullGames=true');
    expect(url).toContain('limit=100');
  });

  it('omits excludeFullGames entirely when off, matching Roblox default behaviour', () => {
    const url = publicServersUrl({
      placeId: '123',
      sortOrder: 'Desc',
      excludeFullGames: false,
      limit: 50,
    });
    expect(url).not.toContain('excludeFullGames');
  });

  it('appends the cursor only when one exists', () => {
    expect(
      publicServersUrl({
        placeId: '1',
        sortOrder: 'Asc',
        excludeFullGames: false,
        limit: 100,
        cursor: null,
      }),
    ).not.toContain('cursor');
  });
});
