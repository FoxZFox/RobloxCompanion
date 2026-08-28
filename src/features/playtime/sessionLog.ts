import { formatDuration } from '../../utils/format';
import type { PlaySession } from './playtime';
import { sessionDuration, SESSION_IDLE_TIMEOUT_MS } from './playtime';

/**
 * One visit to one server: which game, which instance, how long, and how old the server
 * already was.
 *
 * The per-experience totals answer "how much time goes into this game". This answers a
 * different question - "what did I actually do, server by server" - and it is the record
 * that lets a flag written afterwards be tied to a specific visit.
 */
export interface SessionLogEntry {
  placeId: string;
  jobId: string;
  gameName?: string;
  joinedAt: number;
  /** Time since the join, clamped the same way the totals are. */
  durationMs: number;
  /** True while this is the session still running. */
  open: boolean;
  /**
   * How long the server had already been alive when the join happened.
   *
   * Measured from the earliest sighting **we** made, because Roblox publishes no server
   * start time - so this is a floor, never the real uptime, and null whenever the join
   * was our first sighting. Both cases are rendered in words rather than as a number
   * that would read like a measurement (see `describeServerAge`).
   */
  serverSeenBeforeMs: number | null;
  /** True when Roblox's presence, not a guess of ours, told us the session was over. */
  confirmedEnd: boolean;
  /** True when the session was opened by presence rather than by our own Join button. */
  detected: boolean;
}

/**
 * Newest first, capped: the log is for looking back over the last session or two, and an
 * unbounded list would put hundreds of rows into every AppState snapshot.
 */
export function buildSessionLog(
  sessions: readonly PlaySession[],
  now: number,
  limit = 30,
  idleTimeoutMs = SESSION_IDLE_TIMEOUT_MS,
): SessionLogEntry[] {
  return sessions
    .slice(0, limit)
    .map((session) => toEntry(session, now, idleTimeoutMs))
    .sort((a, b) => b.joinedAt - a.joinedAt);
}

function toEntry(
  session: PlaySession,
  now: number,
  idleTimeoutMs: number,
): SessionLogEntry {
  const before =
    session.serverFirstSeenAt !== undefined && session.serverFirstSeenAt < session.startedAt
      ? session.startedAt - session.serverFirstSeenAt
      : null;

  const entry: SessionLogEntry = {
    placeId: session.placeId,
    jobId: session.jobId,
    joinedAt: session.startedAt,
    durationMs: sessionDuration(session, now, idleTimeoutMs),
    open: session.endedAt === undefined,
    serverSeenBeforeMs: before,
    confirmedEnd: session.endedBy === 'presence',
    detected: session.startedBy === 'presence',
  };
  if (session.gameName) entry.gameName = session.gameName;
  return entry;
}

/**
 * How much the duration on this row can be trusted, in one line.
 *
 * Three genuinely different figures end up in the same column, and a reader cannot tell
 * them apart from the number alone:
 *
 *   - a session Roblox confirmed the end of is a measurement, give or take a poll
 *   - a session still running and being confirmed is live, and correct right now
 *   - a session we only ever saw start is an upper bound - the user may have stopped
 *     playing an hour before anything closed it
 */
export function describeDuration(entry: SessionLogEntry): string {
  if (entry.open) {
    return entry.detected
      ? 'Running now — Roblox confirms you are still in this server.'
      : 'Running since you joined. Nothing tells us when you leave, so it will keep counting.';
  }
  if (entry.confirmedEnd) {
    return 'Roblox confirmed when you left, so this is measured — to about a minute.';
  }
  return 'Counted from the join until something else closed it, so this is an upper bound.';
}

/**
 * The server's age, in the only words that are true.
 *
 * Roblox's server list carries no start time, no uptime and no version - the fields
 * simply are not there (see docs/02_ROBLOX_API_MAP.md section 1). Everything this project can
 * say about a server's age comes from its own sightings, so the wording is "at least",
 * and a server we had never seen before the join gets a plain "not known" rather than a
 * zero that would read as "brand new".
 */
export function describeServerAge(entry: SessionLogEntry): string {
  if (entry.serverSeenBeforeMs === null) {
    return 'Server age when you joined: not known — we had not seen this server before.';
  }
  return `Server had been running at least ${formatDuration(entry.serverSeenBeforeMs)} when you joined.`;
}

/** How many of the listed visits are to the same server, for the "again" case. */
export function visitsTo(entries: readonly SessionLogEntry[], jobId: string): number {
  return entries.filter((entry) => entry.jobId === jobId).length;
}
