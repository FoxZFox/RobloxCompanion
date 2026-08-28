export interface PlaySession {
  placeId: string;
  jobId: string;
  gameName?: string;
  startedAt: number;
  /** Absent while the session is still open. */
  endedAt?: number;
  /**
   * The earliest moment we know this server existed, recorded at the join.
   *
   * Absent whenever the join was our first sighting, which is most of the time - and
   * absent is the honest answer there, not zero. Roblox publishes no server start time,
   * so this is a floor on the server's age and is labelled as one wherever it is shown.
   */
  serverFirstSeenAt?: number;
  /**
   * The last moment Roblox's presence answered that this session was still running.
   *
   * This is the difference between a measurement and a guess. Without it the only end we
   * can infer is "they must have stopped at some point", which is why an open session is
   * capped at the idle timeout. With it, a session confirmed thirty seconds ago is known
   * to be live, and a three-hour game is three hours rather than a truncated 45 minutes.
   */
  confirmedAt?: number;
  /** How the session began: we launched it, or Roblox said the user was already in it. */
  startedBy?: SessionBoundary;
  /** How it ended. Only `presence` means we actually saw it end. */
  endedBy?: SessionBoundary | 'stop' | 'stale';
}

/**
 * Where a session boundary came from.
 *
 * `join` is our own launch - a start we witnessed and an end we only inferred, because
 * the next launch is the first thing that tells us the last one is over. `presence` is
 * Roblox answering about the signed-in user's own account, which is the only source that
 * can say a session ended when it ended.
 */
export type SessionBoundary = 'join' | 'presence';

/**
 * The last moment there was positive evidence a session was still running.
 *
 * Falls back to the start, which is the only evidence an unfollowed session ever has.
 */
export function lastEvidence(session: PlaySession): number {
  return session.confirmedAt ?? session.startedAt;
}

/** When an abandoned session should be recorded as having ended. */
export function staleEndFor(
  session: PlaySession,
  idleTimeoutMs = SESSION_IDLE_TIMEOUT_MS,
): number {
  return lastEvidence(session) + idleTimeoutMs;
}

export interface PlaytimeTotals {
  placeId: string;
  gameName?: string;
  totalMs: number;
  sessions: number;
  lastPlayedAt: number;
}

/**
 * A session left open this long is assumed to have ended when it was last touched.
 *
 * Roblox never tells us the user stopped playing, so an open session would otherwise run
 * forever and report a day of playtime after someone closed their laptop mid-game.
 */
export const SESSION_IDLE_TIMEOUT_MS = 45 * 60 * 1000;

/**
 * Playtime, measured from the only event we can actually observe.
 *
 * IMPORTANT, and reflected in every label: this measures time from pressing Join, not
 * time in the game. Roblox exposes nothing that would let a browser extension see a
 * running game session - no in-game hook, no reliable presence signal for the local user
 * that does not depend on an endpoint we have not verified. So a session opens when the
 * user launches a server through us and closes when they launch another, when they say
 * so, or when it goes stale.
 *
 * That makes these figures an ESTIMATE and an upper bound: alt-tabbing away to do
 * something else still counts. The UI says "since you joined" rather than "played", and
 * that wording is the feature, not a disclaimer bolted on afterwards.
 */
export function closeSession(session: PlaySession, endedAt: number): PlaySession {
  return { ...session, endedAt: Math.max(endedAt, session.startedAt) };
}

/**
 * Duration of a session, never counting past the last evidence it was still running.
 *
 * A closed session is simply its two timestamps. An open one runs to now, but no further
 * than the idle timeout past its last evidence - the start, or the last presence
 * confirmation. That single substitution is what lets a followed session run for hours
 * while an unfollowed one still cannot turn a closed laptop into a day of playtime.
 */
export function sessionDuration(
  session: PlaySession,
  now: number,
  idleTimeoutMs = SESSION_IDLE_TIMEOUT_MS,
): number {
  if (session.endedAt !== undefined) {
    return Math.max(0, session.endedAt - session.startedAt);
  }
  const cap = staleEndFor(session, idleTimeoutMs);
  return Math.max(0, Math.min(now, cap) - session.startedAt);
}

/** True once an open session has gone unconfirmed long enough to be abandoned. */
export function isStale(
  session: PlaySession,
  now: number,
  idleTimeoutMs = SESSION_IDLE_TIMEOUT_MS,
): boolean {
  return session.endedAt === undefined && now - lastEvidence(session) >= idleTimeoutMs;
}

export function summarise(
  sessions: PlaySession[],
  now: number,
  idleTimeoutMs = SESSION_IDLE_TIMEOUT_MS,
): PlaytimeTotals[] {
  const byPlace = new Map<string, PlaytimeTotals>();

  for (const session of sessions) {
    const existing = byPlace.get(session.placeId);
    const duration = sessionDuration(session, now, idleTimeoutMs);
    const touchedAt = session.endedAt ?? session.startedAt;

    if (!existing) {
      const totals: PlaytimeTotals = {
        placeId: session.placeId,
        totalMs: duration,
        sessions: 1,
        lastPlayedAt: touchedAt,
      };
      if (session.gameName) totals.gameName = session.gameName;
      byPlace.set(session.placeId, totals);
      continue;
    }

    existing.totalMs += duration;
    existing.sessions += 1;
    existing.lastPlayedAt = Math.max(existing.lastPlayedAt, touchedAt);
    // A name learned later fills in one recorded before the experience resolved.
    if (!existing.gameName && session.gameName) existing.gameName = session.gameName;
  }

  return [...byPlace.values()].sort((a, b) => b.totalMs - a.totalMs);
}

/** Total across every experience, for the dashboard's headline figure. */
export function totalMs(sessions: PlaySession[], now: number): number {
  return sessions.reduce((sum, session) => sum + sessionDuration(session, now), 0);
}

export function sessionsSince(sessions: PlaySession[], since: number): PlaySession[] {
  return sessions.filter((session) => (session.endedAt ?? session.startedAt) >= since);
}

/** Midnight local time, so "today" means what the user means by it. */
export function startOfDay(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
