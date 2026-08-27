export type BlacklistReason = 'exploit' | 'bot' | 'toxic' | 'other';

export const BLACKLIST_REASONS: readonly BlacklistReason[] = ['exploit', 'bot', 'toxic', 'other'];

export const REASON_LABEL: Record<BlacklistReason, string> = {
  exploit: 'Exploit',
  bot: 'Bot',
  toxic: 'Toxic',
  other: 'Other',
};

/**
 * Keyed by userId, never by username: Roblox lets people change their username, and a
 * blacklist that forgets who someone is the moment they rename is worse than useless.
 */
export interface BlacklistedPlayer {
  userId: number;
  usernameAtReport: string;
  displayNameAtReport?: string;
  reason: BlacklistReason;
  addedAt: number;
  encounters: number;
  lastSeenAt?: number;
  notes?: string;
}

export type BlacklistMap = Record<string, BlacklistedPlayer>;

/**
 * Whether any blacklisted player is in a given server.
 *
 * `unknown` is the honest answer almost every time and must never be rendered as "safe".
 * The public server list returns an empty `playerTokens` array, and the presence API only
 * reveals a user's `gameId` when that user's own privacy settings allow it — so for most
 * players Roblox simply does not tell us where they are. See spec section 13.
 */
export type MembershipVerdict = 'unknown' | 'none-detected' | 'detected';

export interface BlacklistCheck {
  verdict: MembershipVerdict;
  /** Only ever populated for players Roblox actually disclosed. */
  detected: number[];
  /** How many blacklisted players we could not determine anything about. */
  undeterminable: number;
}
