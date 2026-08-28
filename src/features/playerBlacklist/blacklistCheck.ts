import type { BlacklistCheck } from '../../models/blacklist';
import type { RawServer } from '../../services/roblox/serversApi';

/**
 * Answers "is a blacklisted player in this server?" - and, almost always, refuses to.
 *
 * This is the honest implementation of spec section 13, and as of 28 Aug 2026 it is a
 * choice rather than a limitation - which is a distinction worth stating plainly.
 *
 * A live probe that day showed `playerTokens` is NOT empty: the public server list
 * returns one opaque token per player. The project documentation had recorded the
 * opposite as a proven fact, and it was wrong.
 *
 * A token is still not an identity. The only way to connect one to a person is to fetch
 * the thumbnail it renders and compare that image against thumbnails of user ids you
 * already suspect - fingerprinting, which section 13 forbids outright. Roblox stopped
 * publishing who is in a public server on purpose; matching images to undo that is
 * reversing a privacy decision, not reading a published one.
 *
 * The other half stands unchanged: presence discloses a user's `gameId` only when that
 * user's own privacy settings allow it.
 *
 * So the verdict stays `unknown`, and `unknown` must never be rendered as "safe" - a user
 * who sees a green tick will walk into a server believing it was checked. What must never
 * be added: decoding or matching player tokens, brute-forcing avatar thumbnails,
 * fingerprinting renders, or scraping protected membership data.
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

  // Both branches answer `unknown`, deliberately. Tokens being present changes nothing:
  // resolving one to a user id needs thumbnail fingerprinting, which section 13 rules
  // out. The split is kept so the count of players we could not identify stays truthful.
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
