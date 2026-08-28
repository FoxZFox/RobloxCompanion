import type { MutualFriends } from '../features/profiles/mutualFriends';

/**
 * The profile being looked at (phase 8).
 *
 * Only ever about a profile the user has navigated to themselves: nothing here searches
 * for people, and nothing is stored between sessions. Somebody else's friend list is
 * their data, and this reads it to answer one question the user asked, then forgets it.
 */
export interface ProfileState {
  /** The profile currently open, or null when the user is not on one. */
  userId: string | null;
  mutual: MutualFriends | null;
  /** Set when access to friends.roblox.com has not been granted. */
  needsPermission: boolean;
  checkedAt: number | null;
}

export const EMPTY_PROFILE: ProfileState = {
  userId: null,
  mutual: null,
  needsPermission: false,
  checkedAt: null,
};
