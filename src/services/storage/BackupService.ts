import { STORAGE_SCHEMA_VERSION } from '../../config/constants';
import { unpinFeaturesIntroducedAfter } from '../../config/features';
import type { BlacklistedPlayer } from '../../models/blacklist';
import type { CustomFlag } from '../../models/flags';
import type { HistoryEntry } from '../../models/messages';
import type { ReportMap } from '../../models/server';
import type { Settings } from '../../models/settings';
import type { CustomFlagRepository } from './CustomFlagRepository';
import type { PlayerBlacklistRepository } from './PlayerBlacklistRepository';
import type { ServerHistoryRepository } from './ServerHistoryRepository';
import type { ServerReportRepository } from './ServerReportRepository';
import type { SettingsRepository } from './SettingsRepository';

export interface BackupBundle {
  schemaVersion: number;
  exportedAt: number;
  settings?: Settings;
  customFlags?: CustomFlag[];
  blacklist?: BlacklistedPlayer[];
  /** Keyed by placeId. */
  reports?: Record<string, ReportMap>;
  history?: Record<string, HistoryEntry[]>;
}

export interface BackupSelection {
  settings: boolean;
  customFlags: boolean;
  blacklist: boolean;
  servers: boolean;
}

export interface ImportSummary {
  settings: boolean;
  customFlags: number;
  blacklist: number;
  places: number;
}

/**
 * Export and import of everything the extension knows (spec section 37).
 *
 * Every bundle carries `schemaVersion`, and an import refuses a version it does not
 * understand rather than half-applying it. Imports MERGE rather than replace: someone
 * restoring a backup, or accepting a friend's flag set, must never silently lose the
 * reports they already had.
 */
export class BackupService {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly flags: CustomFlagRepository,
    private readonly blacklist: PlayerBlacklistRepository,
    private readonly reports: ServerReportRepository,
    private readonly history: ServerHistoryRepository,
  ) {}

  async exportBundle(selection: BackupSelection, placeIds: string[]): Promise<BackupBundle> {
    const bundle: BackupBundle = {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      exportedAt: Date.now(),
    };

    if (selection.settings) bundle.settings = await this.settings.get();
    if (selection.customFlags) bundle.customFlags = await this.flags.list();
    if (selection.blacklist) bundle.blacklist = await this.blacklist.list();

    if (selection.servers) {
      const reports: Record<string, ReportMap> = {};
      const history: Record<string, HistoryEntry[]> = {};
      for (const placeId of placeIds) {
        reports[placeId] = await this.reports.getAll(placeId);
        history[placeId] = await this.history.list(placeId);
      }
      bundle.reports = reports;
      bundle.history = history;
    }

    return bundle;
  }

  async importBundle(bundle: BackupBundle): Promise<ImportSummary> {
    /*
     * Older bundles are welcome; newer ones are refused.
     *
     * A backup taken before a schema bump is still perfectly readable - every version so
     * far has only added keys, and anything missing resolves to its default. Rejecting
     * those would mean every bump silently invalidated the backups people had already
     * taken, which is the opposite of what a backup is for. A bundle from a later build
     * is a different matter: we cannot know what it means, so we do not guess.
     */
    if (bundle.schemaVersion > STORAGE_SCHEMA_VERSION) {
      throw new Error(
        `Backup is schema version ${bundle.schemaVersion}; this build reads version ${STORAGE_SCHEMA_VERSION}`,
      );
    }

    const summary: ImportSummary = {
      settings: false,
      customFlags: 0,
      blacklist: 0,
      places: 0,
    };

    if (bundle.settings) {
      /*
       * A bundle carries a fully resolved Settings object, so every feature flag in it
       * looks like a deliberate choice - including the ones that did not exist when it
       * was taken and were merely off by default. Importing those verbatim would pin
       * them off forever, which is precisely how playtime shipped invisible.
       */
      const features = unpinFeaturesIntroducedAfter(bundle.settings.features, bundle.schemaVersion);
      await this.settings.set({ ...bundle.settings, features });
      summary.settings = true;
    }

    if (bundle.customFlags?.length) {
      // Merge by id, keeping whatever is already here on a collision.
      const existing = await this.flags.getAll();
      const merged = [...Object.values(existing)];
      for (const flag of bundle.customFlags) {
        if (existing[flag.id]) continue;
        merged.push(flag);
        summary.customFlags += 1;
      }
      await this.flags.replaceAll(merged);
    }

    if (bundle.blacklist?.length) {
      summary.blacklist = await this.blacklist.importPlayers({
        schemaVersion: bundle.schemaVersion,
        players: bundle.blacklist,
      });
    }

    if (bundle.reports) {
      for (const [placeId, incoming] of Object.entries(bundle.reports)) {
        const current = await this.reports.getAll(placeId);
        // A report we already hold wins: the local one reflects what this user saw.
        const merged: ReportMap = { ...incoming, ...current };
        await this.reports.replaceAll(placeId, merged);
        summary.places += 1;
      }
    }

    return summary;
  }

  /** Validates enough of an unknown blob to give a useful error before importing. */
  static parse(text: string): BackupBundle {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('That file is not valid JSON');
    }
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('That file does not look like a Roblox Companion backup');
    }
    const bundle = parsed as BackupBundle;
    if (typeof bundle.schemaVersion !== 'number') {
      throw new Error('That file has no schemaVersion, so it cannot be read safely');
    }
    return bundle;
  }
}
