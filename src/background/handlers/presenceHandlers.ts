import { summarisePresence } from '../../features/playerBlacklist/presence';
import { OPTIONAL_ORIGINS } from '../../services/roblox/endpoints';
import { AppError } from '../../utils/errors';
import type { AppContext } from '../context';

/**
 * Looks up where blacklisted players are (phase 5).
 *
 * Three gates, all deliberate. The feature is opt-in in Settings because it queries third
 * parties; the host needs an optional permission for the same reason; and it runs only
 * when asked, never on a schedule, because a background poll of other people's locations
 * is surveillance whatever it is called.
 */
export async function check(context: AppContext): Promise<void> {
  const settings = await context.settings.get();
  if (!settings.privacy.allowPresenceChecks) throw new AppError('PRESENCE_DISABLED');

  const granted = await hasPresenceAccess();
  if (!granted) throw new AppError('PRESENCE_NO_PERMISSION');

  const players = await context.blacklist.list();
  const ids = players.map((player) => player.userId);
  const presences = await context.presence.lookup(ids);

  context.presenceSummary = summarisePresence(presences, ids.length);
}

async function hasPresenceAccess(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: [OPTIONAL_ORIGINS.presence] });
  } catch {
    return false;
  }
}
