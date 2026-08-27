import { AppError } from '../../utils/errors';
import { usernamesToUsersUrl } from './endpoints';
import type { RobloxHttpClient } from './RobloxHttpClient';

export interface ResolvedUser {
  userId: number;
  username: string;
  displayName?: string;
}

interface UsernamesResponse {
  data?: Array<{
    id?: number;
    name?: string;
    displayName?: string;
    requestedUsername?: string;
  }>;
}

/**
 * Resolves usernames to user ids.
 *
 * The blacklist is keyed by user id rather than username on purpose: Roblox lets people
 * rename themselves, and a list that forgets who someone is the moment they rename would
 * quietly stop protecting the user (spec section 12).
 */
export class UsersApi {
  constructor(private readonly http: RobloxHttpClient) {}

  async resolveUsername(username: string): Promise<ResolvedUser> {
    const trimmed = username.trim().replace(/^@/, '');
    if (!trimmed) throw new AppError('USER_NOT_FOUND');

    const [first] = await this.resolveUsernames([trimmed]);
    if (!first) throw new AppError('USER_NOT_FOUND');
    return first;
  }

  async resolveUsernames(usernames: string[]): Promise<ResolvedUser[]> {
    if (usernames.length === 0) return [];

    const response = await this.http.postJson<UsernamesResponse>(usernamesToUsersUrl(), {
      usernames,
      excludeBannedUsers: false,
    });

    return (response.data ?? []).flatMap((entry) => {
      if (typeof entry.id !== 'number' || typeof entry.name !== 'string') return [];
      const user: ResolvedUser = { userId: entry.id, username: entry.name };
      if (entry.displayName) user.displayName = entry.displayName;
      return [user];
    });
  }
}
