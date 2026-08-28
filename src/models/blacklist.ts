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
 * The public server list does return opaque `playerTokens`, but turning one into a user id
 * means fingerprinting the avatar thumbnail it renders, which section 13 forbids; and the
 * presence API reveals a user's `gameId` only when that user's own privacy settings allow
 * it. So for most players we either cannot tell where they are, or have decided not to.
 */
export type MembershipVerdict = 'unknown' | 'none-detected' | 'detected';

export interface BlacklistCheck {
  verdict: MembershipVerdict;
  /** Only ever populated for players Roblox actually disclosed. */
  detected: number[];
  /** How many blacklisted players we could not determine anything about. */
  undeterminable: number;
}
