import { buildViews } from '../../features/servers/liveness';
import type { JoinReport } from '../../features/servers/joinService';
import type { SmartJoinPlan } from '../../models/smartJoin';
import { AppError } from '../../utils/errors';
import type { AppContext } from '../context';
import { joinServer, scan } from './serverHandlers';

/**
 * Builds the plan without joining, so the Explain Why panel can show what Smart Join
 * would do and why before the user commits to it.
 */
export async function planSmartJoin(
  context: AppContext,
  placeId: string,
): Promise<SmartJoinPlan> {
  let outcome = context.getScan(placeId);
  if (!outcome) {
    await scan(context, placeId, false);
    outcome = context.getScan(placeId);
  }

  const settings = await context.settings.get();
  const reports = await context.reports.getAll(placeId);
  const views = buildViews(placeId, outcome, reports);

  return context.smartJoin.plan({
    placeId,
    views,
    outcome,
    settings: settings.smartJoin,
    avoid: settings.avoid,
  });
}

export async function smartJoin(context: AppContext, placeId: string): Promise<JoinReport> {
  const plan = await planSmartJoin(context, placeId);
  if (!plan.chosen) throw new AppError('NO_SERVERS');

  context.lastPlan = plan;
  return joinServer(context, placeId, plan.chosen.jobId);
}
