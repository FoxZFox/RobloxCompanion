import { PRUNE_AGE_MS, STORAGE_KEYS } from '../../config/constants';
import type { LastJoined, LiveServer, ReportMap, ServerReport, ServerStatus } from '../../models/server';
import { BaseRepository } from './storageArea';

/**
 * The only place that touches stored server reports.
 *
 * Reports are held in memory and written through on change. A user marking a server as
 * having exploiters is written immediately, because losing that one fact is exactly the
 * kind of thing that makes someone stop trusting the tool. The per-scan lastSeenAt sweep
 * writes once at the end rather than once per server.
 */
export class ServerReportRepository extends BaseRepository {
  private readonly cache = new Map<string, ReportMap>();

  async getAll(placeId: string): Promise<ReportMap> {
    const cached = this.cache.get(placeId);
    if (cached) return cached;
    const stored = (await this.readRaw<ReportMap>(STORAGE_KEYS.reports(placeId))) ?? {};
    this.cache.set(placeId, stored);
    return stored;
  }

  async get(placeId: string, jobId: string): Promise<ServerReport | undefined> {
    return (await this.getAll(placeId))[jobId];
  }

  async setStatus(
    placeId: string,
    jobId: string,
    status: ServerStatus,
    context: { playing?: number; maxPlayers?: number } = {},
  ): Promise<ServerReport> {
    const reports = await this.getAll(placeId);
    const now = Date.now();
    const existing = reports[jobId];
    const next: ServerReport = {
      ...(existing ?? { jobId, placeId, status: 'unknown', firstSeenAt: now }),
      jobId,
      placeId,
      status,
    };

    if (status === 'unknown') {
      delete next.reportedAt;
      delete next.playersWhenReported;
    } else {
      next.reportedAt = now;
      const players = context.playing ?? existing?.playersWhenReported;
      if (players !== undefined) next.playersWhenReported = players;
    }
    const maxPlayers = context.maxPlayers ?? existing?.maxPlayers;
    if (maxPlayers !== undefined) next.maxPlayers = maxPlayers;

    reports[jobId] = next;
    await this.persist(placeId, reports);
    return next;
  }

  async setFavorite(placeId: string, jobId: string, favorite: boolean): Promise<ServerReport> {
    const reports = await this.getAll(placeId);
    const now = Date.now();
    const next: ServerReport = reports[jobId] ?? {
      jobId,
      placeId,
      status: 'unknown',
      firstSeenAt: now,
    };
    // Favouriting is orthogonal to reputation, so it never overwrites `status`.
    if (favorite) next.favorite = true;
    else delete next.favorite;
    reports[jobId] = next;
    await this.persist(placeId, reports);
    return next;
  }

  async setNote(placeId: string, jobId: string, note: string): Promise<void> {
    const reports = await this.getAll(placeId);
    const now = Date.now();
    const existing: ServerReport = reports[jobId] ?? {
      jobId,
      placeId,
      status: 'unknown',
      firstSeenAt: now,
    };
    const trimmed = note.trim();
    if (trimmed) existing.note = trimmed;
    else delete existing.note;
    reports[jobId] = existing;
    await this.persist(placeId, reports);
  }

  async reset(placeId: string, jobId: string): Promise<void> {
    const reports = await this.getAll(placeId);
    delete reports[jobId];
    await this.persist(placeId, reports);
  }

  async markJoined(placeId: string, server: LiveServer, gameName?: string): Promise<LastJoined> {
    const reports = await this.getAll(placeId);
    const now = Date.now();
    const existing = reports[server.jobId];
    reports[server.jobId] = {
      ...(existing ?? { jobId: server.jobId, placeId, status: 'unknown', firstSeenAt: now }),
      jobId: server.jobId,
      placeId,
      status: existing?.status ?? 'unknown',
      maxPlayers: server.maxPlayers,
      lastJoinedAt: now,
      lastSeenAt: now,
    };
    await this.persist(placeId, reports);

    const lastJoined: LastJoined = {
      placeId,
      jobId: server.jobId,
      playersAtJoin: server.playing,
      maxPlayers: server.maxPlayers,
      joinedAt: now,
    };
    if (gameName) lastJoined.gameName = gameName;
    if (server.ping !== undefined) lastJoined.ping = server.ping;

    await this.writeRaw(STORAGE_KEYS.lastJoined(placeId), lastJoined);
    return lastJoined;
  }

  async getLastJoined(placeId: string): Promise<LastJoined | null> {
    return (await this.readRaw<LastJoined>(STORAGE_KEYS.lastJoined(placeId))) ?? null;
  }

  /**
   * One write for the whole scan, not one per server.
   *
   * `firstSeenAt` is set here for servers we already track, and it is the closest thing
   * to a server age we can ever have: Roblox exposes no start time, so "how long ago we
   * first saw it" is the honest substitute the UI labels as such.
   */
  async touchSeen(placeId: string, servers: LiveServer[]): Promise<void> {
    if (servers.length === 0) return;
    const reports = await this.getAll(placeId);
    const now = Date.now();
    let changed = false;

    for (const server of servers) {
      const existing = reports[server.jobId];
      // Servers with no report stay unrecorded until the user acts on one, which keeps
      // storage proportional to work done rather than to servers merely seen.
      if (!existing) continue;
      existing.lastSeenAt = now;
      existing.firstSeenAt ??= now;
      existing.maxPlayers = server.maxPlayers;
      if (server.ping !== undefined) existing.ping = server.ping;
      if (server.fps !== undefined) existing.fps = server.fps;
      changed = true;
    }
    if (changed) await this.persist(placeId, reports);
  }

  /**
   * Removes reports the user never acted on that have not been seen for a day.
   * Anything actually flagged is history and is kept indefinitely.
   */
  async pruneStale(placeId: string, now = Date.now()): Promise<number> {
    const reports = await this.getAll(placeId);
    let removed = 0;
    for (const [jobId, report] of Object.entries(reports)) {
      const untouched = report.status === 'unknown' && !report.reportedAt && !report.note && !report.favorite;
      const stale = (report.lastSeenAt ?? report.firstSeenAt ?? 0) < now - PRUNE_AGE_MS;
      if (untouched && stale) {
        delete reports[jobId];
        removed += 1;
      }
    }
    if (removed > 0) await this.persist(placeId, reports);
    return removed;
  }

  /** Applies or removes one of the user's own flags on a server (spec section 22). */
  async toggleCustomFlag(
    placeId: string,
    jobId: string,
    flagId: string,
    applied: boolean,
  ): Promise<ServerReport> {
    const reports = await this.getAll(placeId);
    const now = Date.now();
    const next: ServerReport = reports[jobId] ?? {
      jobId,
      placeId,
      status: 'unknown',
      firstSeenAt: now,
    };

    const current = new Set(next.customFlagIds ?? []);
    if (applied) current.add(flagId);
    else current.delete(flagId);

    if (current.size > 0) next.customFlagIds = [...current];
    else delete next.customFlagIds;

    reports[jobId] = next;
    await this.persist(placeId, reports);
    return next;
  }

  /** Removes a flag from every server that carried it, after the flag is deleted. */
  async purgeCustomFlag(placeId: string, flagId: string): Promise<void> {
    const reports = await this.getAll(placeId);
    let changed = false;
    for (const report of Object.values(reports)) {
      if (!report.customFlagIds?.includes(flagId)) continue;
      const remaining = report.customFlagIds.filter((id) => id !== flagId);
      if (remaining.length > 0) report.customFlagIds = remaining;
      else delete report.customFlagIds;
      changed = true;
    }
    if (changed) await this.persist(placeId, reports);
  }

  /** Used by the importer, which has already merged the two maps. */
  async replaceAll(placeId: string, reports: ReportMap): Promise<void> {
    await this.persist(placeId, reports);
  }

  /** Wipes tracking for a place. Callers must confirm with the user first. */
  async clear(placeId: string): Promise<void> {
    await this.persist(placeId, {});
    await this.removeRaw(STORAGE_KEYS.lastJoined(placeId));
  }

  private async persist(placeId: string, reports: ReportMap): Promise<void> {
    this.cache.set(placeId, reports);
    await this.writeRaw(STORAGE_KEYS.reports(placeId), reports);
  }
}
