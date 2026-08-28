import { authenticatedUserUrl, friendsUrl } from './endpoints';
import type { RobloxHttpClient } from './RobloxHttpClient';

/**
 * Friends and identity (phase 8), both verified live on 28 Aug 2026.
 *
 * `friends/{id}/friends` answers with `data: [{id, name: "", displayName: ""}]` - ids
 * populated, names blank - which is why everything downstream compares by id.
 */
export class FriendsApi {
  /** The signed-in user's id, resolved once: it cannot change mid-session. */
  private selfId: number | null = null;

  constructor(private readonly http: RobloxHttpClient) {}

  async self(): Promise<number | null> {
    if (this.selfId !== null) return this.selfId;
    try {
      const body = await this.http.getJson<{ id?: number }>(authenticatedUserUrl());
      this.selfId = typeof body.id === 'number' ? body.id : null;
    } catch {
      this.selfId = null;
    }
    return this.selfId;
  }

  /**
   * `null` means Roblox would not tell us, which is not the same as an empty list.
   *
   * Someone with their friends hidden and someone with no friends must not produce the
   * same answer, because the honest sentence differs: "nothing in common" versus "there
   * was nothing to compare".
   */
  async friendIds(userId: number): Promise<number[] | null> {
    try {
      const body = await this.http.getJson<{ data?: Array<{ id?: number }> }>(friendsUrl(userId));
      if (!Array.isArray(body.data)) return null;
      return body.data
        .map((friend) => friend.id)
        .filter((id): id is number => typeof id === 'number');
    } catch {
      return null;
    }
  }
}
