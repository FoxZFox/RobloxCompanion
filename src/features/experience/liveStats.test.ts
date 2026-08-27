import { describe, expect, it } from 'vitest';
import {
  approvalRatio,
  formatVoteCount,
  STATS_TTL_MS,
  statsAreStale,
  type LiveExperienceStats,
} from './liveStats';

const NOW = 1_700_000_000_000;

const stats = (patch: Partial<LiveExperienceStats> = {}): LiveExperienceStats => ({
  universeId: '1',
  fetchedAt: NOW,
  ...patch,
});

describe('statsAreStale', () => {
  it('treats missing stats as stale, so a first load happens', () => {
    expect(statsAreStale(null, NOW)).toBe(true);
  });

  it('leaves fresh stats alone', () => {
    // This is the guard that stops the auto-refresh looping: every fetch answers with a
    // new AppState, which re-renders the component that asked for it.
    expect(statsAreStale(stats({ fetchedAt: NOW }), NOW)).toBe(false);
  });

  it('goes stale once past the cache window', () => {
    expect(statsAreStale(stats({ fetchedAt: NOW - STATS_TTL_MS - 1 }), NOW)).toBe(true);
  });

  it('matches the request scheduler cache window, so a refresh is never wasted', () => {
    // Asking sooner than this would be answered from cache anyway - it would only add
    // message traffic.
    expect(STATS_TTL_MS).toBeGreaterThan(0);
    expect(statsAreStale(stats({ fetchedAt: NOW - STATS_TTL_MS + 1000 }), NOW)).toBe(false);
  });
});

describe('approvalRatio', () => {
  it('is null when nobody has voted', () => {
    // A brand new experience has an unknown reception, not a bad one, and must not
    // render as 0% liked.
    expect(approvalRatio(stats({ upVotes: 0, downVotes: 0 }))).toBeNull();
    expect(approvalRatio(stats())).toBeNull();
  });

  it('is null when there are no stats at all', () => {
    expect(approvalRatio(null)).toBeNull();
  });

  it('computes the share of likes', () => {
    expect(approvalRatio(stats({ upVotes: 75, downVotes: 25 }))).toBe(0.75);
    expect(approvalRatio(stats({ upVotes: 1, downVotes: 0 }))).toBe(1);
    expect(approvalRatio(stats({ upVotes: 0, downVotes: 5 }))).toBe(0);
  });

  it('treats a missing side as zero rather than discarding the other', () => {
    expect(approvalRatio(stats({ upVotes: 10 }))).toBe(1);
  });
});

describe('formatVoteCount', () => {
  it('abbreviates large numbers', () => {
    expect(formatVoteCount(1_500_000)).toBe('1.5M');
    expect(formatVoteCount(2_400)).toBe('2.4K');
  });

  it('leaves small numbers exact', () => {
    expect(formatVoteCount(0)).toBe('0');
    expect(formatVoteCount(999)).toBe('999');
  });
});
