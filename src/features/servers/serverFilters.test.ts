import { describe, expect, it } from 'vitest';
import type { ServerStatus, ServerView } from '../../models/server';
import { DEFAULT_SETTINGS } from '../../models/settings';
import type { AvoidSettings, ServerBrowserSettings } from '../../models/settings';
import { applyFilters, isAvoided, joinCandidates, pickLowest, pickRandom, sortViews } from './serverFilters';

function view(overrides: Partial<ServerView> & { jobId: string }): ServerView {
  return {
    placeId: '1',
    playing: 1,
    maxPlayers: 10,
    status: 'unknown' as ServerStatus,
    liveness: 'online',
    favorite: false,
    customFlagIds: [],
    ...overrides,
  };
}

const browser = (patch: Partial<ServerBrowserSettings> = {}): ServerBrowserSettings => ({
  ...DEFAULT_SETTINGS.serverBrowser,
  ...patch,
});

const avoid = (patch: Partial<AvoidSettings> = {}): AvoidSettings => ({
  ...DEFAULT_SETTINGS.avoid,
  ...patch,
});

describe('isAvoided', () => {
  it('avoids the three flag types the user opted into', () => {
    expect(isAvoided(view({ jobId: 'a', status: 'exploiters' }), avoid())).toBe(true);
    expect(isAvoided(view({ jobId: 'b', status: 'bugged' }), avoid())).toBe(true);
    expect(isAvoided(view({ jobId: 'c', status: 'avoid' }), avoid())).toBe(true);
  });

  it('never avoids clean or unknown servers', () => {
    expect(isAvoided(view({ jobId: 'a', status: 'clean' }), avoid())).toBe(false);
    expect(isAvoided(view({ jobId: 'b', status: 'unknown' }), avoid())).toBe(false);
  });

  it('respects each toggle independently', () => {
    const only = avoid({ exploiterServers: false, buggedServers: true, manuallyAvoided: false });
    expect(isAvoided(view({ jobId: 'a', status: 'exploiters' }), only)).toBe(false);
    expect(isAvoided(view({ jobId: 'b', status: 'bugged' }), only)).toBe(true);
    expect(isAvoided(view({ jobId: 'c', status: 'avoid' }), only)).toBe(false);
  });
});

describe('applyFilters', () => {
  const views = [
    view({ jobId: 'empty', playing: 0 }),
    view({ jobId: 'mid', playing: 5 }),
    view({ jobId: 'full', playing: 10, maxPlayers: 10 }),
    view({ jobId: 'clean', playing: 2, status: 'clean' }),
    view({ jobId: 'fav', playing: 3, favorite: true }),
  ];

  it('excludes full servers when asked', () => {
    const result = applyFilters(views, browser({ excludeFull: true }));
    expect(result.map((v) => v.jobId)).not.toContain('full');
  });

  it('keeps full servers when the filter is off', () => {
    const result = applyFilters(views, browser({ excludeFull: false }));
    expect(result.map((v) => v.jobId)).toContain('full');
  });

  it('hides clean servers only when that toggle is on', () => {
    expect(
      applyFilters(views, browser({ hideCleanServers: true })).map((v) => v.jobId),
    ).not.toContain('clean');
    expect(applyFilters(views, browser({ hideCleanServers: false })).map((v) => v.jobId)).toContain(
      'clean',
    );
  });

  it('treats maxPlayerCount 0 as off', () => {
    expect(applyFilters(views, browser({ maxPlayerCount: 0 })).length).toBeGreaterThan(1);
  });

  it('applies maxPlayerCount as an inclusive ceiling', () => {
    const result = applyFilters(views, browser({ excludeFull: false, maxPlayerCount: 3 }));
    expect(result.map((v) => v.jobId).sort()).toEqual(['clean', 'empty', 'fav']);
  });

  it('lets exactPlayerCount win over maxPlayerCount', () => {
    const result = applyFilters(views, browser({ exactPlayerCount: 5, maxPlayerCount: 1 }));
    expect(result.map((v) => v.jobId)).toEqual(['mid']);
  });

  it('filters to favourites only', () => {
    const result = applyFilters(views, browser({ onlyFavorites: true }));
    expect(result.map((v) => v.jobId)).toEqual(['fav']);
  });

  it('lets onlyStatus override hideCleanServers', () => {
    const result = applyFilters(views, browser({ onlyStatus: 'clean', hideCleanServers: true }));
    expect(result.map((v) => v.jobId)).toEqual(['clean']);
  });
});

describe('sortViews', () => {
  it('sorts ascending and descending by player count', () => {
    const views = [view({ jobId: 'b', playing: 5 }), view({ jobId: 'a', playing: 1 })];
    expect(sortViews(views, 'Asc').map((v) => v.jobId)).toEqual(['a', 'b']);
    expect(sortViews(views, 'Desc').map((v) => v.jobId)).toEqual(['b', 'a']);
  });

  it('breaks ties on jobId so the list never jitters between renders', () => {
    const views = [view({ jobId: 'z', playing: 1 }), view({ jobId: 'a', playing: 1 })];
    expect(sortViews(views, 'Asc').map((v) => v.jobId)).toEqual(['a', 'z']);
  });
});

describe('joinCandidates', () => {
  it('drops full servers outright, since joining one fails', () => {
    const views = [view({ jobId: 'full', playing: 10, maxPlayers: 10 }), view({ jobId: 'ok' })];
    expect(joinCandidates(views, { avoid: avoid() }).map((v) => v.jobId)).toEqual(['ok']);
  });

  it('drops flagged servers, matching what the browser hides', () => {
    const views = [view({ jobId: 'bad', status: 'exploiters' }), view({ jobId: 'ok' })];
    expect(joinCandidates(views, { avoid: avoid() }).map((v) => v.jobId)).toEqual(['ok']);
  });

  it('honours the session exclusion set', () => {
    const views = [view({ jobId: 'seen' }), view({ jobId: 'fresh' })];
    const result = joinCandidates(views, { avoid: avoid(), exclude: new Set(['seen']) });
    expect(result.map((v) => v.jobId)).toEqual(['fresh']);
  });
});

describe('pickLowest', () => {
  it('picks the emptiest eligible server', () => {
    const views = [
      view({ jobId: 'three', playing: 3 }),
      view({ jobId: 'one', playing: 1 }),
      view({ jobId: 'two', playing: 2 }),
    ];
    expect(pickLowest(views, { avoid: avoid() })?.jobId).toBe('one');
  });

  it('never returns a flagged server even when it is the emptiest', () => {
    const views = [
      view({ jobId: 'exploiter', playing: 0, status: 'exploiters' }),
      view({ jobId: 'ok', playing: 4 }),
    ];
    expect(pickLowest(views, { avoid: avoid() })?.jobId).toBe('ok');
  });

  it('prefers a known-clean server over an unknown one at the same count', () => {
    const views = [
      view({ jobId: 'unknown', playing: 1 }),
      view({ jobId: 'clean', playing: 1, status: 'clean' }),
    ];
    expect(pickLowest(views, { avoid: avoid() })?.jobId).toBe('clean');
  });

  it('uses ping only as a last tiebreak between otherwise identical servers', () => {
    const views = [
      view({ jobId: 'slow', playing: 1, ping: 200 }),
      view({ jobId: 'fast', playing: 1, ping: 40 }),
    ];
    expect(pickLowest(views, { avoid: avoid() })?.jobId).toBe('fast');
  });

  it('prefers a lower count over better ping, since population is the real signal', () => {
    const views = [
      view({ jobId: 'busy-fast', playing: 5, ping: 10 }),
      view({ jobId: 'empty-slow', playing: 1, ping: 300 }),
    ];
    expect(pickLowest(views, { avoid: avoid() })?.jobId).toBe('empty-slow');
  });

  it('returns null rather than a bad server when nothing qualifies', () => {
    const views = [view({ jobId: 'full', playing: 10, maxPlayers: 10 })];
    expect(pickLowest(views, { avoid: avoid() })).toBeNull();
  });
});

describe('pickRandom', () => {
  it('only ever returns an eligible server', () => {
    const views = [view({ jobId: 'bad', status: 'avoid' }), view({ jobId: 'ok' })];
    expect(pickRandom(views, { avoid: avoid() }, () => 0.99)?.jobId).toBe('ok');
  });

  it('stays in range when the generator returns exactly 1', () => {
    const views = [view({ jobId: 'a' }), view({ jobId: 'b' })];
    expect(pickRandom(views, { avoid: avoid() }, () => 1)?.jobId).toBe('b');
  });

  it('returns null when there is nothing to pick', () => {
    expect(pickRandom([], { avoid: avoid() })).toBeNull();
  });
});
