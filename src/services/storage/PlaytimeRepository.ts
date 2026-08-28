import { STORAGE_KEYS } from '../../config/constants';
import type { PlaySession } from '../../features/playtime/playtime';
import { closeSession, isStale, staleEndFor } from '../../features/playtime/playtime';
import { BaseRepository } from './storageArea';

/** Keeps storage bounded; older sessions are summarised away rather than kept forever. */
const MAX_SESSIONS = 500;

/**
 * Play sessions, opened when the user joins a server through us.
 *
 * At most one session is ever open. Joining again closes the previous one, which is the
 * only end-of-session signal Roblox gives us - there is no "stopped playing" event to
 * listen for.
 */
export class PlaytimeRepository extends BaseRepository {
  private cache: PlaySession[] | null = null;

  async list(): Promise<PlaySession[]> {
    if (this.cache) return this.cache;
    this.cache = (await this.readRaw<PlaySession[]>(STORAGE_KEYS.playtime)) ?? [];
    return this.cache;
  }

  /**
   * Starts a session, closing whatever was open.
   *
   * A session left open past the idle timeout is closed at its timeout rather than at
   * now: the user stopped playing at some unknown point, and crediting them the whole
   * gap would turn a closed laptop into hours of playtime.
   */
  async startSession(session: Omit<PlaySession, 'startedAt'>, now = Date.now()): Promise<void> {
    const sessions = await this.list();
    const open = sessions.find((entry) => entry.endedAt === undefined);

    if (open) {
      const stale = isStale(open, now);
      Object.assign(open, closeSession(open, stale ? staleEndFor(open) : now), {
        // What ended it is what started this one: a launch through us, or Roblox telling
        // us the user had moved. Only the second is an end anybody observed.
        endedBy: stale ? 'stale' : (session.startedBy ?? 'join'),
      });
    }

    const next: PlaySession = { ...session, startedAt: now };
    sessions.unshift(next);
    await this.persist(sessions.slice(0, MAX_SESSIONS));
  }

  /**
   * Closes the open session, recording what closed it.
   *
   * `presence` is the only value that means the end was seen rather than assumed, and the
   * visit log words the duration differently because of it.
   */
  async endSession(now = Date.now(), endedBy: PlaySession['endedBy'] = 'stop'): Promise<void> {
    const sessions = await this.list();
    const open = sessions.find((entry) => entry.endedAt === undefined);
    if (!open) return;
    Object.assign(open, closeSession(open, now), { endedBy });
    await this.persist(sessions);
  }

  /**
   * Records that the open session was still running at `now`.
   *
   * Written through rather than kept in memory: the service worker sleeps between polls,
   * and a confirmation that did not survive that would leave every session looking
   * abandoned at the 45-minute mark again.
   */
  async confirmOpen(now = Date.now()): Promise<boolean> {
    const sessions = await this.list();
    const open = sessions.find((entry) => entry.endedAt === undefined);
    if (!open) return false;
    open.confirmedAt = now;
    await this.persist(sessions);
    return true;
  }

  async openSession(): Promise<PlaySession | null> {
    return (await this.list()).find((entry) => entry.endedAt === undefined) ?? null;
  }

  /** Called from the maintenance alarm so a forgotten session cannot accrue forever. */
  async closeStale(now = Date.now()): Promise<boolean> {
    const sessions = await this.list();
    const open = sessions.find((entry) => entry.endedAt === undefined);
    if (!open || !isStale(open, now)) return false;
    Object.assign(open, closeSession(open, staleEndFor(open)), { endedBy: 'stale' });
    await this.persist(sessions);
    return true;
  }

  async clear(): Promise<void> {
    await this.persist([]);
  }

  private async persist(sessions: PlaySession[]): Promise<void> {
    this.cache = sessions;
    await this.writeRaw(STORAGE_KEYS.playtime, sessions);
  }
}
