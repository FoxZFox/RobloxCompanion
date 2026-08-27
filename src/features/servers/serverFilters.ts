import { isFull, STATUS_META, type ServerView } from '../../models/server';
import type { AvoidSettings, ServerBrowserSettings, SortOrder } from '../../models/settings';

/**
 * Whether the user's avoid rules rule this server out of an automatic join.
 *
 * Deliberately shared between the browser's filters and the join planner: if "skip
 * exploiter servers" hides a server from the list but Join Lowest still walks into it,
 * the setting is a lie. One predicate, both callers.
 *
 * `avoidableFlags` carries the ids of the user's own flags marked "avoid" (spec section
 * 22). A custom flag the user built for their own game is honoured exactly like a
 * built-in status, which is the whole point of letting them define one.
 */
export function isAvoided(
  view: ServerView,
  avoid: AvoidSettings,
  avoidableFlags?: ReadonlySet<string>,
): boolean {
  if (avoidableFlags?.size) {
    for (const flagId of view.customFlagIds) {
      if (avoidableFlags.has(flagId)) return true;
    }
  }

  if (!STATUS_META[view.status].avoidable) return false;
  if (view.status === 'exploiters') return avoid.exploiterServers;
  if (view.status === 'bugged') return avoid.buggedServers;
  if (view.status === 'avoid') return avoid.manuallyAvoided;
  return false;
}

/** Pure, so every combination is unit-testable without a browser (spec section 46). */
export function applyFilters(views: ServerView[], settings: ServerBrowserSettings): ServerView[] {
  return views.filter((view) => {
    if (settings.onlyFavorites && !view.favorite) return false;

    if (settings.onlyStatus !== 'none') {
      if (view.status !== settings.onlyStatus) return false;
    } else if (settings.hideCleanServers && view.status === 'clean') {
      return false;
    }

    if (settings.excludeFull && isFull(view)) return false;

    // 0 means "off" for both, and exact wins when the user set both.
    if (settings.exactPlayerCount > 0) {
      if (view.playing !== settings.exactPlayerCount) return false;
    } else if (settings.maxPlayerCount > 0 && view.playing > settings.maxPlayerCount) {
      return false;
    }

    return true;
  });
}

/**
 * The API already returns the requested order, so this only keeps the list stable when
 * reports are merged in or "Load More" appends a later page.
 */
export function sortViews(views: ServerView[], sort: SortOrder): ServerView[] {
  const direction = sort === 'Asc' ? 1 : -1;
  return [...views].sort((a, b) => {
    const byPlayers = (a.playing - b.playing) * direction;
    if (byPlayers !== 0) return byPlayers;
    return a.jobId.localeCompare(b.jobId);
  });
}

export interface JoinCandidateOptions {
  avoid: AvoidSettings;
  /** Ids of custom flags the user marked "avoid". */
  avoidableFlags?: ReadonlySet<string>;
  /** Job ids already visited this session, deprioritised so the user keeps moving. */
  exclude?: ReadonlySet<string>;
}

/**
 * Servers that Join Lowest / Random are allowed to pick from.
 *
 * Full servers are dropped outright rather than deprioritised: joining one fails, and
 * a button that sometimes does nothing is worse than one that reports "no servers".
 */
export function joinCandidates(
  views: ServerView[],
  options: JoinCandidateOptions,
): ServerView[] {
  return views.filter((view) => {
    if (isFull(view)) return false;
    if (isAvoided(view, options.avoid, options.avoidableFlags)) return false;
    if (options.exclude?.has(view.jobId)) return false;
    return true;
  });
}

/**
 * Picks the emptiest server, breaking ties in the user's favour.
 *
 * Spec section 6 asks for a secondary sort on ping and region. Region does not exist
 * until phase 3, and the API's `ping` is a server-side average rather than the user's
 * latency, so it is used only as a weak tiebreak between servers that are otherwise
 * identical - never as the headline reason for a choice.
 */
export function pickLowest(views: ServerView[], options: JoinCandidateOptions): ServerView | null {
  const candidates = joinCandidates(views, options);
  if (candidates.length === 0) return null;

  return candidates.reduce((best, view) => {
    if (view.playing !== best.playing) return view.playing < best.playing ? view : best;

    // Prefer a server we already know is clean over one we know nothing about.
    const rank = (v: ServerView): number => (v.status === 'clean' ? 0 : 1);
    if (rank(view) !== rank(best)) return rank(view) < rank(best) ? view : best;

    const viewPing = view.ping ?? Number.POSITIVE_INFINITY;
    const bestPing = best.ping ?? Number.POSITIVE_INFINITY;
    return viewPing < bestPing ? view : best;
  });
}

export function pickRandom(
  views: ServerView[],
  options: JoinCandidateOptions,
  random: () => number = Math.random,
): ServerView | null {
  const candidates = joinCandidates(views, options);
  if (candidates.length === 0) return null;
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index] ?? null;
}
