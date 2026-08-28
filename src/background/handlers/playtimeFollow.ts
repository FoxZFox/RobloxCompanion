import {
  PRESENCE_POLL_ACTIVE_MINUTES,
  PRESENCE_POLL_IDLE_MINUTES,
} from '../../config/constants';
import { decideFollow, nextPollMinutes, type FollowAction } from '../../features/playtime/presenceFollow';
import { OPTIONAL_ORIGINS } from '../../services/roblox/endpoints';
import type { AppContext } from '../context';

/**
 * Tracks sessions that begin outside the extension, by asking Roblox where this account
 * is (spec section 23).
 *
 * Everything before this could only see the moment the user pressed our Join button. Join
 * from Roblox's own page and nothing was recorded; leave a game and the session ran on
 * until something else closed it. Presence answers both, for the signed-in user, on an
 * endpoint verified live on 28 Aug 2026 - `gameId` comes back for one's own account, so
 * it identifies the exact server, not merely the experience.
 *
 * Four things keep this from being a background tracker nobody asked for:
 *
 *   1. it is off until switched on, and the switch says what it does;
 *   2. it reads the signed-in account and no one else - §13's rule against polling other
 *      people's locations is untouched, because this asks about you;
 *   3. it needs the presence host, an optional permission not requested at install;
 *   4. it asks once a minute while something is running and once every five when nothing
 *      is, so an idle browser is not paying for a feature it is not using.
 */
export async function followPresence(context: AppContext): Promise<number> {
  const settings = await context.settings.get();
  if (!settings.features.playtime || !settings.playtime.followPresence) {
    context.lastPresenceFollow = null;
    return PRESENCE_POLL_IDLE_MINUTES;
  }

  /*
   * Every way of doing nothing says which one it was. A tracker that has been switched on
   * but cannot run - no permission, signed out - is indistinguishable from one that is
   * working and has nothing to report, unless it says so.
   */
  if (!(await hasPresenceAccess())) {
    return record(context, 'Access to presence.roblox.com has not been granted yet.');
  }

  const selfId = await context.friends.self();
  if (selfId === null) {
    return record(context, 'Roblox did not say who is signed in — are you logged out?');
  }

  const open = await context.playtime.openSession();

  let action: FollowAction;
  try {
    const [presence] = await context.presence.lookup([selfId]);
    action = decideFollow(presence ?? null, open);
  } catch {
    // A failed lookup is not evidence of anything. Leaving the session exactly as it was
    // is the only answer that cannot invent a fact.
    action = { kind: 'none', reason: 'Presence lookup failed; nothing changed.' };
  }

  await apply(context, action);
  context.lastPresenceFollow = { at: Date.now(), action: action.kind, reason: action.reason };

  return nextPollMinutes(action, PRESENCE_POLL_ACTIVE_MINUTES, PRESENCE_POLL_IDLE_MINUTES);
}

async function apply(context: AppContext, action: FollowAction): Promise<void> {
  switch (action.kind) {
    case 'start':
      await context.playtime.startSession({
        placeId: action.placeId,
        jobId: action.jobId,
        // Roblox's own words for where the user is. Using them saves resolving the name
        // ourselves, which would be two more requests every time a session starts.
        ...(action.gameName ? { gameName: action.gameName } : {}),
        startedBy: 'presence',
        // Confirmed at the same instant it started: it is running now, we just saw it.
        confirmedAt: Date.now(),
      });
      return;
    case 'confirm':
      await context.playtime.confirmOpen();
      return;
    case 'end':
      await context.playtime.endSession(Date.now(), 'presence');
      return;
    case 'none':
      return;
  }
}

/** Records a reason for doing nothing, and asks to be called again at the idle rate. */
function record(context: AppContext, reason: string): number {
  context.lastPresenceFollow = { at: Date.now(), action: 'none', reason };
  return PRESENCE_POLL_IDLE_MINUTES;
}

async function hasPresenceAccess(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: [OPTIONAL_ORIGINS.presence] });
  } catch {
    return false;
  }
}
