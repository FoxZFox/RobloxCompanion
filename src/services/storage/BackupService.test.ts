import { describe, expect, it } from 'vitest';
import { STORAGE_SCHEMA_VERSION } from '../../config/constants';
import { BackupService } from './BackupService';
import { CustomFlagRepository } from './CustomFlagRepository';
import { PlayerBlacklistRepository } from './PlayerBlacklistRepository';
import { ServerHistoryRepository } from './ServerHistoryRepository';
import { ServerReportRepository } from './ServerReportRepository';
import { SettingsRepository } from './SettingsRepository';
import { MemoryStorageArea } from './storageArea';

function build() {
  const storage = new MemoryStorageArea();
  const settings = new SettingsRepository(storage);
  const flags = new CustomFlagRepository(storage);
  const blacklist = new PlayerBlacklistRepository(storage);
  const reports = new ServerReportRepository(storage);
  const history = new ServerHistoryRepository(storage);
  return {
    storage,
    settings,
    flags,
    blacklist,
    reports,
    history,
    service: new BackupService(settings, flags, blacklist, reports, history),
  };
}

const selection = {
  settings: true,
  customFlags: true,
  blacklist: true,
  servers: true,
};

describe('BackupService export', () => {
  it('stamps a schema version so an import can refuse what it cannot read', async () => {
    const { service } = build();
    const bundle = await service.exportBundle(selection, []);
    expect(bundle.schemaVersion).toBe(STORAGE_SCHEMA_VERSION);
    expect(bundle.exportedAt).toBeGreaterThan(0);
  });

  it('includes only what was asked for', async () => {
    const { service, flags } = build();
    await flags.create({ name: 'Test', icon: '⭐', avoid: false });

    const bundle = await service.exportBundle(
      { settings: false, customFlags: true, blacklist: false, servers: false },
      [],
    );
    expect(bundle.customFlags).toHaveLength(1);
    expect(bundle.settings).toBeUndefined();
    expect(bundle.blacklist).toBeUndefined();
  });

  it('carries per-place reports and history', async () => {
    const { service, reports } = build();
    await reports.setStatus('123', 'job', 'exploiters');

    const bundle = await service.exportBundle(selection, ['123']);
    expect(bundle.reports?.['123']?.['job']?.status).toBe('exploiters');
    expect(bundle.history?.['123']).toEqual([]);
  });
});

describe('BackupService import', () => {
  it('refuses a schema version it does not understand', async () => {
    const { service } = build();
    await expect(service.importBundle({ schemaVersion: 99, exportedAt: 0 })).rejects.toThrow(/version/i);
  });

  it('round-trips flags, blacklist and reports', async () => {
    const source = build();
    await source.flags.create({ name: 'No guardian', icon: '🐣', avoid: true });
    await source.blacklist.add({ userId: 1, username: 'A', reason: 'exploit' });
    await source.reports.setStatus('123', 'job', 'bugged');
    const bundle = await source.service.exportBundle(selection, ['123']);

    const target = build();
    const summary = await target.service.importBundle(bundle);

    expect(summary.customFlags).toBe(1);
    expect(summary.blacklist).toBe(1);
    expect(summary.places).toBe(1);
    expect((await target.flags.list())[0]?.name).toBe('No guardian');
    expect(await target.blacklist.has(1)).toBe(true);
    expect((await target.reports.get('123', 'job'))?.status).toBe('bugged');
  });

  it('merges rather than replacing, so local data survives a restore', async () => {
    // Someone restoring an old backup, or accepting a friend's flag set, must never
    // silently lose the reports they already had.
    const source = build();
    await source.reports.setStatus('123', 'theirs', 'clean');
    const bundle = await source.service.exportBundle(selection, ['123']);

    const target = build();
    await target.reports.setStatus('123', 'mine', 'exploiters');
    await target.service.importBundle(bundle);

    expect((await target.reports.get('123', 'mine'))?.status).toBe('exploiters');
    expect((await target.reports.get('123', 'theirs'))?.status).toBe('clean');
  });

  it('keeps the local report when both sides describe the same server', async () => {
    const source = build();
    await source.reports.setStatus('123', 'job', 'clean');
    const bundle = await source.service.exportBundle(selection, ['123']);

    const target = build();
    await target.reports.setStatus('123', 'job', 'exploiters');
    await target.service.importBundle(bundle);

    // The local one reflects what this user actually saw.
    expect((await target.reports.get('123', 'job'))?.status).toBe('exploiters');
  });

  it('does not duplicate a flag that is already present', async () => {
    const source = build();
    await source.flags.create({ name: 'Dup', icon: '⭐', avoid: false });
    const bundle = await source.service.exportBundle(selection, []);

    const target = build();
    await target.service.importBundle(bundle);
    const second = await target.service.importBundle(bundle);

    expect(second.customFlags).toBe(0);
    expect(await target.flags.list()).toHaveLength(1);
  });
});

describe('BackupService.parse', () => {
  it('rejects non-JSON with a readable message', () => {
    expect(() => BackupService.parse('{not json')).toThrow(/valid JSON/i);
  });

  it('rejects JSON that is not a backup', () => {
    expect(() => BackupService.parse('[1,2,3]')).toThrow(/schemaVersion/i);
    expect(() => BackupService.parse('null')).toThrow(/backup/i);
  });

  it('accepts a well-formed bundle', () => {
    expect(BackupService.parse('{"schemaVersion":7}').schemaVersion).toBe(7);
  });
});
