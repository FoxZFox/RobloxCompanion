import type { BlacklistCheck } from '../../models/blacklist';
import type { RawServer } from '../../services/roblox/serversApi';

/**
 * Answers "is a blacklisted player in this server?" - and, almost always, refuses to.
 *
 * This is the honest implementation of spec section 13. Two facts make a real answer
 * impossible for the vast majority of players:
 *
 *   1. `playerTokens` on the public server list comes back empty. It once carried opaque
 *      tokens; today there is nothing there to work with at all.
 *   2. The presence API only reveals a user's `gameId` when that user's own privacy
 *      settings permit it. For everyone else the field is null by design.
 *
 * So the default verdict is `unknown`, and `unknown` must never be rendered as "safe".
 * A user who sees a green tick will walk into a server believing it was checked.
 *
 * What we explicitly do NOT do, and must never add: decoding or reversing player tokens,
 * brute-forcing avatar thumbnails, fingerprinting renders, or scraping protected
 * membership data. If Roblox does not disclose it, the answer is "unknown".
 */
export function checkServerMembership(
  server: Pick<RawServer, 'id'> & { playerTokens?: unknown },
  blacklistedIds: readonly number[],
): BlacklistCheck {
  if (blacklistedIds.length === 0) {
    // Nothing to look for, so there is genuinely nothing unknown.
    return { verdict: 'none-detected', detected: [], undeterminable: 0 };
  }

  const tokens = Array.isArray(server.playerTokens) ? server.playerTokens : [];

  // Retained as a tripwire rather than as working code: if Roblox ever repopulates this
  // array, this branch is where a *disclosed* identity source would be handled. Tokens
  // are not identities, so even then they would not resolve to user ids on their own.
  if (tokens.length === 0) {
    return {
      verdict: 'unknown',
      detected: [],
      undeterminable: blacklistedIds.length,
    };
  }

  return {
    verdict: 'unknown',
    detected: [],
    undeterminable: blacklistedIds.length,
  };
}

/**
 * The label the UI must show. Kept next to the logic so the two cannot drift apart -
 * the phrasing is the feature here, not decoration.
 */
export function describeCheck(check: BlacklistCheck): string {
  switch (check.verdict) {
    case 'detected':
      return `${check.detected.length} blacklisted player(s) detected`;
    case 'none-detected':
      return check.undeterminable > 0
        ? `No blacklisted player detected (${check.undeterminable} unverifiable)`
        : 'No known blacklisted player';
    case 'unknown':
    default:
      // Never "safe": we did not check anything, because Roblox did not tell us.
      return 'Player identities unavailable';
  }
}
