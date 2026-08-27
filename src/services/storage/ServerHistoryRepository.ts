import { HISTORY_LIMIT, STORAGE_KEYS } from '../../config/constants';
import type { HistoryEntry } from '../../models/messages';
import type { LiveServer, ServerStatus } from '../../models/server';
import { BaseRepository } from './storageArea';

/**
 * Append-only log of servers the user actually joined (spec section 18).
 *
 * Kept separate from ServerReportRepository because the two answer different questions:
 * reports say "what is this server like", history says "what did I do, and when". A
 * server can be joined five times and carry one report.
 */
export class ServerHistoryRepository extends BaseRepository {
  private readonly cache = new Map<string, HistoryEntry[]>();

  async list(placeId: string): Promise<HistoryEntry[]> {
    const cached = this.cache.get(placeId);
    if (cached) return cached;
    const stored = (await this.readRaw<HistoryEntry[]>(STORAGE_KEYS.history(placeId))) ?? [];
    this.cache.set(placeId, stored);
    return stored;
  }

  async record(placeId: string, server: LiveServer, gameName?: string): Promise<void> {
    const entries = await this.list(placeId);
    const entry: HistoryEntry = {
      placeId,
      jobId: server.jobId,
      status: 'unknown',
      joinedAt: Date.now(),
      playersAtJoin: server.playing,
      maxPlayers: server.maxPlayers,
    };
    if (gameName) entry.gameName = gameName;

    // Newest first, capped: an unbounded log would grow forever in chrome.storage.
    const next = [entry, ...entries].slice(0, HISTORY_LIMIT);
    await this.persist(placeId, next);
  }

  /**
   * Mirrors a status onto the most recent visit to that server, so the history list can
   * show what the verdict was without joining against the report map on every render.
   */
  async applyStatus(placeId: string, jobId: string, status: ServerStatus): Promise<void> {
    const entries = await this.list(placeId);
    const index = entries.findIndex((entry) => entry.jobId === jobId);
    if (index === -1) return;
    const entry = entries[index];
    if (!entry) return;
    entries[index] = { ...entry, status };
    await this.persist(placeId, entries);
  }

  async clear(placeId: string): Promise<void> {
    await this.persist(placeId, []);
  }

  async exportEntries(placeId: string): Promise<HistoryEntry[]> {
    return this.list(placeId);
  }

  private async persist(placeId: string, entries: HistoryEntry[]): Promise<void> {
    this.cache.set(placeId, entries);
    await this.writeRaw(STORAGE_KEYS.history(placeId), entries);
  }
}
