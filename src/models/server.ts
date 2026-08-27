/**
 * Server reputation, as recorded by the user.
 *
 * Note the deliberate divergence from the original spec, which put "favorite" inside
 * this union: favouriting is orthogonal to reputation (a server can be both clean and
 * a favourite), and folding them together would mean starring a server silently erased
 * the fact that it was checked and clean. The UI mock agrees — it draws the star as its
 * own button next to the reputation chip — so `favorite` lives on the record as a flag.
 */
export type ServerStatus = 'unknown' | 'clean' | 'exploiters' | 'bugged' | 'avoid';

export const SERVER_STATUSES: readonly ServerStatus[] = [
  'unknown',
  'clean',
  'exploiters',
  'bugged',
  'avoid',
];

export interface StatusMeta {
  label: string;
  icon: string;
  /** Whether Smart Join / Join Lowest skip this server when the matching setting is on. */
  avoidable: boolean;
}

export const STATUS_META: Record<ServerStatus, StatusMeta> = {
  unknown: { label: 'UNKNOWN', icon: '\u2753', avoidable: false },
  clean: { label: 'CLEAN', icon: '\u{1F7E2}', avoidable: false },
  exploiters: { label: 'EXPLOITER', icon: '\u26A0', avoidable: true },
  bugged: { label: 'BUGGED', icon: '\u{1F41B}', avoidable: true },
  avoid: { label: 'AVOID', icon: '\u{1F6AB}', avoidable: true },
};

/**
 * Whether a tracked server is still running.
 *
 * `offline` is deliberately hard to earn. Roblox caps how deep the public server list
 * can be paginated, so a jobId missing from a scan is usually just outside the visible
 * window rather than gone. Claiming "offline" there would hide servers the user still
 * wants, so anything inconclusive is reported as `unseen`.
 */
export type Liveness = 'online' | 'unseen' | 'offline';

/** One server exactly as the public servers API returns it. */
export interface LiveServer {
  jobId: string;
  playing: number;
  maxPlayers: number;
  /** Server-side average across the players in that instance. NOT the user's latency. */
  ping?: number;
  fps?: number;
}

/** A user-authored report about one server instance (spec section 11). */
export interface ServerReport {
  placeId: string;
  jobId: string;
  status: ServerStatus;
  favorite?: boolean;

  playersWhenReported?: number;
  maxPlayers?: number;

  /** Our own first sighting. Roblox exposes no server start time, so this is the age proxy. */
  firstSeenAt?: number;
  lastSeenAt?: number;
  lastJoinedAt?: number;
  reportedAt?: number;

  note?: string;
  /** Ids of user-defined flags applied to this server (spec section 22). */
  customFlagIds?: string[];
  /** Ids the user typed in themselves. We never derive these from the server list. */
  suspectedUserIds?: number[];

  ping?: number;
  fps?: number;
}

export type ReportMap = Record<string, ServerReport>;

/** A live server merged with whatever the user has recorded about it. */
export interface ServerView {
  jobId: string;
  placeId: string;
  playing: number;
  maxPlayers: number;
  status: ServerStatus;
  liveness: Liveness;
  favorite: boolean;
  customFlagIds: string[];
  ping?: number;
  fps?: number;
  firstSeenAt?: number;
  lastJoinedAt?: number;
  reportedAt?: number;
  note?: string;
}

export interface LastJoined {
  placeId: string;
  jobId: string;
  playersAtJoin: number;
  maxPlayers: number;
  joinedAt: number;
  gameName?: string;
  ping?: number;
}

/** The result of one pagination run over the public server list. */
export interface ScanOutcome {
  placeId: string;
  servers: LiveServer[];
  /** True only when the API ran out of pages on its own (nextPageCursor === null). */
  complete: boolean;
  /** True when we stopped at our own page cap rather than exhausting the list. */
  truncated: boolean;
  /** True when the query excluded full servers, so absence proves nothing. */
  filtered: boolean;
  cursor: string | null;
  pagesFetched: number;
  scannedAt: number;
}

export function isReported(report: ServerReport | undefined): boolean {
  return Boolean(report && report.status !== 'unknown');
}

export function isFull(server: { playing: number; maxPlayers: number }): boolean {
  return server.maxPlayers > 0 && server.playing >= server.maxPlayers;
}
