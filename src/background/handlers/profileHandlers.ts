import { intersectFriends } from '../../features/profiles/mutualFriends';
import { EMPTY_PROFILE, type ProfileState } from '../../models/profile';
import { OPTIONAL_ORIGINS } from '../../services/roblox/endpoints';
import type { AppContext } from '../context';

/**
 * Mutual friends for the profile the user is looking at (phase 8).
 *
 * On request only. This reads another person's friend list, so it happens when the user
 * asks about that person and at no other time - never on a timer, never as part of
 * building app state, and never for anyone whose profile they have not opened.
 */
export async function checkMutual(context: AppContext, userId: string): Promise<void> {
  const target = Number(userId);
  if (!Number.isFinite(target)) {
    context.profileState = EMPTY_PROFILE;
    return;
  }

  /*
   * friends.roblox.com is behind an optional permission, and a fetch without it fails as
   * a bare network error - which would read as "Roblox refused", the wrong conclusion.
   * Checking first turns that into an answerable prompt.
   */
  const granted = await hasFriendsAccess();
  if (!granted) {
    context.profileState = { ...EMPTY_PROFILE, userId, needsPermission: true };
    return;
  }

  const self = await context.friends.self();
  const [ownIds, theirIds] = await Promise.all([
    self === null ? Promise.resolve(null) : context.friends.friendIds(self),
    context.friends.friendIds(target),
  ]);

  const state: ProfileState = {
    userId,
    mutual: intersectFriends(ownIds, theirIds),
    needsPermission: false,
    checkedAt: Date.now(),
  };
  context.profileState = state;
}

async function hasFriendsAccess(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: [OPTIONAL_ORIGINS.friends] });
  } catch {
    return false;
  }
}
