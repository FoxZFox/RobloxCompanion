import { describe, expect, it } from 'vitest';
import type { ScanOutcome } from '../../models/server';
import { buildFlaggedViews, computeLiveness, toContext } from './liveness';

describe('computeLiveness', () => {
  const ctx = (patch: Partial<ReturnType<typeof toContext>> = {}) => ({
    live: new Set<string>(),
    complete: false,
    filtered: false,
    ...patch,
  });

  it('reports online when the server is in the scan', () => {
    expect(computeLiveness('a', ctx({ live: new Set(['a']) }))).toBe('online');
  });

  it('only proves offline when the scan finished on its own with no filter', () => {
    expect(computeLiveness('a', ctx({ complete: true, filtered: false }))).toBe('offline');
  });

  it('reports unseen when the scan was truncated, since absence proves nothing', () => {
    // This is the case Roblox's pagination cap creates constantly. Calling it "offline"
    // would hide flagged servers the user still wants to see.
    expect(computeLiveness('a', ctx({ complete: false, filtered: false }))).toBe('unseen');
  });

  it('reports unseen when full servers were filtered out, since it may have filled up', () => {
    expect(computeLiveness('a', ctx({ complete: true, filtered: true }))).toBe('unseen');
  });
});

describe('toContext', () => {
  it('produces an inconclusive context when there was no scan at all', () => {
    const context = toContext(null);
    expect(context.complete).toBe(false);
    expect(context.live.size).toBe(0);
    // Which means every tracked server reads as "unseen", never "offline".
    expect(computeLiveness('anything', context)).toBe('unseen');
  });
});

describe('buildFlaggedViews', () => {
  const outcome: ScanOutcome = {
    placeId: '1',
    servers: [{ jobId: 'live', playing: 2, maxPlayers: 10 }],
    complete: true,
    truncated: false,
    filtered: false,
    cursor: null,
    pagesFetched: 1,
    scannedAt: Date.now(),
  };

  it('includes flagged servers that are no longer live', () => {
    const views = buildFlaggedViews(outcome, {
      gone: { placeId: '1', jobId: 'gone', status: 'bugged' },
      live: { placeId: '1', jobId: 'live', status: 'exploiters' },
    });
    expect(views.map((v) => v.jobId).sort()).toEqual(['gone', 'live']);
  });

  it('excludes unflagged servers', () => {
    const views = buildFlaggedViews(outcome, {
      live: { placeId: '1', jobId: 'live', status: 'unknown' },
    });
    expect(views).toHaveLength(0);
  });

  it('sorts online servers ahead of offline ones', () => {
    const views = buildFlaggedViews(outcome, {
      gone: { placeId: '1', jobId: 'gone', status: 'bugged' },
      live: { placeId: '1', jobId: 'live', status: 'bugged' },
    });
    expect(views[0]?.jobId).toBe('live');
  });
});
