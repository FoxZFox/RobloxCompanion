import type { PlayerPresence } from '../playerBlacklist/presence';
import type { PlaySession } from './playtime';

/**
 * What to do with the play session, given what Roblox says about the signed-in user.
 *
 * Pure, and separated from the polling for the usual reason: this is where every "is that
 * really what that means" decision lives, and those are argued with in a test rather than
 * by playing Roblox for forty minutes.
 *
 * The rule that matters most is what happens when the answer is missing. A failed lookup,
 * an unrecognised presence code, a rate limit - none of them close a session. Closing on
 * silence would truncate a real three-hour session because one request failed, and the
 * user would see a wrong number with no way to tell it was wrong.
 */
export type FollowAction =
  /** Roblox says the user is in a server we are not tracking. */
  | { kind: 'start'; placeId: string; jobId: string; gameName?: string; reason: string }
  /** Same server as the open session: record that it is still running. */
  | { kind: 'confirm'; reason: string }
  /** Roblox says the user is no longer in a game, so the open session ended. */
  | { kind: 'end'; reason: string }
  /** Nothing to do, or nothing dependable enough to act on. */
  | { kind: 'none'; reason: string };

export function decideFollow(
  presence: PlayerPresence | null,
  open: PlaySession | null,
): FollowAction {
  /*
   * No answer at all. Not "they stopped playing" - we did not ask successfully, and the
   * difference between those two is the difference between a measurement and a fabrication.
   */
  if (!presence) {
    return { kind: 'none', reason: 'Roblox did not answer; the session is left as it is.' };
  }

  // An enum value we do not recognise is not a claim that they are offline (§13's rule
  // applied to ourselves: unknown is never treated as a definite state).
  if (presence.kind === 'unknown') {
    return { kind: 'none', reason: 'Roblox reported a state we do not recognise.' };
  }

  if (presence.kind !== 'in-game') {
    if (!open) return { kind: 'none', reason: 'Not in a game, and nothing was running.' };
    return { kind: 'end', reason: 'Roblox says you are no longer in a game.' };
  }

  /*
   * In a game, but Roblox declined to say which. It does that for players whose privacy
   * settings hide their location - including, sometimes, for the account asking. Starting
   * a session for an unnamed place would attribute time to a game we cannot name.
   */
  if (!presence.placeId) {
    if (open) return { kind: 'confirm', reason: 'In a game; Roblox did not name which.' };
    return { kind: 'none', reason: 'In a game, but Roblox did not say which one.' };
  }

  const jobId = presence.jobId ?? '';

  if (open && open.placeId === presence.placeId) {
    /*
     * Same experience. A different job id here means they changed server without going
     * through us, which is a new visit - unless we never knew the old server's id, in
     * which case learning it now is not evidence of a change.
     */
    const sameServer = open.jobId === jobId || open.jobId === '' || jobId === '';
    if (sameServer) return { kind: 'confirm', reason: 'Still in the same server.' };
    return {
      kind: 'start',
      placeId: presence.placeId,
      jobId,
      ...(presence.lastLocation ? { gameName: presence.lastLocation } : {}),
      reason: 'You moved to a different server in the same experience.',
    };
  }

  return {
    kind: 'start',
    placeId: presence.placeId,
    jobId,
    // Roblox's own words for where they are, which saves resolving the name ourselves -
    // and two requests we would otherwise make every time a session starts.
    ...(presence.lastLocation ? { gameName: presence.lastLocation } : {}),
    reason: open ? 'You are in a different experience now.' : 'Roblox says you are in a game.',
  };
}

/** How often to ask next, in minutes: only worth asking often while something is running. */
export function nextPollMinutes(
  action: FollowAction,
  active: number,
  idle: number,
): number {
  return action.kind === 'start' || action.kind === 'confirm' ? active : idle;
}
