import type { BlacklistReason, BlacklistedPlayer } from '../../models/blacklist';
import type { AppContext } from '../context';

/**
 * Adds a player by username, storing them by user id.
 *
 * The resolution step is the whole point: usernames are mutable on Roblox, so a list
 * keyed by name would quietly stop matching the moment someone renames. Resolving up
 * front also means a typo fails loudly here rather than silently never matching.
 */
export async function add(
  context: AppContext,
  username: string,
  reason: BlacklistReason,
  notes?: string,
): Promise<BlacklistedPlayer> {
  const user = await context.users.resolveUsername(username);
  return context.blacklist.add({
    userId: user.userId,
    username: user.username,
    reason,
    ...(user.displayName ? { displayName: user.displayName } : {}),
    ...(notes ? { notes } : {}),
  });
}

export async function remove(context: AppContext, userId: number): Promise<void> {
  await context.blacklist.remove(userId);
}

export async function update(
  context: AppContext,
  userId: number,
  patch: Partial<BlacklistedPlayer>,
): Promise<void> {
  await context.blacklist.update(userId, patch);
}
