import type {
  Liveness,
  LiveServer,
  ReportMap,
  ScanOutcome,
  ServerReport,
  ServerView,
} from '../../models/server';

export interface LivenessContext {
  live: Set<string>;
  /** The scan ran out of pages naturally rather than hitting our page cap. */
  complete: boolean;
  /** The query excluded full servers, so a missing server may simply have filled up. */
  filtered: boolean;
}

/**
 * Roblox caps how deep the public server list can be paginated, so a jobId missing from
 * a scan is usually just outside the visible window rather than gone. Only a scan that
 * ended on its own, with no filter applied, can prove a server is offline; everything
 * else is reported as `unseen` so flagged servers the user still cares about are never
 * silently hidden.
 */
export function computeLiveness(jobId: string, ctx: LivenessContext): Liveness {
  if (ctx.live.has(jobId)) return 'online';
  if (ctx.complete && !ctx.filtered) return 'offline';
  return 'unseen';
}

export function toContext(outcome: ScanOutcome | null): LivenessContext {
  if (!outcome) return { live: new Set(), complete: false, filtered: false };
  return {
    live: new Set(outcome.servers.map((s) => s.jobId)),
    complete: outcome.complete,
    filtered: outcome.filtered,
  };
}

export function viewFromLive(
  placeId: string,
  server: LiveServer,
  report: ServerReport | undefined,
): ServerView {
  const view: ServerView = {
    jobId: server.jobId,
    placeId,
    playing: server.playing,
    maxPlayers: server.maxPlayers,
    status: report?.status ?? 'unknown',
    liveness: 'online',
    favorite: Boolean(report?.favorite),
    customFlagIds: report?.customFlagIds ?? [],
  };
  if (server.ping !== undefined) view.ping = server.ping;
  if (server.fps !== undefined) view.fps = server.fps;
  if (report?.firstSeenAt !== undefined) view.firstSeenAt = report.firstSeenAt;
  if (report?.reportedAt !== undefined) view.reportedAt = report.reportedAt;
  if (report?.lastJoinedAt !== undefined) view.lastJoinedAt = report.lastJoinedAt;
  if (report?.note !== undefined) view.note = report.note;
  return view;
}

export function viewFromReport(
  report: ServerReport,
  ctx: LivenessContext,
  live?: LiveServer,
): ServerView {
  const view: ServerView = {
    jobId: report.jobId,
    placeId: report.placeId,
    playing: live?.playing ?? report.playersWhenReported ?? 0,
    maxPlayers: live?.maxPlayers ?? report.maxPlayers ?? 0,
    status: report.status,
    liveness: computeLiveness(report.jobId, ctx),
    favorite: Boolean(report.favorite),
    customFlagIds: report.customFlagIds ?? [],
  };
  const ping = live?.ping ?? report.ping;
  const fps = live?.fps ?? report.fps;
  if (ping !== undefined) view.ping = ping;
  if (fps !== undefined) view.fps = fps;
  if (report.firstSeenAt !== undefined) view.firstSeenAt = report.firstSeenAt;
  if (report.reportedAt !== undefined) view.reportedAt = report.reportedAt;
  if (report.lastJoinedAt !== undefined) view.lastJoinedAt = report.lastJoinedAt;
  if (report.note !== undefined) view.note = report.note;
  return view;
}

export function buildViews(
  placeId: string,
  outcome: ScanOutcome | null,
  reports: ReportMap,
): ServerView[] {
  if (!outcome) return [];
  return outcome.servers.map((server) => viewFromLive(placeId, server, reports[server.jobId]));
}

/** Every flagged server ever recorded, live or not, so none is ever lost from view. */
export function buildFlaggedViews(outcome: ScanOutcome | null, reports: ReportMap): ServerView[] {
  const ctx = toContext(outcome);
  const liveById = new Map((outcome?.servers ?? []).map((s) => [s.jobId, s] as const));
  return Object.values(reports)
    .filter((report) => report.status !== 'unknown' || (report.customFlagIds?.length ?? 0) > 0)
    .map((report) => viewFromReport(report, ctx, liveById.get(report.jobId)))
    .sort(compareFlagged);
}

/** Online first, then emptiest, so the easiest server to act on is on top. */
function compareFlagged(a: ServerView, b: ServerView): number {
  const rank = (l: Liveness): number => (l === 'online' ? 0 : l === 'unseen' ? 1 : 2);
  const byLiveness = rank(a.liveness) - rank(b.liveness);
  if (byLiveness !== 0) return byLiveness;
  const byPlayers = a.playing - b.playing;
  if (byPlayers !== 0) return byPlayers;
  return (b.reportedAt ?? 0) - (a.reportedAt ?? 0);
}
