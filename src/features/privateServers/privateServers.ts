import type {
  JoinablePrivateServer,
  PrivateServer,
  PrivateServerState,
} from '../../models/privateServer';

/**
 * Shaping the private-server list, kept pure so it can be tested without a browser.
 *
 * The parsing is defensive on purpose. This response was `docs-only` for the whole life
 * of the project and was only seen for the first time on 28 Aug 2026, from one account -
 * so a field that was present then may be absent for someone else, and a missing
 * expiry must not take the list down with it.
 */

/**
 * Anything Roblox might hand back; every field is treated as optional until proven.
 *
 * `ownerId` and `ownerName` are in the real response and deliberately go no further than
 * this type: the list is the signed-in user's own servers, so the owner is always them,
 * and carrying their name around the app would be storing an identity for no reason.
 */
export interface RawPrivateServer {
  privateServerId?: number;
  name?: string;
  universeId?: number | string;
  placeId?: number | string;
  universeName?: string;
  active?: boolean;
  expirationDate?: string | null;
  willRenew?: boolean;
  priceInRobux?: number | null;
  ownerId?: number;
  ownerName?: string;
}

export function parsePrivateServer(raw: RawPrivateServer): PrivateServer | null {
  // Without an id and a place there is nothing the UI could do with the row, so it is
  // dropped rather than rendered as a server with blanks where its identity should be.
  if (typeof raw.privateServerId !== 'number') return null;
  if (raw.placeId === undefined || raw.placeId === null) return null;

  const expiresAt = raw.expirationDate ? Date.parse(raw.expirationDate) : Number.NaN;

  return {
    privateServerId: raw.privateServerId,
    name: raw.name?.trim() || 'Untitled private server',
    universeId: String(raw.universeId ?? ''),
    placeId: String(raw.placeId),
    universeName: raw.universeName?.trim() || 'Unknown experience',
    active: raw.active !== false,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
    willRenew: raw.willRenew === true,
    priceInRobux: typeof raw.priceInRobux === 'number' ? raw.priceInRobux : null,
  };
}

/**
 * Splits the account's servers into the ones for the experience being looked at and the
 * rest.
 *
 * Matching on universeId rather than placeId: an experience can have several places, and
 * a private server belongs to the universe. Matching on place would hide someone's own
 * server from them on any game with more than one place.
 */
export function groupByExperience(
  servers: PrivateServer[],
  universeId: string | null,
): Pick<PrivateServerState, 'here' | 'elsewhere'> {
  const here: PrivateServer[] = [];
  const elsewhere: PrivateServer[] = [];

  for (const server of servers) {
    if (universeId && server.universeId === universeId) here.push(server);
    else elsewhere.push(server);
  }

  return { here: sortServers(here), elsewhere: sortServers(elsewhere) };
}

/**
 * Active first, then soonest to expire.
 *
 * An expiry is the only thing in this list that can be missed, so it decides the order;
 * a server with no expiry sorts last rather than first, since "no date" is not "urgent".
 */
export function sortServers(servers: PrivateServer[]): PrivateServer[] {
  return [...servers].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (a.expiresAt === b.expiresAt) return a.name.localeCompare(b.name);
    if (a.expiresAt === null) return 1;
    if (b.expiresAt === null) return -1;
    return a.expiresAt - b.expiresAt;
  });
}

/**
 * How an expiry should be described, or null when there is nothing honest to say.
 *
 * Roblox hands back dates a century out for servers that do not really expire, so a
 * literal "expires in 36,000 days" would be noise dressed up as information.
 */
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function describeExpiry(server: PrivateServer, now: number): string | null {
  if (server.expiresAt === null) return null;

  const remaining = server.expiresAt - now;
  if (remaining <= 0) return 'expired';
  if (remaining > 5 * YEAR_MS) return null;

  const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
  if (days <= 1) return 'expires today';
  if (days < 30) return `expires in ${days} days`;
  const months = Math.round(days / 30);
  return `expires in about ${months} month${months === 1 ? '' : 's'}`;
}

/** The joinable-server shape, from `GET /v1/games/{placeId}/private-servers`. */
export interface RawJoinableServer {
  vipServerId?: number;
  name?: string;
  accessCode?: string;
  playing?: number;
  maxPlayers?: number;
  owner?: { name?: string; displayName?: string } | null;
}

/**
 * Splits a joinable server into what the UI may see and the code that joins it.
 *
 * The split is the point. `accessCode` grants entry to somebody's private server, so it
 * is returned separately from the view model and the service worker keeps it in memory;
 * nothing that crosses a message boundary to a surface, or reaches storage, carries it.
 */
export function parseJoinable(
  raw: RawJoinableServer,
): { server: JoinablePrivateServer; accessCode: string } | null {
  if (typeof raw.vipServerId !== 'number') return null;
  if (typeof raw.accessCode !== 'string' || !raw.accessCode) return null;

  return {
    accessCode: raw.accessCode,
    server: {
      vipServerId: raw.vipServerId,
      name: raw.name?.trim() || 'Private server',
      // displayName first: it is the name Roblox shows for that person everywhere else.
      ownerName: raw.owner?.displayName?.trim() || raw.owner?.name?.trim() || null,
      playing: typeof raw.playing === 'number' ? raw.playing : null,
      maxPlayers: typeof raw.maxPlayers === 'number' ? raw.maxPlayers : null,
    },
  };
}
