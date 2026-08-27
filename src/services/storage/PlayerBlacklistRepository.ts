import { STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from '../../config/constants';
import type { BlacklistMap, BlacklistReason, BlacklistedPlayer } from '../../models/blacklist';
import { BaseRepository } from './storageArea';

export interface BlacklistExport {
  schemaVersion: number;
  players: BlacklistedPlayer[];
}

/**
 * Local-only list of players to avoid (spec sections 12 and 35).
 *
 * Keyed by userId, never username, because Roblox lets people rename. Nothing here is
 * ever uploaded anywhere: this file writes to chrome.storage.local and nothing else.
 */
export class PlayerBlacklistRepository extends BaseRepository {
  private cache: BlacklistMap | null = null;

  async getAll(): Promise<BlacklistMap> {
    if (this.cache) return this.cache;
    this.cache = (await this.readRaw<BlacklistMap>(STORAGE_KEYS.blacklist)) ?? {};
    return this.cache;
  }

  async list(): Promise<BlacklistedPlayer[]> {
    const all = await this.getAll();
    return Object.values(all).sort((a, b) => b.addedAt - a.addedAt);
  }

  async has(userId: number): Promise<boolean> {
    return Boolean((await this.getAll())[String(userId)]);
  }

  async add(player: {
    userId: number;
    username: string;
    displayName?: string;
    reason: BlacklistReason;
    notes?: string;
  }): Promise<BlacklistedPlayer> {
    const all = await this.getAll();
    const key = String(player.userId);
    const existing = all[key];

    // Re-adding someone already listed is a second encounter, not a duplicate entry.
    const next: BlacklistedPlayer = existing
      ? { ...existing, encounters: existing.encounters + 1, lastSeenAt: Date.now() }
      : {
          userId: player.userId,
          usernameAtReport: player.username,
          reason: player.reason,
          addedAt: Date.now(),
          encounters: 1,
        };

    if (player.displayName) next.displayNameAtReport = player.displayName;
    if (player.notes?.trim()) next.notes = player.notes.trim();

    all[key] = next;
    await this.persist(all);
    return next;
  }

  async update(userId: number, patch: Partial<BlacklistedPlayer>): Promise<void> {
    const all = await this.getAll();
    const key = String(userId);
    const existing = all[key];
    if (!existing) return;
    all[key] = { ...existing, ...patch, userId };
    await this.persist(all);
  }

  async remove(userId: number): Promise<void> {
    const all = await this.getAll();
    delete all[String(userId)];
    await this.persist(all);
  }

  async recordEncounter(userId: number): Promise<void> {
    const all = await this.getAll();
    const existing = all[String(userId)];
    if (!existing) return;
    existing.encounters += 1;
    existing.lastSeenAt = Date.now();
    await this.persist(all);
  }

  async exportPlayers(): Promise<BlacklistExport> {
    return { schemaVersion: STORAGE_SCHEMA_VERSION, players: await this.list() };
  }

  /** Merges rather than replaces, so importing a friend's list never deletes your own. */
  async importPlayers(payload: BlacklistExport): Promise<number> {
    if (payload.schemaVersion !== STORAGE_SCHEMA_VERSION) {
      throw new Error(`Unsupported blacklist schema: ${payload.schemaVersion}`);
    }
    const all = await this.getAll();
    let added = 0;
    for (const player of payload.players) {
      if (typeof player.userId !== 'number') continue;
      const key = String(player.userId);
      if (!all[key]) added += 1;
      all[key] = { ...player, ...all[key] };
    }
    await this.persist(all);
    return added;
  }

  private async persist(all: BlacklistMap): Promise<void> {
    this.cache = all;
    await this.writeRaw(STORAGE_KEYS.blacklist, all);
  }
}
