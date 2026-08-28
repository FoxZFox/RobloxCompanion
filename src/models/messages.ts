import type { BlacklistCheck, BlacklistedPlayer, BlacklistReason } from './blacklist';
import type { ExperienceContext } from './experience';
import type { CustomFlag } from './flags';
import type { ApiProbeResult } from '../features/devtools/apiProbe';
import type { JobIdClockReport } from '../features/devtools/jobIdClock';
import type { LiveExperienceStats } from '../features/experience/liveStats';
import type { PrivateServerState } from './privateServer';
import type { SearchState } from './search';
import type { ProfileState } from './profile';
import type { PresenceSummary } from '../features/playerBlacklist/presence';
import type { PlaySession, PlaytimeTotals } from '../features/playtime/playtime';
import type { SessionLogEntry } from '../features/playtime/sessionLog';
import type { LastJoined, ServerReport, ServerStatus, ServerView } from './server';
import type { Settings, SettingsPatch } from './settings';
import type { SmartJoinPlan } from './smartJoin';

export type ErrorCode =
  | 'RATE_LIMITED'
  | 'NOT_AUTHENTICATED'
  | 'NOT_LOGGED_IN'
  | 'NO_ROBLOX_TAB'
  | 'NETWORK'
  | 'API_ERROR'
  | 'NO_SERVERS'
  | 'SERVER_GONE'
  | 'JOIN_FAILED'
  | 'LAUNCHER_MISSING'
  | 'NO_EXPERIENCE'
  | 'USER_NOT_FOUND'
  | 'TIMEOUT'
  | 'PRESENCE_DISABLED'
  | 'PRESENCE_NO_PERMISSION'
  | 'INTERNAL';

export interface SerializedError {
  code: ErrorCode;
  message: string;
  retryAfterMs?: number;
  httpStatus?: number;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: SerializedError };

/* ---------------------------------------------------------------- UI -> SW */

export type UiRequest =
  | { type: 'state/get'; placeId?: string }
  | { type: 'servers/scan'; placeId: string; force?: boolean }
  | { type: 'servers/loadMore'; placeId: string }
  | { type: 'report/setStatus'; placeId: string; jobId: string; status: ServerStatus }
  | { type: 'report/setFavorite'; placeId: string; jobId: string; favorite: boolean }
  | { type: 'report/setNote'; placeId: string; jobId: string; note: string }
  | { type: 'report/reset'; placeId: string; jobId: string }
  | { type: 'join/server'; placeId: string; jobId: string }
  | { type: 'join/lowest'; placeId: string }
  | { type: 'join/random'; placeId: string }
  | { type: 'join/smart'; placeId: string }
  | { type: 'smartJoin/plan'; placeId: string }
  | { type: 'blacklist/add'; username: string; reason: BlacklistReason; notes?: string }
  | { type: 'blacklist/remove'; userId: number }
  | { type: 'blacklist/update'; userId: number; patch: Partial<BlacklistedPlayer> }
  | { type: 'settings/set'; patch: SettingsPatch }
  | { type: 'flags/create'; name: string; icon: string; avoid: boolean; scoped: boolean }
  | { type: 'flags/update'; id: string; patch: Partial<Omit<CustomFlag, 'id'>> }
  | { type: 'flags/remove'; id: string }
  | { type: 'flags/toggleOnServer'; placeId: string; jobId: string; flagId: string; applied: boolean }
  | { type: 'backup/import'; text: string }
  | { type: 'dev/probeApis' }
  | { type: 'dev/inspectJobIds' }
  | { type: 'playtime/end' }
  | { type: 'playtime/clear' }
  | { type: 'stats/refresh'; placeId: string }
  | { type: 'privateServers/refresh' }
  | { type: 'privateServers/join'; placeId: string; vipServerId: number }
  | { type: 'search/experiences'; query: string }
  | { type: 'search/open'; universeId: string }
  | { type: 'profile/mutualFriends'; userId: string }
  | { type: 'blacklist/checkPresence' }
  | { type: 'ui/openSidePanel' }
  | { type: 'ui/openDashboard' }
  | { type: 'ui/openOptions' }
  | { type: 'tab/openGame'; placeId: string };

export type UiRequestType = UiRequest['type'];

/* ------------------------------------------------- UI -> SW, one-shot queries */

/**
 * The one exception to "every request answers with a whole AppState", and it exists for
 * the one reason that justifies an exception: the answer is a secret.
 *
 * AppState is copied into every open surface and rebuilt on every message, which is
 * exactly what makes it the wrong carrier for a link that admits a stranger to somebody's
 * private server. A query is asked once, answered once, and the answer is never stored,
 * never broadcast, and never part of the snapshot any other surface receives.
 *
 * Anything that is not a secret belongs in AppState. Adding a second query type to save a
 * round trip would be trading the consistency guarantee for nothing.
 */
export type UiQuery = { type: 'query/privateServerLink'; privateServerId: number };

export interface PrivateServerLink {
  privateServerId: number;
  /** Null when Roblox has never minted a link for this server; `reason` says so. */
  url: string | null;
  /** Shown verbatim, so a missing link explains itself rather than looking broken. */
  reason: string;
}

/** Maps each query to what it answers with, so a caller cannot mistype the pairing. */
export interface UiQueryResults {
  'query/privateServerLink': PrivateServerLink;
}

export type UiQueryType = UiQuery['type'];

/* ------------------------------------------------------------- SW -> UI */

export interface ScanState {
  status: 'idle' | 'loading' | 'error';
  /** How many servers we can actually see, which is not how many exist. */
  scanned: number;
  page: number;
  complete: boolean;
  truncated: boolean;
  lastScanAt: number | null;
  canLoadMore: boolean;
  error?: SerializedError;
}

export interface TransportState {
  mode: 'sw' | 'page' | 'unknown';
  authenticated: boolean | null;
  limitPerMin: number | null;
}

/** Counts for the Server Health block. */
export interface HealthSummary {
  clean: number;
  flagged: number;
  unknown: number;
  favorites: number;
  blacklistedPlayers: number;
  blacklistCheck: BlacklistCheck;
}

/**
 * What the last presence poll did, for a status line the user can act on.
 *
 * Kept because "is this working?" is otherwise unanswerable: a tracker that has correctly
 * decided to do nothing looks exactly like one that is broken.
 */
export interface PresenceFollowStatus {
  at: number;
  action: 'start' | 'confirm' | 'end' | 'none';
  /** The sentence the decision came with, shown verbatim. */
  reason: string;
}

export interface HistoryEntry {
  placeId: string;
  jobId: string;
  status: ServerStatus;
  joinedAt: number;
  playersAtJoin?: number;
  maxPlayers?: number;
  gameName?: string;
  note?: string;
}

export interface AppState {
  experience: ExperienceContext | null;
  settings: Settings;
  servers: ServerView[];
  /** Every flagged server on record, live or not, so none is ever lost from view. */
  flagged: ServerView[];
  history: HistoryEntry[];
  blacklist: BlacklistedPlayer[];
  /** Custom flags that apply to the current experience, global ones included. */
  customFlags: CustomFlag[];
  /** Every custom flag, for the Settings editor. */
  allCustomFlags: CustomFlag[];
  /** Results of the last Developer Mode API probe, if one has been run. */
  apiProbe: ApiProbeResult[] | null;
  /** What the last Developer Mode job-id inspection found (dev only). */
  jobIdClock: JobIdClockReport | null;
  /** What the last presence poll decided, when session following is on. */
  presenceFollow: PresenceFollowStatus | null;
  /** Private servers this account owns, once the user has asked for them (phase 6). */
  privateServers: PrivateServerState;
  /** The last experience search (phase 7). */
  search: SearchState;
  /** Mutual friends for the profile being viewed (phase 8). */
  profile: ProfileState;
  /** The last presence lookup for blacklisted players (phase 5), if one was run. */
  presence: PresenceSummary | null;
  /** Live like/dislike and player counts for the current experience, when fetched. */
  liveStats: LiveExperienceStats | null;
  /** Per-experience playtime totals, longest first. */
  playtime: PlaytimeTotals[];
  /** The last visits, server by server, newest first (§18 with duration). */
  sessions: SessionLogEntry[];
  /** The session currently open, if any. */
  openSession: PlaySession | null;
  lastJoined: (LastJoined & { report?: ServerReport }) | null;
  /** The most recent Smart Join plan, for the Explain Why panel. */
  smartJoinPlan: SmartJoinPlan | null;
  health: HealthSummary;
  scan: ScanState;
  transport: TransportState;
  /** Servers currently shown after filters, out of `scan.scanned` loaded. */
  totalShown: number;
}

export type SwEvent =
  | { type: 'state/changed' }
  | { type: 'scan/progress'; placeId: string; scanned: number; page: number }
  | { type: 'toast'; level: 'info' | 'success' | 'error'; message: string };

/* ------------------------------------------- SW -> content script (RPC) */

export type JoinStrategyName = 'gameLauncher' | 'startUrl' | 'deeplink';

export type CsRequest =
  | { type: 'cs/ping' }
  | { type: 'cs/context' }
  | { type: 'cs/fetch'; url: string }
  | { type: 'cs/post'; url: string; body: string; csrfToken?: string }
  | {
      type: 'cs/join';
      placeId: string;
      jobId: string;
      strategy: JoinStrategyName;
      accessCode?: string;
    }
  /** Toolbar icon asking the in-page panel to open or close. */
  | { type: 'cs/togglePanel' };

export interface CsFetchResponse {
  status: number;
  ok: boolean;
  bodyText: string;
  headers: Record<string, string>;
}

export interface CsContextResponse {
  loggedIn: boolean | null;
  placeId: string | null;
  theme: 'dark' | 'light' | null;
}

/* ----------------------------------------- content script -> MAIN world */

export interface PageJoinRequest {
  reqId: string;
  placeId: string;
  jobId: string;
  /** Present only for a private server. Never stored, never logged, never persisted. */
  accessCode?: string;
}

export interface PageJoinResponse {
  reqId: string;
  ok: boolean;
  reason?: string;
}
