import { buildViews } from '../../features/servers/liveness';
import { pickLowest, pickRandom } from '../../features/servers/serverFilters';
import type { JoinReport } from '../../features/servers/joinService';
import type { ScanOutcome, ServerView } from '../../models/server';
import { AppError, serializeError } from '../../utils/errors';
import type { AppContext } from '../context';
import { fromOutcome, setScanState } from '../scanState';

async function runScan(
  context: AppContext,
  placeId: string,
  force: boolean,
  from?: ScanOutcome,
): Promise<ScanOutcome> {
  const settings = await context.settings.get();

  return context.mutex.run(placeId, async () => {
    setScanState(placeId, { status: 'loading' });
    try {
      const outcome = await context.serverList.scan(
        {
          placeId,
          sort: settings.serverBrowser.sort,
          excludeFull: settings.serverBrowser.excludeFull,
          force,
          maxPages: from ? 1 : settings.serverBrowser.scanPages,
          ...(from ? { from } : {}),
        },
        (scanned, page) => {
          setScanState(placeId, { scanned, page });
        },
      );

      context.setScan(outcome);
      // One write for the whole scan rather than one per server.
      await context.reports.touchSeen(placeId, outcome.servers);
      setScanState(placeId, fromOutcome(outcome));
      return outcome;
    } catch (err) {
      setScanState(placeId, { status: 'error', error: serializeError(err) });
      throw err;
    }
  });
}

export async function scan(context: AppContext, placeId: string, force = false): Promise<void> {
  if (force) {
    context.clearScan(placeId);
    context.scheduler.clearCache();
  }
  await runScan(context, placeId, force);
}

export async function loadMore(context: AppContext, placeId: string): Promise<void> {
  const existing = context.getScan(placeId);
  if (!existing?.cursor) return;
  await runScan(context, placeId, false, existing);
}

/** Scans first when nothing is loaded, so the quick-action buttons work from a cold start. */
async function ensureViews(context: AppContext, placeId: string): Promise<ServerView[]> {
  let outcome = context.getScan(placeId);
  if (!outcome) outcome = await runScan(context, placeId, false);
  const reports = await context.reports.getAll(placeId);
  return buildViews(placeId, outcome, reports);
}

export async function joinServer(
  context: AppContext,
  placeId: string,
  jobId: string,
): Promise<JoinReport> {
  const outcome = context.getScan(placeId);
  const live = outcome?.servers.find((s) => s.jobId === jobId);

  const report = await context.join.join(placeId, jobId);

  const experience = await context.getExperience(placeId);
  const server = live ?? { jobId, playing: 0, maxPlayers: 0 };
  await context.reports.markJoined(placeId, server, experience.name);
  await context.history.record(placeId, server, experience.name);
  context.visitedThisSession.add(jobId);

  // Joining is the only moment we can observe, so it is where a play session starts.
  // Starting a new one closes whatever was open (see PlaytimeRepository).
  const settings = await context.settings.get();
  if (settings.features.playtime) {
    await context.playtime.startSession({
      placeId,
      jobId,
      ...(experience.name ? { gameName: experience.name } : {}),
    });
  }

  return report;
}

export async function joinLowest(context: AppContext, placeId: string): Promise<JoinReport> {
  const settings = await context.settings.get();
  const views = await ensureViews(context, placeId);

  // Try to avoid handing back the server the user just left, but never fail because of
  // it: on a small experience every candidate may already have been visited.
  const target =
    pickLowest(views, { avoid: settings.avoid, exclude: context.visitedThisSession }) ??
    pickLowest(views, { avoid: settings.avoid });

  if (!target) throw new AppError('NO_SERVERS');
  return joinServer(context, placeId, target.jobId);
}

export async function joinRandom(context: AppContext, placeId: string): Promise<JoinReport> {
  const settings = await context.settings.get();
  const views = await ensureViews(context, placeId);

  const target =
    pickRandom(views, { avoid: settings.avoid, exclude: context.visitedThisSession }) ??
    pickRandom(views, { avoid: settings.avoid });

  if (!target) throw new AppError('NO_SERVERS');
  return joinServer(context, placeId, target.jobId);
}
