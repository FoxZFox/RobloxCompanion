import type { AppState, HealthSummary, ScanState } from '../models/messages';
import type { ServerView } from '../models/server';
import type { BlacklistCheck } from '../models/blacklist';
import {
  detectedIn,
  undeterminable,
  type PresenceSummary,
} from '../features/playerBlacklist/presence';
import { flagsForPlace } from '../models/flags';
import { summarise } from '../features/playtime/playtime';
import { buildFlaggedViews, buildViews } from '../features/servers/liveness';
import { applyFilters, sortViews } from '../features/servers/serverFilters';
import type { AppContext } from './context';

/**
 * Assembles the single snapshot every surface renders from.
 *
 * Building it in one place is what keeps the popup and side panel identical: they each
 * receive the same object and neither derives anything on its own.
 */
export async function buildState(
  context: AppContext,
  placeId: string | undefined,
  scanState: ScanState,
): Promise<AppState> {
  const settings = await context.settings.get();

  if (!placeId) {
    return {
      experience: null,
      settings,
      servers: [],
      flagged: [],
      history: [],
      blacklist: await context.blacklist.list(),
      customFlags: [],
      allCustomFlags: await context.flags.list(),
      apiProbe: context.lastProbe,
      presence: context.presenceSummary,
      privateServers: context.privateServerState,
      search: context.searchState,
      profile: context.profileState,
      liveStats: null,
      playtime: summarise(await context.playtime.list(), Date.now()),
      openSession: await context.playtime.openSession(),
      lastJoined: null,
      smartJoinPlan: null,
      health: emptyHealth(),
      scan: scanState,
      transport: context.transport.state,
      totalShown: 0,
    };
  }

  const [experience, reports, history, blacklist, lastJoined, allCustomFlags] = await Promise.all([
    context.getExperience(placeId),
    context.reports.getAll(placeId),
    context.history.list(placeId),
    context.blacklist.list(),
    context.reports.getLastJoined(placeId),
    context.flags.list(),
  ]);

  const outcome = context.getScan(placeId);
  /*
   * Presence is folded in here rather than inside buildViews, so a server view stays a
   * function of the scan and the user's own reports. What Roblox happened to disclose
   * about somebody's whereabouts is a separate fact, layered on top and easily removed
   * if the disclosure stops.
   */
  const allViews = withPresence(buildViews(placeId, outcome, reports), context);
  const visible = sortViews(
    applyFilters(allViews, settings.serverBrowser),
    settings.serverBrowser.sort,
  );
  const blacklistedIds = blacklist.map((player) => player.userId);

  const lastJoinedReport = lastJoined ? reports[lastJoined.jobId] : undefined;

  return {
    experience,
    settings,
    servers: visible,
    flagged: buildFlaggedViews(outcome, reports),
    history,
    blacklist,
    customFlags: flagsForPlace(allCustomFlags, placeId),
    allCustomFlags,
    apiProbe: context.lastProbe,
    presence: context.presenceSummary,
    privateServers: context.privateServerState,
    search: context.searchState,
    profile: context.profileState,
    liveStats: experience.universeId
      ? (context.statsCache.get(experience.universeId) ?? null)
      : null,
    playtime: summarise(await context.playtime.list(), Date.now()),
    openSession: await context.playtime.openSession(),
    lastJoined: lastJoined
      ? lastJoinedReport
        ? { ...lastJoined, report: lastJoinedReport }
        : lastJoined
      : null,
    smartJoinPlan: context.lastPlan,
    health: summarize(allViews, blacklistedIds, context.presenceSummary),
    scan: scanState,
    transport: context.transport.state,
    totalShown: visible.length,
  };
}

/**
 * Marks servers a blacklisted player was positively placed in.
 *
 * Only the ones Roblox actually disclosed. A server with no mark is not clear - it is
 * unexamined, which is what the summary below keeps saying out loud.
 */
function withPresence(views: ServerView[], context: AppContext): ServerView[] {
  const players = context.presenceSummary?.players;
  if (!players?.length) return views;

  return views.map((view) => {
    const found = detectedIn(view.jobId, players);
    return found.length > 0 ? { ...view, blacklisted: found } : view;
  });
}

/**
 * The verdict for the experience as a whole.
 *
 * `none-detected` is reserved for the one case where it is true: every blacklisted player
 * was asked about, Roblox disclosed a location for all of them, and none was here. The
 * moment a single person's location is withheld the answer is `unknown`, however many
 * others came back clean - because the one who was withheld is the one you would want to
 * know about.
 */
function summariseBlacklist(
  views: ServerView[],
  blacklistedIds: number[],
  presence: PresenceSummary | null,
): BlacklistCheck {
  if (blacklistedIds.length === 0) {
    return { verdict: 'none-detected', detected: [], undeterminable: 0 };
  }
  if (!presence) {
    return { verdict: 'unknown', detected: [], undeterminable: blacklistedIds.length };
  }

  const detected = [...new Set(views.flatMap((view) => view.blacklisted ?? []))];
  const unknownCount = undeterminable(presence);

  if (detected.length > 0) return { verdict: 'detected', detected, undeterminable: unknownCount };
  return {
    verdict: unknownCount > 0 ? 'unknown' : 'none-detected',
    detected: [],
    undeterminable: unknownCount,
  };
}

function summarize(
  views: ServerView[],
  blacklistedIds: number[],
  presence: PresenceSummary | null,
): HealthSummary {
  let clean = 0;
  let flagged = 0;
  let unknown = 0;
  let favorites = 0;

  for (const view of views) {
    if (view.favorite) favorites += 1;
    if (view.status === 'clean') clean += 1;
    else if (view.status === 'unknown') unknown += 1;
    else flagged += 1;
  }

  return {
    clean,
    flagged,
    unknown,
    favorites,
    blacklistedPlayers: blacklistedIds.length,
    blacklistCheck: summariseBlacklist(views, blacklistedIds, presence),
  };
}

function emptyHealth(): HealthSummary {
  return {
    clean: 0,
    flagged: 0,
    unknown: 0,
    favorites: 0,
    blacklistedPlayers: 0,
    blacklistCheck: { verdict: 'none-detected', detected: [], undeterminable: 0 },
  };
}

export const IDLE_SCAN: ScanState = {
  status: 'idle',
  scanned: 0,
  page: 0,
  complete: false,
  truncated: false,
  lastScanAt: null,
  canLoadMore: false,
};
