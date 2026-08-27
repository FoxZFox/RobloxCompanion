import { STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from '../../config/constants';
import { FEATURES_INTRODUCED_AT } from '../../config/features';
import type { Settings, SettingsPatch } from '../../models/settings';
import { DEFAULT_SETTINGS, mergePatch, mergeSettings } from '../../models/settings';
import type { TransportMode } from '../roblox/transport';
import { BaseRepository } from './storageArea';

/**
 * Settings, stored as OVERRIDES rather than as a resolved snapshot.
 *
 * This distinction matters more than it looks. Storing the whole resolved object meant
 * every value the user had ever touched anything near was pinned forever: shipping a
 * feature switched on by default did nothing for existing users, because their storage
 * still held the `false` that was the default when it was written. That is exactly how
 * playtime shipped invisible.
 *
 * Keeping only what the user actually changed means a new default reaches everyone who
 * never expressed an opinion, while a deliberate choice still survives upgrades.
 */
export class SettingsRepository extends BaseRepository {
  private overrides: SettingsPatch | null = null;
  private resolved: Settings | null = null;

  async init(): Promise<void> {
    const stored = (await this.readRaw<number>(STORAGE_KEYS.schemaVersion)) ?? 1;
    if (stored === STORAGE_SCHEMA_VERSION) return;

    await this.migrate(stored);
    await this.writeRaw(STORAGE_KEYS.schemaVersion, STORAGE_SCHEMA_VERSION);
  }

  /**
   * Unpins feature flags the user could not have set at the version they are coming from.
   *
   * v1 stored a fully resolved Settings object, so every field looked like a deliberate
   * choice. Carrying that forward verbatim means a feature shipped switched on by default
   * stays off forever for existing users - which is exactly what happened to playtime.
   *
   * Only the flags introduced between the stored version and the current one are dropped.
   * Everything the user genuinely chose survives.
   */
  private async migrate(from: number): Promise<void> {
    const stored = await this.readRaw<SettingsPatch>(STORAGE_KEYS.settings);
    if (!stored?.features) return;

    const features = { ...stored.features };
    for (const [version, introduced] of Object.entries(FEATURES_INTRODUCED_AT)) {
      if (Number(version) <= from) continue;
      for (const key of introduced) delete features[key];
    }

    await this.writeRaw(STORAGE_KEYS.settings, { ...stored, features });
  }

  async get(): Promise<Settings> {
    if (this.resolved) return this.resolved;
    this.overrides = (await this.readRaw<SettingsPatch>(STORAGE_KEYS.settings)) ?? {};
    this.resolved = mergeSettings(DEFAULT_SETTINGS, this.overrides);
    return this.resolved;
  }

  async set(patch: SettingsPatch): Promise<Settings> {
    await this.get(); // Ensures overrides are loaded before merging into them.
    this.overrides = mergePatch(this.overrides ?? {}, patch);
    this.resolved = mergeSettings(DEFAULT_SETTINGS, this.overrides);
    await this.writeRaw(STORAGE_KEYS.settings, this.overrides);
    return this.resolved;
  }

  async getTransportMode(): Promise<TransportMode> {
    return (await this.readRaw<TransportMode>(STORAGE_KEYS.transportMode)) ?? 'auto';
  }

  async setTransportMode(mode: TransportMode): Promise<void> {
    await this.writeRaw(STORAGE_KEYS.transportMode, mode);
  }

  /** Everything the user can carry to another machine (spec section 37). */
  async exportSettings(): Promise<{ schemaVersion: number; settings: Settings }> {
    return { schemaVersion: STORAGE_SCHEMA_VERSION, settings: await this.get() };
  }
}
