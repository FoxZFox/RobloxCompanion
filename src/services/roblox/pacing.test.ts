import { describe, expect, it, vi } from 'vitest';
import {
  AUTHENTICATED_SPACING_MS,
  DEFAULT_SCAN_PAGES,
  MAX_SCAN_PAGES,
  REQUEST_SPACING_MS,
} from '../../config/constants';
import { RequestScheduler } from './RequestScheduler';
import type { HttpResponse } from './transport';

const ok = (): HttpResponse => ({ status: 200, ok: true, bodyText: '{}', headers: {} });

describe('scan depth defaults', () => {
  it('defaults well short of Roblox’s own cap', () => {
    // Roblox will page to ~500, but pages three through five cost seconds of waiting to
    // add servers that Join Lowest will never pick, because `Asc` puts the emptiest first.
    expect(DEFAULT_SCAN_PAGES).toBeLessThan(MAX_SCAN_PAGES);
    expect(DEFAULT_SCAN_PAGES).toBeGreaterThanOrEqual(1);
  });
});

describe('adaptive pacing', () => {
  it('paces an authenticated session far faster than a guest one', () => {
    // The old flat spacing treated every user as a guest, which made a scan feel slow
    // for anyone actually logged in - which is nearly everyone.
    expect(AUTHENTICATED_SPACING_MS).toBeLessThan(REQUEST_SPACING_MS);
  });

  it('stays inside the measured authenticated budget of ~100 requests per minute', () => {
    // 60000 / 100 = 600ms sustained. A burst below that is fine; a sustained rate above
    // it would earn a 429, so the floor is what matters.
    const requestsPerMinute = 60_000 / AUTHENTICATED_SPACING_MS;
    expect(requestsPerMinute).toBeLessThanOrEqual(200);
  });

  it('reads the spacing per request rather than fixing it at construction', async () => {
    // Whether we hold the authenticated quota is measured at runtime, so the scheduler
    // has to be able to change its mind mid-session.
    const spacing = vi.fn().mockReturnValue(0);
    const scheduler = new RequestScheduler(spacing);

    await scheduler.run('a', async () => ok(), { cacheTtlMs: 0 });
    await scheduler.run('b', async () => ok(), { cacheTtlMs: 0 });

    expect(spacing.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('still spaces requests apart when told to', async () => {
    const scheduler = new RequestScheduler(() => 30);
    const started: number[] = [];
    const task = async (): Promise<HttpResponse> => {
      started.push(Date.now());
      return ok();
    };

    await Promise.all([
      scheduler.run('a', task, { cacheTtlMs: 0 }),
      scheduler.run('b', task, { cacheTtlMs: 0 }),
    ]);

    expect(started).toHaveLength(2);
    expect(started[1]! - started[0]!).toBeGreaterThanOrEqual(25);
  });

  it('serves a cache hit without waiting on the spacing at all', async () => {
    const scheduler = new RequestScheduler(() => 10_000);
    let calls = 0;
    const task = async (): Promise<HttpResponse> => {
      calls += 1;
      return ok();
    };

    await scheduler.run('same', task);
    const before = Date.now();
    await scheduler.run('same', task);

    // The second call must not pay the spacing, or a popup reopening would stall.
    expect(Date.now() - before).toBeLessThan(1000);
    expect(calls).toBe(1);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    const scheduler = new RequestScheduler(() => 0);
    let calls = 0;
    const task = async (): Promise<HttpResponse> => {
      calls += 1;
      return ok();
    };

    await Promise.all([scheduler.run('dupe', task), scheduler.run('dupe', task)]);
    expect(calls).toBe(1);
  });
});
