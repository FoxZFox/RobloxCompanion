import type { LiveServer } from '../../models/server';
import { AppError } from '../../utils/errors';

/**
 * Shape returned by GET /v1/games/{placeId}/servers/Public - verified against live traffic.
 *
 * There is no region, no uptime and no version. There is no player list either: `players`
 * comes back empty. `playerTokens` does arrive populated - one opaque token per player -
 * but a token is not an identity, and the only way to attach a name to one is to
 * fingerprint the avatar thumbnail it renders, which section 13 forbids. Blacklist
 * membership therefore answers "unknown" as a matter of policy, not of capability.
 *
 * The tokens are deliberately not typed into this interface: nothing in the extension may
 * consume them, and leaving them out is the cheapest way to keep it that way.
 */
export interface RawServer {
  id: string;
  maxPlayers: number;
  playing: number;
  /** Server-side average across the players in that instance, not the user's latency. */
  fps?: number;
  ping?: number;
}

export interface ServersPage {
  data: RawServer[];
  nextPageCursor: string | null;
}

/**
 * Validates an already-parsed response body. Anything that does not look like a server
 * is dropped rather than trusted, since a shape change on Roblox's side should degrade
 * the list instead of crashing the extension.
 */
export function normalizeServersPage(value: unknown): ServersPage {
  if (typeof value !== 'object' || value === null) throw new AppError('API_ERROR');

  const obj = value as { data?: unknown; nextPageCursor?: unknown };
  const data = Array.isArray(obj.data) ? (obj.data as unknown[]) : [];
  const cursor = typeof obj.nextPageCursor === 'string' ? obj.nextPageCursor : null;
  return { data: data.filter(isRawServer), nextPageCursor: cursor };
}

export function parseServersPage(bodyText: string): ServersPage {
  try {
    return normalizeServersPage(JSON.parse(bodyText));
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('API_ERROR');
  }
}

export function isRawServer(value: unknown): value is RawServer {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as RawServer;
  return (
    typeof v.id === 'string' && typeof v.playing === 'number' && typeof v.maxPlayers === 'number'
  );
}

export function toLiveServer(raw: RawServer): LiveServer {
  const server: LiveServer = {
    jobId: raw.id,
    playing: raw.playing,
    maxPlayers: raw.maxPlayers,
  };
  if (typeof raw.ping === 'number') server.ping = raw.ping;
  if (typeof raw.fps === 'number') server.fps = Math.round(raw.fps);
  return server;
}
