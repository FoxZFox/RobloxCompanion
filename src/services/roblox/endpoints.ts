/**
 * Every Roblox URL the extension knows, in one place, so an endpoint move is one edit.
 * Verification status for each of these lives in 02_ROBLOX_API_MAP.md.
 */

export const GAMES_API = 'https://games.roblox.com/v1';
export const USERS_API = 'https://users.roblox.com/v1';
export const APIS = 'https://apis.roblox.com';
export const WEB_ORIGIN = 'https://www.roblox.com';

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

/** docs-only. Private servers owned by the signed-in user. */
export function myPrivateServersUrl(): string {
  return `${GAMES_API}/vip-servers/my-private-servers`;
}
