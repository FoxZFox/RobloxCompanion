import type { ServerStatus } from '../../models/server';
import type { AppContext } from '../context';

/**
 * Flagging is the single most important write in the extension: it is what the user
 * came back from the game to do. Every one of these persists immediately.
 */
export async function setStatus(
  context: AppContext,
  placeId: string,
  jobId: string,
  status: ServerStatus,
): Promise<void> {
  const outcome = context.getScan(placeId);
  const live = outcome?.servers.find((s) => s.jobId === jobId);

  await context.reports.setStatus(placeId, jobId, status, {
    ...(live ? { playing: live.playing, maxPlayers: live.maxPlayers } : {}),
  });
  // Mirror onto the history entry so the log shows the verdict without a second lookup.
  await context.history.applyStatus(placeId, jobId, status);
}

export async function setFavorite(
  context: AppContext,
  placeId: string,
  jobId: string,
  favorite: boolean,
): Promise<void> {
  await context.reports.setFavorite(placeId, jobId, favorite);
}

export async function setNote(
  context: AppContext,
  placeId: string,
  jobId: string,
  note: string,
): Promise<void> {
  await context.reports.setNote(placeId, jobId, note);
}

export async function reset(context: AppContext, placeId: string, jobId: string): Promise<void> {
  await context.reports.reset(placeId, jobId);
  await context.history.applyStatus(placeId, jobId, 'unknown');
}
