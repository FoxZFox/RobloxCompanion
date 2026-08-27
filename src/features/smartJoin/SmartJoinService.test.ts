import { describe, expect, it } from 'vitest';
import type { ScanOutcome, ServerView } from '../../models/server';
import { DEFAULT_SETTINGS } from '../../models/settings';
import { DEFAULT_SMART_JOIN, type RegionResult, type SmartJoinSettings } from '../../models/smartJoin';
import { REGIONS } from './regionData';
import type { RegionLookup, RegionSource } from './regionSource';
import { UnavailableRegionSource } from './regionSource';
import { SmartJoinService } from './SmartJoinService';

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

const outcome = (patch: Partial<ScanOutcome> = {}): ScanOutcome => ({
  placeId: '1',
  servers: [],
  complete: true,
  truncated: false,
  filtered: false,
  cursor: null,
  pagesFetched: 1,
  scannedAt: 0,
  ...patch,
});

function request(views: ServerView[], settings: SmartJoinSettings) {
  return {
    placeId: '1',
    views,
    outcome: outcome(),
    settings,
    avoid: DEFAULT_SETTINGS.avoid,
  };
}

const settings = (patch: Partial<SmartJoinSettings> = {}): SmartJoinSettings => ({
  ...DEFAULT_SMART_JOIN,
  ...patch,
});

/** A hypothetical working source, for exercising the path a backend would take. */
class StubRegionSource implements RegionSource {
  readonly available = true;
  readonly calls: string[][] = [];

  constructor(private readonly addressFor: (jobId: string) => string | null) {}

  async lookup(req: RegionLookup): Promise<Map<string, RegionResult>> {
    this.calls.push(req.jobIds);
    return this.cached(req.jobIds);
  }

  cached(jobIds: string[]): Map<string, RegionResult> {
    const results = new Map<string, RegionResult>();
    for (const jobId of jobIds) {
      const id = this.addressFor(jobId);
      results.set(
        jobId,
        id ? { jobId, region: REGIONS[id]! } : { jobId, region: null, reason: 'unmatched' },
      );
    }
    return results;
  }
}

describe('SmartJoinService without a region source', () => {
  it('picks the emptiest eligible server', async () => {
    const service = new SmartJoinService(new UnavailableRegionSource());
    const plan = await service.plan(
      request([view({ jobId: 'busy', playing: 9 }), view({ jobId: 'empty', playing: 0 })], settings()),
    );
    expect(plan.chosen?.jobId).toBe('empty');
  });

  it('never asks an unavailable source anything', async () => {
    // Roblox gates the only region endpoint to its game client, so attempting a lookup
    // would spend join attempts on a call that cannot succeed.
    let asked = false;
    const source: RegionSource = {
      available: false,
      async lookup(req) {
        asked = true;
        return this.cached(req.jobIds);
      },
      cached: (jobIds) =>
        new Map(jobIds.map((jobId) => [jobId, { jobId, region: null, reason: 'no-source' }])),
    };

    const service = new SmartJoinService(source);
    await service.plan(
      request([view({ jobId: 'a' })], settings({ preferredRegions: ['singapore'] })),
    );

    expect(asked).toBe(false);
  });

  it('omits the region row from the breakdown entirely', async () => {
    // A row that permanently reads "not checked" is noise. The reason region is missing
    // is stated once in Settings instead.
    const service = new SmartJoinService(new UnavailableRegionSource());
    const plan = await service.plan(request([view({ jobId: 'a' })], settings()));

    const keys = plan.chosen?.components.map((c) => c.key) ?? [];
    expect(keys).toEqual([
      'population',
      'reputation',
      'serverHealth',
      'freshness',
      'favorite',
    ]);
    expect(keys).not.toContain('region');
  });

  it('reports zero regions resolved', async () => {
    const service = new SmartJoinService(new UnavailableRegionSource());
    const plan = await service.plan(request([view({ jobId: 'a' })], settings()));
    expect(plan.regionsProbed).toBe(0);
  });

  it('returns no choice when every server is disqualified', async () => {
    const service = new SmartJoinService(new UnavailableRegionSource());
    const plan = await service.plan(
      request(
        [
          view({ jobId: 'a', status: 'exploiters' }),
          view({ jobId: 'b', playing: 10, maxPlayers: 10 }),
        ],
        settings(),
      ),
    );
    expect(plan.chosen).toBeNull();
    expect(plan.considered).toBe(0);
  });

  it('flags that the ranking covers only what Roblox let us page through', async () => {
    const service = new SmartJoinService(new UnavailableRegionSource());
    const plan = await service.plan({
      ...request([view({ jobId: 'a' })], settings()),
      outcome: outcome({ complete: false, truncated: true }),
    });
    expect(plan.capped).toBe(true);
  });
});

describe('UnavailableRegionSource', () => {
  it('answers no-source for every server without doing work', async () => {
    const source = new UnavailableRegionSource();
    const result = await source.lookup({ placeId: '1', jobIds: ['a', 'b'], limit: 8 });
    expect(result.get('a')?.reason).toBe('no-source');
    expect(result.get('b')?.region).toBeNull();
  });
});

/**
 * These exercise the path a future backend-backed source would take. The scoring and
 * ranking are already written and tested; only the data source is missing.
 */
describe('SmartJoinService with a working region source', () => {
  it('asks only for the top candidates', async () => {
    const source = new StubRegionSource(() => 'singapore');
    const service = new SmartJoinService(source);

    const views = Array.from({ length: 50 }, (_, i) => view({ jobId: `job-${i}`, playing: i % 10 }));
    await service.plan(request(views, settings({ preferredRegions: ['singapore'] })));

    expect(source.calls[0]!.length).toBeLessThanOrEqual(8);
  });

  it('promotes a server that sits in the preferred region', async () => {
    const source = new StubRegionSource((jobId) => (jobId === 'near' ? 'singapore' : 'tokyo'));
    const views = [view({ jobId: 'far', playing: 3 }), view({ jobId: 'near', playing: 4 })];

    const without = await new SmartJoinService(new UnavailableRegionSource()).plan(
      request(views, settings()),
    );
    const withRegion = await new SmartJoinService(source).plan(
      request(views, settings({ preferredRegions: ['singapore'] })),
    );

    expect(without.chosen?.jobId).toBe('far');
    expect(withRegion.chosen?.jobId).toBe('near');
  });

  it('does not ask when the user has set no preferred regions', async () => {
    const source = new StubRegionSource(() => 'singapore');
    await new SmartJoinService(source).plan(request([view({ jobId: 'a' })], settings()));
    expect(source.calls).toHaveLength(0);
  });

  it('counts only the servers whose region actually resolved', async () => {
    const source = new StubRegionSource((jobId) => (jobId === 'a' ? 'singapore' : null));
    const plan = await new SmartJoinService(source).plan(
      request(
        [view({ jobId: 'a' }), view({ jobId: 'b' })],
        settings({ preferredRegions: ['singapore'] }),
      ),
    );
    expect(plan.regionsProbed).toBe(1);
  });
});
