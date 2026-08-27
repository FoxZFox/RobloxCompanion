import { describe, expect, it } from 'vitest';
import type { ServerView } from '../../models/server';
import { DEFAULT_SETTINGS } from '../../models/settings';
import { DEFAULT_SMART_JOIN, type RegionResult, type SmartJoinSettings } from '../../models/smartJoin';
import { REGIONS } from './regionData';
import { rankServers, scoreServer, type ScoringContext } from './scoring';

const NOW = 1_700_000_000_000;

function view(overrides: Partial<ServerView> & { jobId: string }): ServerView {
  return {
    placeId: '1',
    playing: 5,
    maxPlayers: 10,
    status: 'unknown',
    liveness: 'online',
    favorite: false,
    customFlagIds: [],
    ...overrides,
  };
}

function ctx(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    settings: DEFAULT_SMART_JOIN,
    avoid: DEFAULT_SETTINGS.avoid,
    now: NOW,
    ...overrides,
  };
}

function settings(patch: Partial<SmartJoinSettings>): SmartJoinSettings {
  return { ...DEFAULT_SMART_JOIN, ...patch };
}

const component = (score: ReturnType<typeof scoreServer>, key: string) =>
  score.components.find((c) => c.key === key);

describe('disqualification', () => {
  it('rules out a full server', () => {
    const score = scoreServer(view({ jobId: 'a', playing: 10, maxPlayers: 10 }), ctx());
    expect(score.disqualified).toBe('Server is full');
    expect(score.total).toBe(0);
  });

  it('rules out flagged servers with a reason naming the flag', () => {
    expect(scoreServer(view({ jobId: 'a', status: 'exploiters' }), ctx()).disqualified).toMatch(
      /exploiters/i,
    );
    expect(scoreServer(view({ jobId: 'b', status: 'bugged' }), ctx()).disqualified).toMatch(
      /bugged/i,
    );
    expect(scoreServer(view({ jobId: 'c', status: 'avoid' }), ctx()).disqualified).toMatch(/avoid/i);
  });

  it('does not disqualify a flagged server when the user turned that rule off', () => {
    const relaxed = ctx({ avoid: { ...DEFAULT_SETTINGS.avoid, exploiterServers: false } });
    expect(scoreServer(view({ jobId: 'a', status: 'exploiters' }), relaxed).disqualified).toBeUndefined();
  });

  it('drops disqualified servers from the ranking entirely', () => {
    const ranked = rankServers(
      [view({ jobId: 'bad', status: 'avoid' }), view({ jobId: 'ok' })],
      ctx(),
    );
    expect(ranked.map((s) => s.jobId)).toEqual(['ok']);
  });
});

describe('population', () => {
  it('rewards emptier servers when preferring lowest', () => {
    const empty = scoreServer(view({ jobId: 'a', playing: 0 }), ctx());
    const busy = scoreServer(view({ jobId: 'b', playing: 9 }), ctx());
    expect(component(empty, 'population')!.points).toBeGreaterThan(
      component(busy, 'population')!.points,
    );
  });

  it('inverts when preferring highest', () => {
    const high = ctx({ settings: settings({ population: 'highest' }) });
    const empty = scoreServer(view({ jobId: 'a', playing: 0 }), high);
    const busy = scoreServer(view({ jobId: 'b', playing: 9 }), high);
    expect(component(busy, 'population')!.points).toBeGreaterThan(
      component(empty, 'population')!.points,
    );
  });

  it('peaks at half full when balanced', () => {
    const balanced = ctx({ settings: settings({ population: 'balanced' }) });
    const half = scoreServer(view({ jobId: 'a', playing: 5 }), balanced);
    const empty = scoreServer(view({ jobId: 'b', playing: 0 }), balanced);
    const full = scoreServer(view({ jobId: 'c', playing: 9 }), balanced);
    expect(component(half, 'population')!.points).toBeGreaterThan(
      component(empty, 'population')!.points,
    );
    expect(component(half, 'population')!.points).toBeGreaterThan(
      component(full, 'population')!.points,
    );
  });

  it('marks population inapplicable when capacity is unknown', () => {
    const score = scoreServer(view({ jobId: 'a', maxPlayers: 0 }), ctx());
    expect(component(score, 'population')!.applicable).toBe(false);
  });

  it('states the actual counts in its reason', () => {
    const score = scoreServer(view({ jobId: 'a', playing: 2, maxPlayers: 7 }), ctx());
    expect(component(score, 'population')!.reason).toContain('2/7');
  });
});

describe('reputation', () => {
  it('scores a clean server above an unchecked one', () => {
    const clean = scoreServer(view({ jobId: 'a', status: 'clean' }), ctx());
    const unknown = scoreServer(view({ jobId: 'b', status: 'unknown' }), ctx());
    expect(component(clean, 'reputation')!.points).toBeGreaterThan(
      component(unknown, 'reputation')!.points,
    );
  });

  it('describes unchecked as unknown rather than as bad', () => {
    const score = scoreServer(view({ jobId: 'a' }), ctx());
    const reason = component(score, 'reputation')!.reason.toLowerCase();
    expect(reason).toContain('never checked');
    expect(reason).not.toContain('bad');
  });
});

describe('freshness', () => {
  it('is inapplicable for a server we have never seen before', () => {
    // Roblox exposes no server start time, so a first sighting genuinely has no age.
    // Scoring it zero would read as "this server is old", which we do not know.
    const score = scoreServer(view({ jobId: 'a' }), ctx());
    const freshness = component(score, 'freshness')!;
    expect(freshness.applicable).toBe(false);
    expect(freshness.reason).toMatch(/unknown/i);
  });

  it('rewards a recently first-seen server over an older one', () => {
    const fresh = scoreServer(view({ jobId: 'a', firstSeenAt: NOW - 60_000 }), ctx());
    const old = scoreServer(view({ jobId: 'b', firstSeenAt: NOW - 60 * 60_000 }), ctx());
    expect(component(fresh, 'freshness')!.points).toBeGreaterThan(
      component(old, 'freshness')!.points,
    );
  });

  it('never goes negative for a very old server', () => {
    const score = scoreServer(view({ jobId: 'a', firstSeenAt: 0 }), ctx());
    expect(component(score, 'freshness')!.points).toBe(0);
  });
});

describe('region', () => {
  const singapore: RegionResult = { jobId: 'a', region: REGIONS.singapore!, address: '128.116.97.5' };

  it('is omitted entirely when no region source supplied any data', () => {
    // Nothing can resolve regions today, so the row is left out rather than shown as a
    // permanently blank signal.
    const score = scoreServer(view({ jobId: 'a' }), ctx());
    expect(component(score, 'region')).toBeUndefined();
  });

  it('is inapplicable when a source answered but did not resolve this server', () => {
    const regions = new Map([
      ['a', { jobId: 'a', region: null, reason: 'not-probed' } as RegionResult],
    ]);
    const score = scoreServer(view({ jobId: 'a' }), ctx({ regions }));
    const region = component(score, 'region')!;
    expect(region.applicable).toBe(false);
    expect(region.reason).toMatch(/not checked/i);
  });

  it('distinguishes an unmatched address from an unprobed server', () => {
    // "our table has no range for this address" is a gap in our data, not a fact about
    // the server, and the panel has to say which one it hit.
    const regions = new Map([['a', { jobId: 'a', region: null, reason: 'unmatched' } as RegionResult]]);
    const score = scoreServer(view({ jobId: 'a' }), ctx({ regions }));
    expect(component(score, 'region')!.reason).toMatch(/outside our region table/i);
  });

  it('reports missing permission distinctly', () => {
    const regions = new Map([
      ['a', { jobId: 'a', region: null, reason: 'no-permission' } as RegionResult],
    ]);
    const score = scoreServer(view({ jobId: 'a' }), ctx({ regions }));
    expect(component(score, 'region')!.reason).toMatch(/permission/i);
  });

  it('is inapplicable when the user set no preferred regions', () => {
    const regions = new Map([['a', singapore]]);
    const score = scoreServer(view({ jobId: 'a' }), ctx({ regions }));
    const region = component(score, 'region')!;
    expect(region.applicable).toBe(false);
    expect(region.reason).toContain('Singapore');
  });

  it('gives full marks to the first preference', () => {
    const regions = new Map([['a', singapore]]);
    const score = scoreServer(
      view({ jobId: 'a' }),
      ctx({ settings: settings({ preferredRegions: ['singapore', 'tokyo'] }), regions }),
    );
    const region = component(score, 'region')!;
    expect(region.points).toBe(region.max);
    expect(region.reason).toContain('#1');
  });

  it('scores a lower preference below the first', () => {
    const regions = new Map([['a', singapore]]);
    const score = scoreServer(
      view({ jobId: 'a' }),
      ctx({ settings: settings({ preferredRegions: ['tokyo', 'singapore'] }), regions }),
    );
    const region = component(score, 'region')!;
    expect(region.points).toBeGreaterThan(0);
    expect(region.points).toBeLessThan(region.max);
  });

  it('scores zero but stays applicable for a region outside the preference list', () => {
    const regions = new Map([['a', singapore]]);
    const score = scoreServer(
      view({ jobId: 'a' }),
      ctx({ settings: settings({ preferredRegions: ['tokyo'] }), regions }),
    );
    const region = component(score, 'region')!;
    expect(region.applicable).toBe(true);
    expect(region.points).toBe(0);
  });
});

describe('normalisation', () => {
  it('excludes a missing datum from the total instead of scoring it zero', () => {
    // A server with no age must score exactly as if freshness carried no weight at all.
    // If it were scored zero instead of excluded, the total would come out lower.
    const noAge = scoreServer(view({ jobId: 'a' }), ctx());
    const freshnessDisabled = scoreServer(
      view({ jobId: 'a' }),
      ctx({ settings: settings({ weights: { ...DEFAULT_SMART_JOIN.weights, freshness: 0 } }) }),
    );
    expect(noAge.total).toBe(freshnessDisabled.total);
  });

  it('does not rank an unseen server below a known-stale one', () => {
    // This is the anti-penalty property that matters in practice: "we do not know how
    // old this is" must never be treated as "this is old".
    const unseen = scoreServer(view({ jobId: 'a' }), ctx());
    const stale = scoreServer(view({ jobId: 'b', firstSeenAt: 0 }), ctx());
    expect(unseen.total).toBeGreaterThan(stale.total);
  });

  it('produces a total between 0 and 100', () => {
    for (const playing of [0, 3, 5, 9]) {
      const score = scoreServer(view({ jobId: 'a', playing }), ctx());
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(100);
    }
  });

  it('awards 100 when every applicable component is perfect', () => {
    const regions = new Map([
      ['a', { jobId: 'a', region: REGIONS.singapore!, address: '128.116.97.5' } as RegionResult],
    ]);
    const score = scoreServer(
      view({ jobId: 'a', playing: 0, status: 'clean', favorite: true, firstSeenAt: NOW }),
      ctx({ settings: settings({ preferredRegions: ['singapore'] }), regions }),
    );
    expect(score.total).toBe(100);
  });

  it('returns 0 rather than NaN when every weight is zero', () => {
    const zeroed = settings({
      weights: {
        population: 0,
        reputation: 0,
        serverHealth: 0,
        freshness: 0,
        favorite: 0,
        region: 0,
      },
    });
    const score = scoreServer(view({ jobId: 'a' }), ctx({ settings: zeroed }));
    expect(score.total).toBe(0);
    expect(Number.isNaN(score.total)).toBe(false);
  });
});

describe('rankServers', () => {
  it('sorts by total descending', () => {
    const ranked = rankServers(
      [
        view({ jobId: 'busy', playing: 9 }),
        view({ jobId: 'empty', playing: 0 }),
        view({ jobId: 'mid', playing: 5 }),
      ],
      ctx(),
    );
    expect(ranked.map((s) => s.jobId)).toEqual(['empty', 'mid', 'busy']);
  });

  it('breaks ties deterministically so the ranking does not jitter', () => {
    const first = rankServers([view({ jobId: 'b' }), view({ jobId: 'a' })], ctx());
    const second = rankServers([view({ jobId: 'a' }), view({ jobId: 'b' })], ctx());
    expect(first.map((s) => s.jobId)).toEqual(second.map((s) => s.jobId));
  });

  it('lets a favourite outrank a slightly emptier server', () => {
    const ranked = rankServers(
      [view({ jobId: 'plain', playing: 4 }), view({ jobId: 'fav', playing: 5, favorite: true })],
      ctx(),
    );
    expect(ranked[0]?.jobId).toBe('fav');
  });

  it('every returned score carries a breakdown the panel can render', () => {
    const ranked = rankServers([view({ jobId: 'a' })], ctx());
    expect(ranked[0]!.components.length).toBeGreaterThan(0);
    for (const c of ranked[0]!.components) {
      expect(c.reason.length).toBeGreaterThan(0);
      expect(c.label.length).toBeGreaterThan(0);
    }
  });
});

describe('serverHealth', () => {
  it('rewards a server running at full tick rate', () => {
    const good = scoreServer(view({ jobId: 'a', fps: 60 }), ctx());
    const bad = scoreServer(view({ jobId: 'b', fps: 24 }), ctx());
    expect(component(good, 'serverHealth')!.points).toBeGreaterThan(
      component(bad, 'serverHealth')!.points,
    );
  });

  it('calls out an overloaded server in its reason', () => {
    const score = scoreServer(view({ jobId: 'a', fps: 24 }), ctx());
    expect(component(score, 'serverHealth')!.reason).toMatch(/overloaded/i);
  });

  it('penalises a server whose own players have high latency to it', () => {
    const good = scoreServer(view({ jobId: 'a', ping: 40 }), ctx());
    const bad = scoreServer(view({ jobId: 'b', ping: 240 }), ctx());
    expect(component(good, 'serverHealth')!.points).toBeGreaterThan(
      component(bad, 'serverHealth')!.points,
    );
  });

  it('never claims the ping says anything about distance from the user', () => {
    // The whole point of this component is that it measures the server, not proximity.
    // Roblox seats players on nearby servers, so a low average appears worldwide.
    const score = scoreServer(view({ jobId: 'a', ping: 40, fps: 60 }), ctx());
    const reason = component(score, 'serverHealth')!.reason.toLowerCase();
    expect(reason).toContain('players in it');
    expect(reason).not.toMatch(/\bnear\b|\bclose\b|\bdistance\b|\byour\b/);
  });

  it('is inapplicable when Roblox reported neither number', () => {
    const score = scoreServer(view({ jobId: 'a' }), ctx());
    const health = component(score, 'serverHealth')!;
    expect(health.applicable).toBe(false);
    expect(health.points).toBe(0);
  });

  it('scores on whichever number is present', () => {
    const fpsOnly = scoreServer(view({ jobId: 'a', fps: 60 }), ctx());
    const pingOnly = scoreServer(view({ jobId: 'b', ping: 40 }), ctx());
    expect(component(fpsOnly, 'serverHealth')!.applicable).toBe(true);
    expect(component(pingOnly, 'serverHealth')!.applicable).toBe(true);
  });

  it('clamps rather than going negative or above the weight', () => {
    const terrible = scoreServer(view({ jobId: 'a', fps: 1, ping: 5000 }), ctx());
    const perfect = scoreServer(view({ jobId: 'b', fps: 120, ping: 1 }), ctx());
    const low = component(terrible, 'serverHealth')!;
    const high = component(perfect, 'serverHealth')!;
    expect(low.points).toBe(0);
    expect(high.points).toBe(high.max);
  });

  it('lets a healthy server outrank a marginally emptier unhealthy one', () => {
    const ranked = rankServers(
      [
        view({ jobId: 'laggy', playing: 4, fps: 20, ping: 300 }),
        view({ jobId: 'healthy', playing: 5, fps: 60, ping: 45 }),
      ],
      ctx(),
    );
    expect(ranked[0]?.jobId).toBe('healthy');
  });
});
