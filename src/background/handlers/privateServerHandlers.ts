import { groupByExperience } from '../../features/privateServers/privateServers';
import {
  EMPTY_PRIVATE_SERVERS,
  type JoinablePrivateServer,
  type PrivateServerState,
} from '../../models/privateServer';
import type { PrivateServerLink } from '../../models/messages';
import { privateServerLinkUrl } from '../../services/roblox/endpoints';
import { AppError } from '../../utils/errors';
import type { AppContext } from '../context';

/**
 * Loads the account's private servers, on request only (phase 6).
 *
 * Never on a timer and never as part of building state: this is one authenticated call
 * that returns every private server the user owns, and it has no business happening
 * because someone opened the popup. The panel asks when the tool is opened.
 */
export async function refresh(context: AppContext, placeId: string | undefined): Promise<void> {
  const universeId = placeId ? (await context.getExperience(placeId)).universeId : null;

  const [servers, enabledHere, joinable] = await Promise.all([
    context.privateServers.mine(),
    universeId ? context.privateServers.enabledInUniverse(universeId) : Promise.resolve(null),
    placeId ? context.privateServers.joinableAtPlace(placeId) : Promise.resolve([]),
  ]);

  /*
   * Access codes are kept here and nowhere else.
   *
   * A code grants entry to somebody's private server, so it stays in the service worker's
   * memory: not in AppState, which every surface holds a copy of, and not in storage,
   * which outlives the session. The UI joins by vipServerId and this map turns that back
   * into a code at the moment of the join.
   */
  context.privateServerCodes.clear();
  for (const entry of joinable) {
    context.privateServerCodes.set(entry.server.vipServerId, entry.accessCode);
  }

  const grouped = groupByExperience(servers, universeId ?? null);

  const state: PrivateServerState = {
    ...EMPTY_PRIVATE_SERVERS,
    ...grouped,
    joinableHere: joinable.map((entry) => entry.server),
    enabledHere,
    fetchedAt: Date.now(),
  };

  context.privateServerState = state;
}

/**
 * The joinable list for one place, without the two whole-account calls `refresh` makes.
 *
 * Smart Join needs this and nothing else, and it runs on a click: asking for every
 * private server on the account, plus whether this universe allows them, would be two
 * requests spent on questions nobody asked. The codes are merged rather than cleared, so
 * a join queued from the panel does not lose its code because Smart Join ran after it.
 */
export async function refreshJoinable(
  context: AppContext,
  placeId: string,
): Promise<JoinablePrivateServer[]> {
  const joinable = await context.privateServers.joinableAtPlace(placeId);

  for (const entry of joinable) {
    context.privateServerCodes.set(entry.server.vipServerId, entry.accessCode);
  }

  const servers = joinable.map((entry) => entry.server);
  // Keeps the panel's list in step with what Smart Join just saw, without claiming the
  // owned-server halves of the state were refreshed - they were not fetched at all.
  context.privateServerState = { ...context.privateServerState, joinableHere: servers };
  return servers;
}

/**
 * The share link for a server the user owns, read rather than created.
 *
 * Answered as a one-shot query instead of through AppState (see models/messages.ts): a
 * link that admits anyone holding it must not be copied into every open surface, or left
 * sitting in a snapshot after the user has moved on.
 *
 * A `null` link is a real answer, not a failure. Roblox mints a join code when the owner
 * asks for one on its own site; until then there is nothing to read, and the only API
 * that would create one is the PATCH that regenerates it - which would invalidate a link
 * they may already have given their friends.
 */
export async function shareLink(
  context: AppContext,
  privateServerId: number,
): Promise<PrivateServerLink> {
  const owned = [
    ...context.privateServerState.here,
    ...context.privateServerState.elsewhere,
  ].find((server) => server.privateServerId === privateServerId);

  if (!owned) {
    return {
      privateServerId,
      url: null,
      reason: 'That server is not in the list any more. Refresh and try again.',
    };
  }

  const joinCode = await context.privateServers.joinCode(privateServerId);
  if (!joinCode) {
    return {
      privateServerId,
      url: null,
      reason:
        'Roblox has no share link for this server yet. Create one on its Roblox page — this extension will not, because generating a link replaces any link you have already shared.',
    };
  }

  return {
    privateServerId,
    url: privateServerLinkUrl(owned.placeId, joinCode),
    reason: 'Anyone with this link can join. It is the link Roblox already made — nothing changed.',
  };
}

/**
 * Joins a private server by id, looking the code up at the last moment.
 *
 * The join itself goes through the same MAIN-world launcher as a public server, because
 * it is the same launcher - Roblox's own private-server list calls `joinPrivateGame`
 * with exactly this pair of arguments.
 */
export async function join(
  context: AppContext,
  placeId: string,
  vipServerId: number,
): Promise<void> {
  const accessCode = context.privateServerCodes.get(vipServerId);
  // Codes are session-scoped, so a stale panel can ask for one the worker has forgotten
  // after a restart. Refreshing is the fix, and saying so beats a bare failure.
  if (!accessCode) throw new AppError('JOIN_FAILED');

  await context.join.joinPrivate(placeId, accessCode);
}
