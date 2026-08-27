export interface PlaySession {
  placeId: string;
  jobId: string;
  gameName?: string;
  startedAt: number;
  /** Absent while the session is still open. */
  endedAt?: number;
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

/** Duration of a session, clamped so a stale one cannot report an absurd total. */
export function sessionDuration(
  session: PlaySession,
  now: number,
  idleTimeoutMs = SESSION_IDLE_TIMEOUT_MS,
): number {
  const end = session.endedAt ?? now;
  const elapsed = Math.max(0, end - session.startedAt);
  return session.endedAt === undefined ? Math.min(elapsed, idleTimeoutMs) : elapsed;
}

/** True once an open session has been left untouched long enough to be abandoned. */
export function isStale(
  session: PlaySession,
  now: number,
  idleTimeoutMs = SESSION_IDLE_TIMEOUT_MS,
): boolean {
  return session.endedAt === undefined && now - session.startedAt >= idleTimeoutMs;
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
