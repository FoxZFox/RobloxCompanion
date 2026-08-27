import { describe, expect, it } from 'vitest';
import type { RobloxHttpClient } from '../../services/roblox/RobloxHttpClient';
import { ServerListService } from './ServerListService';
import { parsePlaceId } from '../../utils/robloxUrl';

interface Page {
  data: Array<{ id: string; playing: number; maxPlayers: number }>;
  nextPageCursor: string | null;
}

/** Serves canned pages and records the URLs asked for. */
function fakeHttp(pages: Page[]): { http: RobloxHttpClient; urls: string[] } {
  const urls: string[] = [];
  let index = 0;
  const http = {
    getJson: async (url: string) => {
      urls.push(url);
      return pages[index++] ?? { data: [], nextPageCursor: null };
    },
  } as unknown as RobloxHttpClient;
  return { http, urls };
}

const server = (id: string) => ({ id, playing: 1, maxPlayers: 10 });

const request = {
  placeId: '123',
  sort: 'Asc' as const,
  excludeFull: false,
};

describe('ServerListService pagination', () => {
  it('follows the cursor until Roblox returns null', async () => {
    const { http } = fakeHttp([
      { data: [server('a')], nextPageCursor: 'c1' },
      { data: [server('b')], nextPageCursor: null },
    ]);

    const outcome = await new ServerListService(http).scan(request);
    expect(outcome.servers.map((s) => s.jobId)).toEqual(['a', 'b']);
    expect(outcome.complete).toBe(true);
    expect(outcome.truncated).toBe(false);
    expect(outcome.pagesFetched).toBe(2);
  });

  it('marks the scan truncated when it stops at the page cap', async () => {
    // This is the case that must never be reported as a complete list: Roblox caps
    // pagination, and claiming completeness would let the UI lie (spec section 33).
    const { http } = fakeHttp([
      { data: [server('a')], nextPageCursor: 'c1' },
      { data: [server('b')], nextPageCursor: 'c2' },
    ]);

    const outcome = await new ServerListService(http).scan({ ...request, maxPages: 2 });
    expect(outcome.complete).toBe(false);
    expect(outcome.truncated).toBe(true);
    expect(outcome.cursor).toBe('c2');
  });

  it('deduplicates servers that appear on more than one page', async () => {
    const { http } = fakeHttp([
      { data: [server('a'), server('b')], nextPageCursor: 'c1' },
      { data: [server('b'), server('c')], nextPageCursor: null },
    ]);

    const outcome = await new ServerListService(http).scan(request);
    expect(outcome.servers.map((s) => s.jobId)).toEqual(['a', 'b', 'c']);
  });

  it('retries at the smaller limit when limit=100 returns an empty page', async () => {
    // measured behaviour: limit=100 intermittently yields an empty data array while
    // still handing back a cursor.
    const { http, urls } = fakeHttp([
      { data: [], nextPageCursor: 'c1' },
      { data: [server('a')], nextPageCursor: null },
    ]);

    const outcome = await new ServerListService(http).scan(request);
    expect(outcome.servers.map((s) => s.jobId)).toEqual(['a']);
    expect(urls[0]).toContain('limit=100');
    expect(urls[1]).toContain('limit=50');
  });

  it('keeps the limit stable once chosen, since the cursor is bound to it', async () => {
    const { http, urls } = fakeHttp([
      { data: [server('a')], nextPageCursor: 'c1' },
      { data: [server('b')], nextPageCursor: null },
    ]);

    await new ServerListService(http).scan(request);
    expect(urls.every((url) => url.includes('limit=100'))).toBe(true);
  });

  it('records that a filtered scan cannot prove absence', async () => {
    const { http } = fakeHttp([{ data: [server('a')], nextPageCursor: null }]);
    const outcome = await new ServerListService(http).scan({ ...request, excludeFull: true });
    expect(outcome.filtered).toBe(true);
  });

  it('continues from a previous outcome without losing earlier servers', async () => {
    const first = await new ServerListService(fakeHttp([
      { data: [server('a')], nextPageCursor: 'c1' },
    ]).http).scan({ ...request, maxPages: 1 });

    const { http } = fakeHttp([{ data: [server('b')], nextPageCursor: null }]);
    const second = await new ServerListService(http).loadMore(request, first);

    expect(second.servers.map((s) => s.jobId)).toEqual(['a', 'b']);
    expect(second.pagesFetched).toBe(2);
  });

  it('is a no-op when there is no cursor left to follow', async () => {
    const outcome = {
      placeId: '123',
      servers: [{ jobId: 'a', playing: 1, maxPlayers: 10 }],
      complete: true,
      truncated: false,
      filtered: false,
      cursor: null,
      pagesFetched: 1,
      scannedAt: 0,
    };
    const { http, urls } = fakeHttp([]);
    const result = await new ServerListService(http).loadMore(request, outcome);
    expect(result).toBe(outcome);
    expect(urls).toHaveLength(0);
  });
});

describe('parsePlaceId', () => {
  it('reads the id from a canonical game URL', () => {
    expect(parsePlaceId('https://www.roblox.com/games/107778070777162/Steal-An-Egg')).toBe(
      '107778070777162',
    );
  });

  it('reads the id from a URL with no slug', () => {
    expect(parsePlaceId('https://www.roblox.com/games/123')).toBe('123');
  });

  it('falls back to the placeId query parameter', () => {
    expect(parsePlaceId('https://www.roblox.com/games/start?placeId=456&gameInstanceId=x')).toBe(
      '456',
    );
  });

  it('ignores non-Roblox hosts', () => {
    expect(parsePlaceId('https://example.com/games/123')).toBeNull();
  });

  it('returns null for Roblox pages that are not experiences', () => {
    expect(parsePlaceId('https://www.roblox.com/users/1/profile')).toBeNull();
  });

  it('survives a malformed URL', () => {
    expect(parsePlaceId('not a url')).toBeNull();
    expect(parsePlaceId(undefined)).toBeNull();
  });
});
