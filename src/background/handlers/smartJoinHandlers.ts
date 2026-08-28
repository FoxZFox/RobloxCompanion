import { buildViews } from '../../features/servers/liveness';
import { choosePrivateServer } from '../../features/privateServers/privateServers';
import type { JoinReport } from '../../features/servers/joinService';
import type { JoinablePrivateServer } from '../../models/privateServer';
import type { PopulationPreference, PrivatePick, SmartJoinPlan } from '../../models/smartJoin';
import { AppError } from '../../utils/errors';
import type { AppContext } from '../context';
import { refreshJoinable } from './privateServerHandlers';
import { joinServer, scan } from './serverHandlers';

/**
 * Builds the plan without joining, so the Explain Why panel can show what Smart Join
 * would do and why before the user commits to it.
 *
 * The private-server preference (§29) is decided here rather than at join time, which is
 * what keeps the preview honest: what the panel shows and what the button does come from
 * the same call, so neither can describe a decision the other did not make.
 */
export async function planSmartJoin(
  context: AppContext,
  placeId: string,
): Promise<SmartJoinPlan> {
  const settings = await context.settings.get();

  let privateNote: string | null = null;
  if (settings.features.privateServers && settings.smartJoin.preferOwnPrivateServer) {
    const outcome = await considerPrivate(context, placeId, settings.smartJoin.population);
    // A private pick ends it: no public page is fetched at all, so this preference costs
    // one request where a scan would have cost several.
    if (outcome.pick) {
      return {
        chosen: null,
        ranked: [],
        considered: 0,
        loaded: 0,
        capped: false,
        regionsProbed: 0,
        privatePick: outcome.pick,
        privateNote: null,
      };
    }
    privateNote = outcome.note;
  }

  let outcome = context.getScan(placeId);
  if (!outcome) {
    await scan(context, placeId, false);
    outcome = context.getScan(placeId);
  }

  const reports = await context.reports.getAll(placeId);
  const views = buildViews(placeId, outcome, reports);

  const plan = await context.smartJoin.plan({
    placeId,
    views,
    outcome,
    settings: settings.smartJoin,
    avoid: settings.avoid,
  });

  return { ...plan, privateNote };
}

export async function smartJoin(context: AppContext, placeId: string): Promise<JoinReport> {
  const plan = await planSmartJoin(context, placeId);
  context.lastPlan = plan;

  if (plan.privatePick) {
    const accessCode = context.privateServerCodes.get(plan.privatePick.vipServerId);
    // The plan was built from the same lookup that filled this map moments ago, so a miss
    // means the worker restarted in between. Failing beats falling through to a public
    // server after telling the user a private one was chosen.
    if (!accessCode) throw new AppError('JOIN_FAILED');
    return context.join.joinPrivate(placeId, accessCode);
  }

  if (!plan.chosen) throw new AppError('NO_SERVERS');
  return joinServer(context, placeId, plan.chosen.jobId);
}

/**
 * Looks for a private server to take instead of a public one, and explains a miss.
 *
 * Every path that does not produce a pick returns a sentence, because the alternative is
 * a Smart Join that silently behaves like the preference is off. A lookup failure falls
 * through rather than throwing: the setting says *prefer*, so a private server that
 * cannot be reached means a public one, not an error.
 */
async function considerPrivate(
  context: AppContext,
  placeId: string,
  preference: PopulationPreference,
): Promise<{ pick: PrivatePick | null; note: string | null }> {
  let joinable: JoinablePrivateServer[];
  try {
    joinable = await refreshJoinable(context, placeId);
  } catch {
    return {
      pick: null,
      note: 'Could not reach your private servers, so public servers were scored instead.',
    };
  }

  if (joinable.length === 0) {
    return {
      pick: null,
      note: 'No private server you can enter here, so public servers were scored instead.',
    };
  }

  const chosen = choosePrivateServer(joinable, preference);
  if (!chosen) {
    return {
      pick: null,
      note: `Every private server you can enter here is full (${joinable.length} checked), so public servers were scored instead.`,
    };
  }

  return {
    pick: {
      vipServerId: chosen.vipServerId,
      name: chosen.name,
      playing: chosen.playing,
      maxPlayers: chosen.maxPlayers,
      reason:
        joinable.length === 1
          ? 'The one private server you can enter here, and you asked for these first.'
          : `Chosen from ${joinable.length} private servers you can enter here, on the same population preference as public ones.`,
    },
    note: null,
  };
}
