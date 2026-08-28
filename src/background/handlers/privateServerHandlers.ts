import { groupByExperience } from '../../features/privateServers/privateServers';
import { EMPTY_PRIVATE_SERVERS, type PrivateServerState } from '../../models/privateServer';
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
