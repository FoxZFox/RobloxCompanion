/**
 * Mutual friends (phase 8), unblocked by the 28 Aug 2026 probe.
 *
 * The intersection itself is trivial; what is not trivial is being honest about the
 * cases where there is no answer. Roblox lets people hide their friends list, and a
 * hidden list is not an empty one - reporting "0 mutual friends" for someone whose list
 * we were refused would be inventing a fact out of a refusal.
 */

export type MutualVerdict =
  /** Both lists were readable and compared. */
  | 'compared'
  /** Roblox would not disclose the other person's friends. */
  | 'their-list-private'
  /** Our own list could not be read, so there was nothing to compare against. */
  | 'own-list-unavailable';

export interface MutualFriends {
  verdict: MutualVerdict;
  /** Only meaningful when the verdict is `compared`. */
  count: number;
  /** How many friends each side had, for a caveat the count alone cannot carry. */
  theirTotal: number | null;
  ownTotal: number | null;
}

/**
 * Intersects two friend lists by user id.
 *
 * By id rather than by name deliberately: the friends endpoint returns blank `name` and
 * `displayName` fields (verified 28 Aug 2026), so a name-based comparison would match
 * everyone with everyone.
 */
export function intersectFriends(
  ownIds: readonly number[] | null,
  theirIds: readonly number[] | null,
): MutualFriends {
  if (ownIds === null) {
    return { verdict: 'own-list-unavailable', count: 0, theirTotal: theirIds?.length ?? null, ownTotal: null };
  }
  if (theirIds === null) {
    return { verdict: 'their-list-private', count: 0, theirTotal: null, ownTotal: ownIds.length };
  }

  const own = new Set(ownIds);
  let count = 0;
  const seen = new Set<number>();
  for (const id of theirIds) {
    // Guarding against a duplicate in Roblox's own list, which would otherwise count twice.
    if (seen.has(id)) continue;
    seen.add(id);
    if (own.has(id)) count += 1;
  }

  return { verdict: 'compared', count, theirTotal: theirIds.length, ownTotal: ownIds.length };
}

/**
 * The sentence the UI shows, written here so the wording cannot drift from the verdict.
 *
 * "No mutual friends" and "we could not check" have to read differently, because the
 * user acts on them differently.
 */
export function describeMutual(result: MutualFriends): string {
  switch (result.verdict) {
    case 'their-list-private':
      return 'Roblox does not disclose this person’s friends, so there is nothing to compare.';
    case 'own-list-unavailable':
      return 'Your own friends list could not be read, so no comparison was possible.';
    case 'compared':
      if (result.count === 0) return 'No friends in common.';
      return `${result.count} friend${result.count === 1 ? '' : 's'} in common.`;
  }
}
