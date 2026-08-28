import type { AppState, Result, SwEvent, UiRequest } from '../models/messages';
import { AppError, serializeError } from '../utils/errors';
import { BackupService } from '../services/storage/BackupService';
import { applySurfaceBehavior } from './surfaceBehavior';
import { detectActivePlaceId } from '../utils/robloxUrl';
import { gamePageUrl } from '../services/roblox/endpoints';
import type { AppContext } from './context';
import { getScanState } from './scanState';
import { buildState } from './stateBuilder';
import * as blacklistHandlers from './handlers/blacklistHandlers';
import * as flagHandlers from './handlers/flagHandlers';
import * as privateServerHandlers from './handlers/privateServerHandlers';
import * as presenceHandlers from './handlers/presenceHandlers';
import * as profileHandlers from './handlers/profileHandlers';
import * as reportHandlers from './handlers/reportHandlers';
import * as searchHandlers from './handlers/searchHandlers';
import * as serverHandlers from './handlers/serverHandlers';
import * as smartJoinHandlers from './handlers/smartJoinHandlers';

/** Fire-and-forget; no surface may be open, and that is not an error. */
export function broadcast(event: SwEvent): void {
  chrome.runtime.sendMessage(event).catch(() => undefined);
}

function toast(level: 'info' | 'success' | 'error', message: string): void {
  broadcast({ type: 'toast', level, message });
}

/**
 * Every request funnels through here and every one answers with a fresh AppState.
 *
 * Returning the whole snapshot rather than a delta is what keeps the popup and the side
 * panel consistent when both are open: neither can hold a partially-updated view.
 */
export async function handleRequest(
  context: AppContext,
  request: UiRequest,
): Promise<Result<AppState>> {
  try {
    const placeId = await resolvePlaceId(request);
    await apply(context, request, placeId);
    const state = await buildState(context, placeId, getScanState(placeId));

    // Tell every *other* open surface to refetch. Without this, flagging a server in the
    // popup would leave a side panel showing the old flag, which is precisely the
    // inconsistency that having two equal surfaces is supposed to avoid.
    if (isMutation(request)) broadcast({ type: 'state/changed' });

    return { ok: true, data: state };
  } catch (err) {
    return { ok: false, error: serializeError(err) };
  }
}

/** Read-only requests must not broadcast, or surfaces would refetch each other forever. */
function isMutation(request: UiRequest): boolean {
  return request.type !== 'state/get';
}

async function resolvePlaceId(request: UiRequest): Promise<string | undefined> {
  if ('placeId' in request && request.placeId) return request.placeId;
  return (await detectActivePlaceId()) ?? undefined;
}

async function apply(
  context: AppContext,
  request: UiRequest,
  placeId: string | undefined,
): Promise<void> {
  switch (request.type) {
    case 'state/get':
      return;

    case 'servers/scan':
      await serverHandlers.scan(context, request.placeId, request.force ?? false);
      return;

    case 'servers/loadMore':
      await serverHandlers.loadMore(context, request.placeId);
      return;

    case 'report/setStatus':
      await reportHandlers.setStatus(context, request.placeId, request.jobId, request.status);
      return;

    case 'report/setFavorite':
      await reportHandlers.setFavorite(context, request.placeId, request.jobId, request.favorite);
      return;

    case 'report/setNote':
      await reportHandlers.setNote(context, request.placeId, request.jobId, request.note);
      return;

    case 'report/reset':
      await reportHandlers.reset(context, request.placeId, request.jobId);
      return;

    case 'join/server': {
      const report = await serverHandlers.joinServer(context, request.placeId, request.jobId);
      reportJoin(report.unreliable);
      return;
    }

    case 'join/lowest': {
      const report = await serverHandlers.joinLowest(context, request.placeId);
      reportJoin(report.unreliable);
      return;
    }

    case 'join/random': {
      const report = await serverHandlers.joinRandom(context, request.placeId);
      reportJoin(report.unreliable);
      return;
    }

    case 'join/smart': {
      const report = await smartJoinHandlers.smartJoin(context, request.placeId);
      reportJoin(report.unreliable);
      return;
    }

    case 'smartJoin/plan':
      // Computes and stores the plan without joining, so the user can read the
      // reasoning first. This is what makes Explain Why honest rather than a
      // post-hoc rationalisation of a choice already made.
      context.lastPlan = await smartJoinHandlers.planSmartJoin(context, request.placeId);
      return;

    case 'blacklist/add': {
      const player = await blacklistHandlers.add(
        context,
        request.username,
        request.reason,
        request.notes,
      );
      toast('success', `Added ${player.usernameAtReport} to the blacklist`);
      return;
    }

    case 'blacklist/remove':
      await blacklistHandlers.remove(context, request.userId);
      return;

    case 'blacklist/update':
      await blacklistHandlers.update(context, request.userId, request.patch);
      return;

    case 'settings/set': {
      const before = await context.settings.get();
      const after = await context.settings.set(request.patch);
      // Sort and exclude-full are query parameters, so changing either invalidates the
      // cached page set rather than merely re-filtering it.
      const queryChanged =
        before.serverBrowser.sort !== after.serverBrowser.sort ||
        before.serverBrowser.excludeFull !== after.serverBrowser.excludeFull;
      if (queryChanged && placeId) context.clearScan(placeId);

      // The surface preference decides what the toolbar icon does, so it has to take
      // effect the moment it changes rather than at the next browser start.
      if (before.surface !== after.surface) await applySurfaceBehavior(after.surface);
      return;
    }

    case 'flags/create': {
      const flag = await flagHandlers.create(context, request, placeId);
      toast('success', `Created flag ${flag.icon} ${flag.name}`);
      return;
    }

    case 'flags/update':
      await flagHandlers.update(context, request.id, request.patch);
      return;

    case 'flags/remove':
      await flagHandlers.remove(context, request.id, placeId);
      return;

    case 'flags/toggleOnServer':
      await flagHandlers.toggleOnServer(
        context,
        request.placeId,
        request.jobId,
        request.flagId,
        request.applied,
      );
      return;

    case 'backup/import': {
      const bundle = BackupService.parse(request.text);
      const summary = await context.backup.importBundle(bundle);
      toast(
        'success',
        `Imported ${summary.customFlags} flag(s), ${summary.blacklist} player(s) and ${summary.places} experience(s)`,
      );
      return;
    }

    case 'privateServers/refresh':
      await privateServerHandlers.refresh(context, placeId);
      return;

    case 'privateServers/join': {
      await privateServerHandlers.join(context, request.placeId, request.vipServerId);
      toast('success', 'Launching Roblox...');
      return;
    }

    case 'search/experiences':
      await searchHandlers.search(context, request.query);
      return;

    case 'search/open':
      await searchHandlers.openResult(context, request.universeId);
      return;

    case 'blacklist/checkPresence':
      await presenceHandlers.check(context);
      return;

    case 'profile/mutualFriends':
      await profileHandlers.checkMutual(context, request.userId);
      return;

    case 'playtime/end':
      await context.playtime.endSession();
      return;

    case 'playtime/clear':
      await context.playtime.clear();
      return;

    case 'stats/refresh': {
      const experience = await context.getExperience(request.placeId);
      if (!experience.universeId) return;
      const stats = await context.liveStats.fetch(experience.universeId);
      if (stats) context.statsCache.set(experience.universeId, stats);
      return;
    }

    case 'dev/probeApis': {
      const experience = placeId ? await context.getExperience(placeId) : null;
      context.lastProbe = await context.apiProbe.runAll({
        ...(placeId ? { placeId } : {}),
        ...(experience?.universeId ? { universeId: experience.universeId } : {}),
      });
      return;
    }

    case 'ui/openSidePanel': {
      /*
       * Best-effort only, and it usually fails.
       *
       * User gestures do not survive chrome.runtime.sendMessage, so by the time this
       * runs Chrome has already decided there was no gesture and sidePanel.open()
       * throws (crbug 355266358). The reliable path is the toolbar icon, configured by
       * applySurfaceBehavior; the popup opens the panel itself without messaging.
       *
       * It is still attempted because Chrome does allow it in some situations, and the
       * caller shows a "use the toolbar icon" hint when it does not.
       */
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.windowId === undefined) throw new AppError('INTERNAL');
      await chrome.sidePanel.open({ windowId: tab.windowId });
      return;
    }

    /*
     * Routed through here because chrome.runtime.openOptionsPage does not exist in a
     * content script - the in-page panel's settings button silently threw until this
     * existed. Extension pages can still call it directly.
     */
    case 'ui/openOptions':
      await chrome.runtime.openOptionsPage();
      return;

    case 'ui/openDashboard':
      await chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
      return;

    case 'tab/openGame':
      await chrome.tabs.create({ url: gamePageUrl(request.placeId) });
      return;
  }
}

function reportJoin(unreliable: boolean): void {
  if (unreliable) {
    // The deeplink path frequently ignores gameInstanceId, so the user must verify the
    // job id in-game before trusting any flag they set afterwards.
    toast('error', 'Used the deeplink fallback - Roblox may have put you in another server');
  } else {
    toast('success', 'Launching Roblox...');
  }
}
