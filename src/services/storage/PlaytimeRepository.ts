import { STORAGE_KEYS } from '../../config/constants';
import type { PlaySession } from '../../features/playtime/playtime';
import { closeSession, isStale, SESSION_IDLE_TIMEOUT_MS } from '../../features/playtime/playtime';
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
      const endedAt = isStale(open, now) ? open.startedAt + SESSION_IDLE_TIMEOUT_MS : now;
      Object.assign(open, closeSession(open, endedAt));
    }

    const next: PlaySession = { ...session, startedAt: now };
    sessions.unshift(next);
    await this.persist(sessions.slice(0, MAX_SESSIONS));
  }

  /** Explicit stop, from the user pressing "stop tracking". */
  async endSession(now = Date.now()): Promise<void> {
    const sessions = await this.list();
    const open = sessions.find((entry) => entry.endedAt === undefined);
    if (!open) return;
    Object.assign(open, closeSession(open, now));
    await this.persist(sessions);
  }

  async openSession(): Promise<PlaySession | null> {
    return (await this.list()).find((entry) => entry.endedAt === undefined) ?? null;
  }

  /** Called from the maintenance alarm so a forgotten session cannot accrue forever. */
  async closeStale(now = Date.now()): Promise<boolean> {
    const sessions = await this.list();
    const open = sessions.find((entry) => entry.endedAt === undefined);
    if (!open || !isStale(open, now)) return false;
    Object.assign(open, closeSession(open, open.startedAt + SESSION_IDLE_TIMEOUT_MS));
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
