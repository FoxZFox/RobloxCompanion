/**
 * Where blacklisted players are, for the few Roblox is willing to say anything about
 * (phase 5).
 *
 * Verified 28 Aug 2026: `presence/users` answers with `userPresenceType`, `lastLocation`,
 * and - only when the target's own privacy settings allow it - `placeId`, `universeId`
 * and `gameId`, which is the job id of the server they are in.
 *
 * That last clause is the whole design constraint. For most people the location fields
 * come back null, so this produces an answer for a minority and must say so. A feature
 * that quietly reported "not in this server" for someone whose location Roblox refused to
 * disclose would be the single most dangerous thing this extension could do: the user
 * would join believing it had been checked.
 */

export type PresenceKind = 'offline' | 'website' | 'in-game' | 'in-studio' | 'unknown';

export interface PlayerPresence {
  userId: number;
  kind: PresenceKind;
  /** Roblox's own words for where they are, when it says. */
  lastLocation: string | null;
  /** The experience they are in, when disclosed. */
  placeId: string | null;
  /** The exact server, when disclosed. This is what makes a server-level answer possible. */
  jobId: string | null;
}

/** Roblox's numeric enum, mapped once so nothing downstream carries a magic number. */
const KINDS: Record<number, PresenceKind> = {
  0: 'offline',
  1: 'website',
  2: 'in-game',
  3: 'in-studio',
};

export interface RawPresence {
  userId?: number;
  userPresenceType?: number;
  lastLocation?: string | null;
  placeId?: number | string | null;
  rootPlaceId?: number | string | null;
  gameId?: string | null;
}

export function parsePresence(raw: RawPresence): PlayerPresence | null {
  if (typeof raw.userId !== 'number') return null;

  const place = raw.placeId ?? raw.rootPlaceId;
  return {
    userId: raw.userId,
    // An unrecognised code is `unknown`, not `offline`: a new enum value must not be
    // silently reported as "not playing".
    kind: KINDS[raw.userPresenceType ?? -1] ?? 'unknown',
    lastLocation: raw.lastLocation?.trim() || null,
    placeId: place === undefined || place === null ? null : String(place),
    jobId: raw.gameId ?? null,
  };
}

export interface PresenceSummary {
  /** Everything Roblox answered for, in the order asked. */
  players: PlayerPresence[];
  /** How many of them disclosed a server. The honest denominator for any claim. */
  located: number;
  /** How many were asked about in total. */
  asked: number;
}

export function summarisePresence(players: PlayerPresence[], asked: number): PresenceSummary {
  return {
    players,
    located: players.filter((player) => player.jobId !== null).length,
    asked,
  };
}

/**
 * Which blacklisted players are confirmed in a given server.
 *
 * Confirmed is the only word that fits: this returns the ones Roblox positively placed
 * there. An empty result never means the server is clear - it means nobody was placed
 * there *by a disclosure we received*, which is a different statement and is why the
 * caller still reports `unknown` rather than `none-detected` whenever anyone was
 * undeterminable.
 */
export function detectedIn(jobId: string, players: readonly PlayerPresence[]): number[] {
  return players.filter((player) => player.jobId === jobId).map((player) => player.userId);
}

/**
 * How many of the people asked about told us nothing useful about their location.
 *
 * Counted rather than assumed: it is the number the UI shows next to any verdict, and
 * the reason a verdict can be `unknown` even when nobody was found.
 */
export function undeterminable(summary: PresenceSummary): number {
  return summary.asked - summary.located;
}

export function describePresence(summary: PresenceSummary): string {
  if (summary.asked === 0) return 'Nobody on your blacklist to check.';
  if (summary.located === 0) {
    return `Checked ${summary.asked}. Roblox disclosed a location for none of them — that is its privacy default, not an all-clear.`;
  }
  return `Checked ${summary.asked}. Roblox disclosed a server for ${summary.located}; the other ${undeterminable(summary)} could be anywhere.`;
}
