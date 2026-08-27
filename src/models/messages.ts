import type { BlacklistCheck, BlacklistedPlayer, BlacklistReason } from './blacklist';
import type { ExperienceContext } from './experience';
import type { CustomFlag } from './flags';
import type { ApiProbeResult } from '../features/devtools/apiProbe';
import type { LiveExperienceStats } from '../features/experience/liveStats';
import type { PlaySession, PlaytimeTotals } from '../features/playtime/playtime';
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
  | { type: 'playtime/end' }
  | { type: 'playtime/clear' }
  | { type: 'stats/refresh'; placeId: string }
  | { type: 'ui/openSidePanel' }
  | { type: 'ui/openDashboard' }
  | { type: 'ui/openOptions' }
  | { type: 'tab/openGame'; placeId: string };

export type UiRequestType = UiRequest['type'];

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
  /** Live like/dislike and player counts for the current experience, when fetched. */
  liveStats: LiveExperienceStats | null;
  /** Per-experience playtime totals, longest first. */
  playtime: PlaytimeTotals[];
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
  | { type: 'cs/join'; placeId: string; jobId: string; strategy: JoinStrategyName }
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
}

export interface PageJoinResponse {
  reqId: string;
  ok: boolean;
  reason?: string;
}
