import type { AppState, HealthSummary, ScanState } from '../models/messages';
import type { ServerView } from '../models/server';
import { checkServerMembership } from '../features/playerBlacklist/blacklistCheck';
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
  const allViews = buildViews(placeId, outcome, reports);
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
    health: summarize(allViews, blacklistedIds),
    scan: scanState,
    transport: context.transport.state,
    totalShown: visible.length,
  };
}

function summarize(views: ServerView[], blacklistedIds: number[]): HealthSummary {
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
    // Server-wide rather than per-server: Roblox discloses no player identities for
    // public servers, so the only truthful summary is "we could not check".
    blacklistCheck: checkServerMembership({ id: 'aggregate', playerTokens: [] }, blacklistedIds),
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
