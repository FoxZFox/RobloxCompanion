/**
 * Every Roblox URL the extension knows, in one place, so an endpoint move is one edit.
 * Verification status for each of these lives in 02_ROBLOX_API_MAP.md.
 */

export const GAMES_API = 'https://games.roblox.com/v1';
export const USERS_API = 'https://users.roblox.com/v1';
export const APIS = 'https://apis.roblox.com';
export const WEB_ORIGIN = 'https://www.roblox.com';

/*
 * Hosts behind an optional permission (see PERMISSIONS.md).
 *
 * Nothing here is requested at install: each is asked for at the moment a feature or the
 * API probe actually needs it, so someone who never touches trading never grants access to
 * their trades. ORIGIN is the match pattern to hand chrome.permissions.request.
 */
export const PRESENCE_API = 'https://presence.roblox.com/v1';
export const FRIENDS_API = 'https://friends.roblox.com/v1';
export const AVATAR_API = 'https://avatar.roblox.com/v1';
export const TRADES_API = 'https://trades.roblox.com/v1';

export const OPTIONAL_ORIGINS = {
  presence: 'https://presence.roblox.com/*',
  friends: 'https://friends.roblox.com/*',
  avatar: 'https://avatar.roblox.com/*',
  trades: 'https://trades.roblox.com/*',
} as const;

export interface PublicServersQuery {
  placeId: string;
  sortOrder: 'Asc' | 'Desc';
  excludeFullGames: boolean;
  limit: number;
  cursor?: string | null;
}

/**
 * verified-live. `sortOrder=Asc` genuinely orders by player count ascending server-side,
 * so "lowest players first" never needs a local sort.
 *
 * The cursor is bound to both the serverType spelling and the limit, so neither may
 * change partway through a pagination run.
 */
export function publicServersUrl(q: PublicServersQuery): string {
  const url = new URL(`${GAMES_API}/games/${encodeURIComponent(q.placeId)}/servers/Public`);
  url.searchParams.set('limit', String(q.limit));
  url.searchParams.set('sortOrder', q.sortOrder);
  if (q.excludeFullGames) url.searchParams.set('excludeFullGames', 'true');
  if (q.cursor) url.searchParams.set('cursor', q.cursor);
  return url.toString();
}

/** docs-only. placeId to universeId. */
export function universeIdUrl(placeId: string): string {
  return `${APIS}/universes/v1/places/${encodeURIComponent(placeId)}/universe`;
}

/** docs-only. Name, playing count and maxPlayers for one or more universes. */
export function gameDetailsUrl(universeIds: string[]): string {
  const url = new URL(`${GAMES_API}/games`);
  url.searchParams.set('universeIds', universeIds.join(','));
  return url.toString();
}

/** docs-only. POST { usernames: string[], excludeBannedUsers: false }. */
export function usernamesToUsersUrl(): string {
  return `${USERS_API}/usernames/users`;
}

export function userProfileUrl(userId: number): string {
  return `${WEB_ORIGIN}/users/${userId}/profile`;
}

export function gamePageUrl(placeId: string): string {
  return `${WEB_ORIGIN}/games/${encodeURIComponent(placeId)}/`;
}

/** verified-live. Roblox's own documented web entry point for joining an instance. */
export function gameStartUrl(placeId: string, jobId: string): string {
  return `${WEB_ORIGIN}/games/start?placeId=${encodeURIComponent(placeId)}&gameInstanceId=${encodeURIComponent(jobId)}`;
}

/*
 * gamejoin.roblox.com/v1/join-game-instance is deliberately NOT here.
 *
 * It is the only Roblox call that reveals a server's location, but verified live on
 * 27 Aug 2026 it answers a browser request with `status: 12` and no join script: it is
 * gated to the game client by a User-Agent the Fetch spec forbids extensions from
 * setting. Spoofing that would be impersonating the client to defeat an access check.
 * See features/smartJoin/regionSource.ts.
 */

/** docs-only. Like and dislike counts. Public GET, same host as the server list. */
export function gameVotesUrl(universeIds: string[]): string {
  const url = new URL(`${GAMES_API}/games/votes`);
  url.searchParams.set('universeIds', universeIds.join(','));
  return url.toString();
}

/* ------------------------------------------------------------ private servers
 * All docs-only. Phase 6 is built on these, so they are probed before anything is
 * built on top of them - the lesson from region (see section 3 of 02_ROBLOX_API_MAP.md).
 */

/** docs-only. `{ privateServersEnabled: boolean }`. */
export function privateServersEnabledUrl(universeId: string): string {
  return `${GAMES_API}/private-servers/enabled-in-universe/${encodeURIComponent(universeId)}`;
}

/**
 * docs-only. Private servers owned by the signed-in user.
 *
 * verified-live 28 Aug 2026: answers with
 * `{ active, universeId, placeId, name, ownerId, ownerName, priceInRobux, privateServerId,
 *    expirationDate, willRenew, universeName, ... }`.
 *
 * Note what is NOT in it: no access code and no link, so this alone cannot join anything.
 */
export function myPrivateServersUrl(): string {
  return `${GAMES_API}/vip-servers/my-private-servers`;
}

/**
 * verified-live 28 Aug 2026, and the answer was no.
 *
 * Joining needs an access code. This endpoint answers with the richest description of a
 * private server available - `{id, name, game:{id, name, rootPlace}, joinCode, active,
 * subscription:{active, expired, expirationDate, price, canRenew, ...}}` - and `joinCode`
 * came back **null**. Roblox's documented way to obtain one is a PATCH to this same path,
 * which can regenerate the link and silently invalidate the one the user already gave
 * their friends, so that is not a call this extension will make on its own.
 */
export function vipServerUrl(privateServerId: number): string {
  return `${GAMES_API}/vip-servers/${privateServerId}`;
}

/**
 * docs-only. The last avenue for a join code that costs no write.
 *
 * Different question from the one above: not "describe this server I own" but "which
 * private servers can I join on this place". Historically that list is what Roblox's own
 * game page renders, and a list meant for joining has to carry something to join with.
 * Probed before anything is built on it.
 */
export function placePrivateServersUrl(placeId: string): string {
  return `${GAMES_API}/games/${encodeURIComponent(placeId)}/private-servers`;
}

/* ---------------------------------------------------------- probe-only, for now
 * Every URL below is `docs-only` and is currently reachable ONLY from the API probe.
 * They exist so one probe run can tell us which of phases 5, 7, 8 and 9 rest on
 * endpoints that actually answer a browser - the question that blocked all four. None of
 * them may appear in a feature until the probe has seen a real response and
 * 02_ROBLOX_API_MAP.md has been updated (rule 7).
 */

/** docs-only. The signed-in user: `{ id, name, displayName }`. */
export function authenticatedUserUrl(): string {
  return `${USERS_API}/users/authenticated`;
}

/** docs-only. Public details for one user id. */
export function userDetailsUrl(userId: number): string {
  return `${USERS_API}/users/${userId}`;
}

/**
 * docs-only. POST `{ userIds: number[] }`.
 *
 * Probed against the signed-in user only. Presence is other people's data, and the point
 * of the probe is to learn the response shape, which does not require touching anybody
 * else's account (§13).
 */
export function presenceUrl(): string {
  return `${PRESENCE_API}/presence/users`;
}

/** docs-only. Friends of one user; phase 8's mutual-friends idea rests on this. */
export function friendsUrl(userId: number): string {
  return `${FRIENDS_API}/users/${userId}/friends`;
}

/**
 * docs-only. What phase 7's quick search would call.
 *
 * The first probe run answered HTTP 200 with `{searchResults: [], nextPageToken: "",
 * filteredSearchQuery: "", ...}` for the query "obby" - the right endpoint, plainly, but
 * refusing to search. `sessionId` is the parameter Roblox's own page sends and this did
 * not, so it is the first thing to rule out.
 */
export function omniSearchUrl(query: string, sessionId: string): string {
  const url = new URL(`${APIS}/search-api/omni-search`);
  url.searchParams.set('searchQuery', query);
  url.searchParams.set('pageType', 'all');
  url.searchParams.set('sessionId', sessionId);
  return url.toString();
}

/** docs-only. Trades the user has already completed - the only place a shape can be seen. */
export function completedTradesUrl(limit = 10): string {
  return `${TRADES_API}/trades/completed?limit=${limit}&sortOrder=Desc`;
}

/** docs-only. The user's own avatar: what phase 8's sandbox would read before equipping. */
export function avatarUrl(userId: number): string {
  return `${AVATAR_API}/users/${userId}/avatar`;
}

/** docs-only. Read-only list of trades sent to the user; phase 9 starts here. */
export function inboundTradesUrl(limit = 10): string {
  return `${TRADES_API}/trades/inbound?limit=${limit}&sortOrder=Desc`;
}
