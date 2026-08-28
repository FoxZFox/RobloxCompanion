import { describe, expect, it } from 'vitest';
import { PRUNE_AGE_MS, STORAGE_SCHEMA_VERSION } from '../../config/constants';
import { checkServerMembership, describeCheck } from '../../features/playerBlacklist/blacklistCheck';
import { PlayerBlacklistRepository } from './PlayerBlacklistRepository';
import { ServerReportRepository } from './ServerReportRepository';
import { DEFAULT_SETTINGS } from '../../models/settings';
import { SettingsRepository } from './SettingsRepository';
import { MemoryStorageArea } from './storageArea';

describe('SettingsRepository', () => {
  it('returns defaults when nothing is stored', async () => {
    const repo = new SettingsRepository(new MemoryStorageArea());
    const settings = await repo.get();
    expect(settings.serverBrowser.sort).toBe('Asc');
    expect(settings.privacy.shareReportsWithCommunity).toBe(false);
  });

  it('merges a nested patch without dropping sibling keys', async () => {
    const repo = new SettingsRepository(new MemoryStorageArea());
    await repo.set({ serverBrowser: { sort: 'Desc' } });
    const settings = await repo.get();
    expect(settings.serverBrowser.sort).toBe('Desc');
    expect(settings.serverBrowser.excludeFull).toBe(true);
    expect(settings.avoid.exploiterServers).toBe(true);
  });

  it('persists across instances', async () => {
    const storage = new MemoryStorageArea();
    await new SettingsRepository(storage).set({ developerMode: true });
    expect((await new SettingsRepository(storage).get()).developerMode).toBe(true);
  });

  it('writes the schema version on init so migrations have a baseline', async () => {
    const storage = new MemoryStorageArea();
    await new SettingsRepository(storage).init();
    expect((await storage.get('rc:v'))['rc:v']).toBe(STORAGE_SCHEMA_VERSION);
  });
});

describe('ServerReportRepository', () => {
  it('records a status with the live player count', async () => {
    const repo = new ServerReportRepository(new MemoryStorageArea());
    await repo.setStatus('1', 'job', 'exploiters', { playing: 3, maxPlayers: 7 });
    const report = await repo.get('1', 'job');
    expect(report?.status).toBe('exploiters');
    expect(report?.playersWhenReported).toBe(3);
    expect(report?.reportedAt).toBeGreaterThan(0);
  });

  it('clears the report timestamp when a flag is undone', async () => {
    const repo = new ServerReportRepository(new MemoryStorageArea());
    await repo.setStatus('1', 'job', 'bugged');
    await repo.setStatus('1', 'job', 'unknown');
    const report = await repo.get('1', 'job');
    expect(report?.reportedAt).toBeUndefined();
  });

  it('keeps favourite separate from reputation', async () => {
    // Regression guard for the modelling choice: starring a clean server must not
    // erase the fact that it was checked and clean.
    const repo = new ServerReportRepository(new MemoryStorageArea());
    await repo.setStatus('1', 'job', 'clean');
    await repo.setFavorite('1', 'job', true);
    const report = await repo.get('1', 'job');
    expect(report?.status).toBe('clean');
    expect(report?.favorite).toBe(true);
  });

  it('only touches servers it already tracks, keeping storage proportional to work done', async () => {
    const repo = new ServerReportRepository(new MemoryStorageArea());
    await repo.touchSeen('1', [{ jobId: 'never-seen', playing: 1, maxPlayers: 7 }]);
    expect(await repo.get('1', 'never-seen')).toBeUndefined();
  });

  it('sets firstSeenAt on a tracked server, which is our only server-age signal', async () => {
    const repo = new ServerReportRepository(new MemoryStorageArea());
    await repo.setStatus('1', 'job', 'clean');
    await repo.touchSeen('1', [{ jobId: 'job', playing: 1, maxPlayers: 7 }]);
    expect((await repo.get('1', 'job'))?.firstSeenAt).toBeGreaterThan(0);
  });

  it('prunes untouched stale reports but keeps flagged ones forever', async () => {
    const storage = new MemoryStorageArea();
    const repo = new ServerReportRepository(storage);
    await storage.set({
      'rc:reports:1': {
        stale: { placeId: '1', jobId: 'stale', status: 'unknown', firstSeenAt: 0 },
        flagged: { placeId: '1', jobId: 'flagged', status: 'exploiters', firstSeenAt: 0, reportedAt: 1 },
        starred: { placeId: '1', jobId: 'starred', status: 'unknown', firstSeenAt: 0, favorite: true },
      },
    });

    const removed = await repo.pruneStale('1', PRUNE_AGE_MS + 1000);
    expect(removed).toBe(1);
    expect(await repo.get('1', 'stale')).toBeUndefined();
    expect(await repo.get('1', 'flagged')).toBeDefined();
    expect(await repo.get('1', 'starred')).toBeDefined();
  });

  it('records last-joined details for the flag panel', async () => {
    const repo = new ServerReportRepository(new MemoryStorageArea());
    await repo.markJoined('1', { jobId: 'job', playing: 2, maxPlayers: 7, ping: 43 }, 'Some Game');
    const last = await repo.getLastJoined('1');
    expect(last?.jobId).toBe('job');
    expect(last?.playersAtJoin).toBe(2);
    expect(last?.gameName).toBe('Some Game');
  });
});

describe('PlayerBlacklistRepository', () => {
  it('keys players by userId so a rename does not lose them', async () => {
    const repo = new PlayerBlacklistRepository(new MemoryStorageArea());
    await repo.add({ userId: 123, username: 'OldName', reason: 'exploit' });
    expect(await repo.has(123)).toBe(true);
  });

  it('treats a repeat add as another encounter rather than a duplicate', async () => {
    const repo = new PlayerBlacklistRepository(new MemoryStorageArea());
    await repo.add({ userId: 123, username: 'A', reason: 'exploit' });
    await repo.add({ userId: 123, username: 'A', reason: 'exploit' });
    const list = await repo.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.encounters).toBe(2);
  });

  it('round-trips through export and import', async () => {
    const source = new PlayerBlacklistRepository(new MemoryStorageArea());
    await source.add({ userId: 1, username: 'A', reason: 'bot' });
    const payload = await source.exportPlayers();

    const target = new PlayerBlacklistRepository(new MemoryStorageArea());
    expect(await target.importPlayers(payload)).toBe(1);
    expect(await target.has(1)).toBe(true);
  });

  it('refuses an unknown schema version instead of corrupting the list', async () => {
    const repo = new PlayerBlacklistRepository(new MemoryStorageArea());
    await expect(repo.importPlayers({ schemaVersion: 99, players: [] })).rejects.toThrow();
  });

  it('merges on import so your own entries survive', async () => {
    const repo = new PlayerBlacklistRepository(new MemoryStorageArea());
    await repo.add({ userId: 1, username: 'Mine', reason: 'toxic' });
    await repo.importPlayers({
      schemaVersion: STORAGE_SCHEMA_VERSION,
      players: [
        {
          userId: 2,
          usernameAtReport: 'Theirs',
          reason: 'exploit',
          addedAt: Date.now(),
          encounters: 1,
        },
      ],
    });
    expect((await repo.list()).map((p) => p.userId).sort()).toEqual([1, 2]);
  });
});

describe('blacklist membership checking', () => {
  it('answers unknown when there are players to look for, because Roblox discloses nothing', () => {
    // playerTokens comes back empty from the public server list, so there is genuinely
    // nothing to match against. Answering anything else would be a lie (spec section 13).
    const check = checkServerMembership({ id: 'job', playerTokens: [] }, [1, 2, 3]);
    expect(check.verdict).toBe('unknown');
    expect(check.detected).toEqual([]);
    expect(check.undeterminable).toBe(3);
  });

  it('answers none-detected only when there is nothing to look for', () => {
    expect(checkServerMembership({ id: 'job' }, []).verdict).toBe('none-detected');
  });

  it('never describes an unknown result as safe', () => {
    const text = describeCheck({ verdict: 'unknown', detected: [], undeterminable: 4 });
    expect(text.toLowerCase()).not.toContain('safe');
    expect(text).toContain('unavailable');
  });
});

describe('SmartJoin settings merge', () => {
  it('flips one nested weight without wiping its siblings', async () => {
    // SettingsPatch is one level deep for every branch except Smart Join. If that
    // exception regresses, a patch touching one weight silently resets the others.
    const repo = new SettingsRepository(new MemoryStorageArea());
    await repo.set({ smartJoin: { weights: { population: 55 } } });
    await repo.set({ smartJoin: { weights: { reputation: 11 } } });

    const { smartJoin } = await repo.get();
    expect(smartJoin.weights.population).toBe(55);
    expect(smartJoin.weights.reputation).toBe(11);
    expect(smartJoin.weights.freshness).toBeGreaterThan(0);
  });

  it('keeps the other smart-join branches when one changes', async () => {
    const repo = new SettingsRepository(new MemoryStorageArea());
    await repo.set({ smartJoin: { preferredRegions: ['singapore', 'tokyo'] } });
    await repo.set({ smartJoin: { population: 'highest' } });

    const { smartJoin } = await repo.get();
    expect(smartJoin.population).toBe('highest');
    expect(smartJoin.preferredRegions).toEqual(['singapore', 'tokyo']);
    expect(smartJoin.weights.population).toBeGreaterThan(0);
  });

  it('ships with no preferred regions, since nothing can resolve them', async () => {
    const repo = new SettingsRepository(new MemoryStorageArea());
    const { smartJoin } = await repo.get();
    expect(smartJoin.preferredRegions).toEqual([]);
  });
});

describe('settings storage stores overrides, not a snapshot', () => {
  it('lets a new default reach a user who never touched that setting', async () => {
    // The bug this exists to prevent: storing the resolved object pinned every value, so
    // shipping playtime switched on by default did nothing for anyone who already had
    // settings saved. Their storage still held the `false` that was the default when it
    // was written, and the feature shipped invisible.
    const storage = new MemoryStorageArea();

    const first = new SettingsRepository(storage);
    await first.init();
    await first.set({ surface: 'popup' });

    // Only the field actually changed should be on disk.
    const written = (await storage.get('rc:settings'))['rc:settings'] as Record<string, unknown>;
    expect(written).toEqual({ surface: 'popup' });
    expect(written.features).toBeUndefined();
  });

  it('still honours a choice the user did make', async () => {
    const storage = new MemoryStorageArea();
    const repo = new SettingsRepository(storage);
    await repo.init();
    await repo.set({ features: { playtime: false } });

    expect((await new SettingsRepository(storage).get()).features.playtime).toBe(false);
  });

  it('accumulates separate changes instead of replacing them', async () => {
    const storage = new MemoryStorageArea();
    const repo = new SettingsRepository(storage);
    await repo.init();

    await repo.set({ surface: 'popup' });
    await repo.set({ developerMode: true });
    await repo.set({ serverBrowser: { sort: 'Desc' } });

    const settings = await new SettingsRepository(storage).get();
    expect(settings.surface).toBe('popup');
    expect(settings.developerMode).toBe(true);
    expect(settings.serverBrowser.sort).toBe('Desc');
    // Untouched, so it must still follow the default.
    expect(settings.serverBrowser.excludeFull).toBe(DEFAULT_SETTINGS.serverBrowser.excludeFull);
  });
});

describe('feature-flag migration', () => {
  /** What v1 wrote: a fully resolved snapshot, with every field pinned. */
  const v1Snapshot = {
    ...DEFAULT_SETTINGS,
    features: { ...DEFAULT_SETTINGS.features, playtime: false, servers: false },
    surface: 'popup' as const,
  };

  it('unpins a feature introduced after the stored version', async () => {
    const storage = new MemoryStorageArea();
    await storage.set({ 'rc:v': 1, 'rc:settings': v1Snapshot });

    const repo = new SettingsRepository(storage);
    await repo.init();

    // Playtime did not exist at v1 and its toggle was disabled, so the stored `false`
    // was never a decision - the current default wins.
    expect((await repo.get()).features.playtime).toBe(true);
  });

  it('keeps a feature the user genuinely could have switched off', async () => {
    const storage = new MemoryStorageArea();
    await storage.set({ 'rc:v': 1, 'rc:settings': v1Snapshot });

    const repo = new SettingsRepository(storage);
    await repo.init();

    // The server browser existed at v1 with a working toggle, so this one stands.
    expect((await repo.get()).features.servers).toBe(false);
    expect((await repo.get()).surface).toBe('popup');
  });

  it('unpins every feature introduced across several versions at once', async () => {
    // Someone upgrading from v1 straight to today must pick up all of them, not just the
    // most recent - the migration walks every version in between.
    const storage = new MemoryStorageArea();
    await storage.set({
      'rc:v': 1,
      'rc:settings': {
        ...v1Snapshot,
        features: { ...v1Snapshot.features, playtime: false, commandPalette: false },
      },
    });

    const repo = new SettingsRepository(storage);
    await repo.init();
    const settings = await repo.get();

    expect(settings.features.playtime).toBe(true);
    expect(settings.features.commandPalette).toBe(true);
  });

  it('records the new schema version so it runs only once', async () => {
    const storage = new MemoryStorageArea();
    await storage.set({ 'rc:v': 1, 'rc:settings': v1Snapshot });

    await new SettingsRepository(storage).init();
    expect((await storage.get('rc:v'))['rc:v']).toBe(STORAGE_SCHEMA_VERSION);
  });

  it('is harmless on a fresh install with nothing stored', async () => {
    const storage = new MemoryStorageArea();
    const repo = new SettingsRepository(storage);
    await repo.init();
    expect((await repo.get()).features.playtime).toBe(true);
  });
});

describe('themes shipped switched on (schema v4)', () => {
  it('unpins the themes flag for someone who was already on v3', async () => {
    // The whole reason the schema was bumped. A v3 settings object carries themes:false,
    // which was the default while phase 8 was unbuilt and never a choice anyone made -
    // and playtime proved that leaving it pinned means nobody ever finds the feature.
    const storage = new MemoryStorageArea();
    await storage.set({
      'rc:v': 3,
      'rc:settings': { features: { ...DEFAULT_SETTINGS.features, themes: false } },
    });

    const repo = new SettingsRepository(storage);
    await repo.init();

    expect((await repo.get()).features.themes).toBe(true);
  });

  it('leaves the page alone until a theme is actually chosen', async () => {
    const repo = new SettingsRepository(new MemoryStorageArea());
    await repo.init();
    const settings = await repo.get();

    expect(settings.features.themes).toBe(true);
    expect(settings.theme.preset).toBe('off');
  });

  it('keeps the three custom colours independent of each other', async () => {
    const repo = new SettingsRepository(new MemoryStorageArea());
    await repo.set({ theme: { custom: { accent: '#ff0000' } } });
    const settings = await repo.set({ theme: { custom: { background: '#000000' } } });

    expect(settings.theme.custom.accent).toBe('#ff0000');
    expect(settings.theme.custom.background).toBe('#000000');
    expect(settings.theme.custom.text).toBe(DEFAULT_SETTINGS.theme.custom.text);
  });
});

describe('private servers shipped (schema v5)', () => {
  it('unpins the privateServers flag for someone already on v4', async () => {
    const storage = new MemoryStorageArea();
    await storage.set({
      'rc:v': 4,
      'rc:settings': { features: { ...DEFAULT_SETTINGS.features, privateServers: false } },
    });

    const repo = new SettingsRepository(storage);
    await repo.init();

    expect((await repo.get()).features.privateServers).toBe(true);
  });

  it('still leaves themes alone for someone already on v4', async () => {
    // Themes arrived at v4, so a v4 user could genuinely have switched it off. Only the
    // flags introduced *after* the stored version get unpinned.
    const storage = new MemoryStorageArea();
    await storage.set({
      'rc:v': 4,
      'rc:settings': { features: { ...DEFAULT_SETTINGS.features, themes: false } },
    });

    const repo = new SettingsRepository(storage);
    await repo.init();

    expect((await repo.get()).features.themes).toBe(false);
  });
});

describe('quick search shipped (schema v6)', () => {
  it('unpins the quickSearch flag for someone already on v5', async () => {
    const storage = new MemoryStorageArea();
    await storage.set({
      'rc:v': 5,
      'rc:settings': { features: { ...DEFAULT_SETTINGS.features, quickSearch: false } },
    });

    const repo = new SettingsRepository(storage);
    await repo.init();

    expect((await repo.get()).features.quickSearch).toBe(true);
  });
});

describe('profiles shipped (schema v7)', () => {
  it('unpins the profiles flag for someone already on v6', async () => {
    const storage = new MemoryStorageArea();
    await storage.set({
      'rc:v': 6,
      'rc:settings': { features: { ...DEFAULT_SETTINGS.features, profiles: false } },
    });

    const repo = new SettingsRepository(storage);
    await repo.init();

    expect((await repo.get()).features.profiles).toBe(true);
  });
});
