import { describe, expect, it } from 'vitest';
import type { CustomFlag } from '../../models/flags';
import { avoidableFlagIds, flagsForPlace } from '../../models/flags';
import type { ServerView } from '../../models/server';
import { DEFAULT_SETTINGS } from '../../models/settings';
import { isAvoided, joinCandidates, pickLowest } from './serverFilters';
import { CustomFlagRepository } from '../../services/storage/CustomFlagRepository';
import { ServerReportRepository } from '../../services/storage/ServerReportRepository';
import { MemoryStorageArea } from '../../services/storage/storageArea';

function view(overrides: Partial<ServerView> & { jobId: string }): ServerView {
  return {
    placeId: '1',
    playing: 1,
    maxPlayers: 10,
    status: 'unknown',
    liveness: 'online',
    favorite: false,
    customFlagIds: [],
    ...overrides,
  };
}

const flag = (patch: Partial<CustomFlag> & { id: string }): CustomFlag => ({
  name: 'Test',
  icon: '⭐',
  avoid: false,
  createdAt: 0,
  ...patch,
});

const avoid = DEFAULT_SETTINGS.avoid;

describe('flagsForPlace', () => {
  it('includes global flags everywhere', () => {
    const flags = [flag({ id: 'global' })];
    expect(flagsForPlace(flags, '123').map((f) => f.id)).toEqual(['global']);
    expect(flagsForPlace(flags, '999').map((f) => f.id)).toEqual(['global']);
  });

  it('confines a scoped flag to its own experience', () => {
    const flags = [flag({ id: 'mine', placeId: '123' })];
    expect(flagsForPlace(flags, '123').map((f) => f.id)).toEqual(['mine']);
    expect(flagsForPlace(flags, '999')).toHaveLength(0);
  });

  it('orders by creation so the list does not reshuffle', () => {
    const flags = [flag({ id: 'b', createdAt: 2 }), flag({ id: 'a', createdAt: 1 })];
    expect(flagsForPlace(flags, '1').map((f) => f.id)).toEqual(['a', 'b']);
  });
});

describe('custom flags in avoid rules', () => {
  it('skips a server carrying a flag the user marked avoid', () => {
    // The whole point of letting someone define a flag is that the extension then acts
    // on it exactly like a built-in status.
    const avoidable = avoidableFlagIds([flag({ id: 'bugged', avoid: true })]);
    expect(isAvoided(view({ jobId: 'a', customFlagIds: ['bugged'] }), avoid, avoidable)).toBe(true);
  });

  it('ignores a flag that is not marked avoid', () => {
    const avoidable = avoidableFlagIds([flag({ id: 'farming', avoid: false })]);
    expect(isAvoided(view({ jobId: 'a', customFlagIds: ['farming'] }), avoid, avoidable)).toBe(
      false,
    );
  });

  it('leaves servers alone when no flags are avoidable', () => {
    expect(isAvoided(view({ jobId: 'a', customFlagIds: ['x'] }), avoid, new Set())).toBe(false);
    expect(isAvoided(view({ jobId: 'a', customFlagIds: ['x'] }), avoid)).toBe(false);
  });

  it('keeps Join Lowest out of a custom-flagged server even when it is emptiest', () => {
    const avoidable = avoidableFlagIds([flag({ id: 'noguardian', avoid: true })]);
    const views = [
      view({ jobId: 'flagged', playing: 0, customFlagIds: ['noguardian'] }),
      view({ jobId: 'ok', playing: 5 }),
    ];
    expect(pickLowest(views, { avoid, avoidableFlags: avoidable })?.jobId).toBe('ok');
  });

  it('lets the same server through once the flag stops being avoidable', () => {
    const views = [view({ jobId: 'flagged', playing: 0, customFlagIds: ['x'] })];
    expect(joinCandidates(views, { avoid, avoidableFlags: new Set(['x']) })).toHaveLength(0);
    expect(joinCandidates(views, { avoid, avoidableFlags: new Set() })).toHaveLength(1);
  });
});

describe('CustomFlagRepository', () => {
  it('creates a flag with a unique id', async () => {
    const repo = new CustomFlagRepository(new MemoryStorageArea());
    const a = await repo.create({ name: 'One', icon: '⭐', avoid: false });
    const b = await repo.create({ name: 'Two', icon: '🐛', avoid: true });
    expect(a.id).not.toBe(b.id);
    expect((await repo.list()).map((f) => f.name)).toEqual(['One', 'Two']);
  });

  it('trims and caps an over-long name', async () => {
    const repo = new CustomFlagRepository(new MemoryStorageArea());
    const created = await repo.create({ name: `  ${'x'.repeat(80)}  `, icon: '⭐', avoid: false });
    expect(created.name.length).toBeLessThanOrEqual(24);
  });

  it('omits placeId entirely for a global flag', async () => {
    const repo = new CustomFlagRepository(new MemoryStorageArea());
    const created = await repo.create({ name: 'Global', icon: '⭐', avoid: false });
    expect('placeId' in created).toBe(false);
  });

  it('updates avoid without losing the rest', async () => {
    const repo = new CustomFlagRepository(new MemoryStorageArea());
    const created = await repo.create({ name: 'Laggy', icon: '🐌', avoid: false });
    await repo.update(created.id, { avoid: true });
    const [stored] = await repo.list();
    expect(stored?.avoid).toBe(true);
    expect(stored?.name).toBe('Laggy');
    expect(stored?.icon).toBe('🐌');
  });
});

describe('applying flags to servers', () => {
  it('adds and removes a flag on a server', async () => {
    const repo = new ServerReportRepository(new MemoryStorageArea());
    await repo.toggleCustomFlag('1', 'job', 'f1', true);
    expect((await repo.get('1', 'job'))?.customFlagIds).toEqual(['f1']);

    await repo.toggleCustomFlag('1', 'job', 'f1', false);
    expect((await repo.get('1', 'job'))?.customFlagIds).toBeUndefined();
  });

  it('does not duplicate a flag applied twice', async () => {
    const repo = new ServerReportRepository(new MemoryStorageArea());
    await repo.toggleCustomFlag('1', 'job', 'f1', true);
    await repo.toggleCustomFlag('1', 'job', 'f1', true);
    expect((await repo.get('1', 'job'))?.customFlagIds).toEqual(['f1']);
  });

  it('keeps flags independent of reputation status', async () => {
    const repo = new ServerReportRepository(new MemoryStorageArea());
    await repo.setStatus('1', 'job', 'clean');
    await repo.toggleCustomFlag('1', 'job', 'f1', true);
    const report = await repo.get('1', 'job');
    expect(report?.status).toBe('clean');
    expect(report?.customFlagIds).toEqual(['f1']);
  });

  it('purges a deleted flag from every server that carried it', async () => {
    // A leftover id would keep influencing avoid rules with nothing in the UI to explain
    // why a server was being skipped.
    const repo = new ServerReportRepository(new MemoryStorageArea());
    await repo.toggleCustomFlag('1', 'a', 'gone', true);
    await repo.toggleCustomFlag('1', 'b', 'gone', true);
    await repo.toggleCustomFlag('1', 'b', 'kept', true);

    await repo.purgeCustomFlag('1', 'gone');

    expect((await repo.get('1', 'a'))?.customFlagIds).toBeUndefined();
    expect((await repo.get('1', 'b'))?.customFlagIds).toEqual(['kept']);
  });
});
