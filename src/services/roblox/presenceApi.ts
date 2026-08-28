import { parsePresence, type PlayerPresence, type RawPresence } from '../../features/playerBlacklist/presence';
import { presenceUrl } from './endpoints';
import type { RobloxHttpClient } from './RobloxHttpClient';

/**
 * Presence lookups (phase 5), verified live on 28 Aug 2026.
 *
 * Batched into one request on purpose: this is other people's data and the extension asks
 * about it as rarely as it can, in one call, only when the user presses the button.
 */
export class PresenceApi {
  /** Roblox's own documented ceiling for this endpoint. */
  private static readonly MAX_PER_CALL = 100;

  constructor(private readonly http: RobloxHttpClient) {}

  async lookup(userIds: readonly number[]): Promise<PlayerPresence[]> {
    if (userIds.length === 0) return [];

    const results: PlayerPresence[] = [];
    for (let i = 0; i < userIds.length; i += PresenceApi.MAX_PER_CALL) {
      const batch = userIds.slice(i, i + PresenceApi.MAX_PER_CALL);
      const body = await this.http.postJson<{ userPresences?: RawPresence[] }>(presenceUrl(), {
        userIds: batch,
      });
      for (const raw of body.userPresences ?? []) {
        const parsed = parsePresence(raw);
        if (parsed) results.push(parsed);
      }
    }
    return results;
  }
}
