import {
  AUTHENTICATED_SPACING_MS,
  REFRESH_THROTTLE_MS,
  REQUEST_SPACING_MS,
} from '../config/constants';
import type { ExperienceContext } from '../models/experience';
import type { ScanOutcome } from '../models/server';
import type { SmartJoinPlan } from '../models/smartJoin';
import type { ApiProbeResult } from '../features/devtools/apiProbe';
import type { JobIdClockReport } from '../features/devtools/jobIdClock';
import type { PresenceFollowStatus } from '../models/messages';
import { EMPTY_PRIVATE_SERVERS, type PrivateServerState } from '../models/privateServer';
import { EMPTY_SEARCH, type SearchState } from '../models/search';
import { EMPTY_PROFILE, type ProfileState } from '../models/profile';
import type { PresenceSummary } from '../features/playerBlacklist/presence';
import { GamesApi } from '../services/roblox/gamesApi';
import { RequestScheduler } from '../services/roblox/RequestScheduler';
import { RobloxHttpClient } from '../services/roblox/RobloxHttpClient';
import { RobloxTabBridge } from '../services/roblox/robloxTab';
import { AdaptiveTransport, PageTransport, SwTransport } from '../services/roblox/transport';
import { UsersApi } from '../services/roblox/usersApi';
import { BackupService } from '../services/storage/BackupService';
import { CustomFlagRepository } from '../services/storage/CustomFlagRepository';
import { PlayerBlacklistRepository } from '../services/storage/PlayerBlacklistRepository';
import { ServerHistoryRepository } from '../services/storage/ServerHistoryRepository';
import { ServerReportRepository } from '../services/storage/ServerReportRepository';
import { SettingsRepository } from '../services/storage/SettingsRepository';
import { chromeStorage } from '../services/storage/storageArea';
import { ServerListService } from '../features/servers/ServerListService';
import { ApiProbe } from '../features/devtools/apiProbe';
import { PrivateServersApi } from '../services/roblox/privateServersApi';
import { SearchApi } from '../services/roblox/searchApi';
import { FriendsApi } from '../services/roblox/friendsApi';
import { PresenceApi } from '../services/roblox/presenceApi';
import { LiveStatsService, type LiveExperienceStats } from '../features/experience/liveStats';
import { PlaytimeRepository } from '../services/storage/PlaytimeRepository';
import { UnavailableRegionSource } from '../features/smartJoin/regionSource';
import { SmartJoinService } from '../features/smartJoin/SmartJoinService';
import { JoinService } from '../features/servers/joinService';
import { KeyedMutex, ThrottleGate } from '../utils/async';

/**
 * Roughly ten full server lists. Past this the map is dropped wholesale rather than
 * pruned: it is a convenience, and an approximate one, so the simple bound is the right
 * amount of machinery for it.
 */
const MAX_TRACKED_SIGHTINGS = 5000;

/**
 * Wires every service together once and owns the state that outlives a single message.
 *
 * The service worker is the only owner of state (see 03_ARCHITECTURE.md): both the popup
 * and the side panel are pure views, which is what lets them be open simultaneously
 * without drifting out of sync.
 */
export class AppContext {
  readonly settings = new SettingsRepository(chromeStorage);
  readonly reports = new ServerReportRepository(chromeStorage);
  readonly history = new ServerHistoryRepository(chromeStorage);
  readonly blacklist = new PlayerBlacklistRepository(chromeStorage);
  readonly flags = new CustomFlagRepository(chromeStorage);
  readonly playtime = new PlaytimeRepository(chromeStorage);

  readonly tabs = new RobloxTabBridge();
  readonly scheduler: RequestScheduler;

  readonly transport: AdaptiveTransport;
  readonly http: RobloxHttpClient;
  readonly games: GamesApi;
  readonly users: UsersApi;
  readonly serverList: ServerListService;
  readonly join: JoinService;
  readonly regions: UnavailableRegionSource;
  readonly backup: BackupService;
  readonly apiProbe: ApiProbe;
  readonly privateServers: PrivateServersApi;
  readonly search: SearchApi;
  readonly friends: FriendsApi;
  readonly presence: PresenceApi;
  readonly liveStats: LiveStatsService;
  readonly smartJoin: SmartJoinService;

  /** Latest scan per placeId. Cleared when the user forces a refresh. */
  private readonly scans = new Map<string, ScanOutcome>();
  private readonly experiences = new Map<string, ExperienceContext>();

  /** Serializes scans per place so two surfaces cannot start the same one twice. */
  readonly mutex = new KeyedMutex();
  readonly refreshGate = new ThrottleGate(REFRESH_THROTTLE_MS);

  /** Job ids joined this session, so Join Lowest keeps moving instead of looping. */
  readonly visitedThisSession = new Set<string>();

  /**
   * When each server was first seen in a scan this session, keyed `placeId:jobId`.
   *
   * Deliberately memory, not storage. `ServerReportRepository` records a first sighting
   * only for servers the user has actually acted on, which keeps storage proportional to
   * work done - persisting a timestamp for all 500 servers of every game visited would
   * not. But a server browsed for ten minutes before joining is a server we can honestly
   * say was already ten minutes old, and that fact costs nothing to keep until the worker
   * next sleeps.
   */
  private readonly firstSightings = new Map<string, number>();

  /** The most recent Smart Join plan, kept so the UI can explain the choice. */
  lastPlan: SmartJoinPlan | null = null;

  /** The account's private servers, loaded on request rather than on every state build. */
  privateServerState: PrivateServerState = EMPTY_PRIVATE_SERVERS;

  /**
   * Access codes for the private servers joinable at the current place.
   *
   * In memory, in the service worker, and nowhere else. A code grants entry to somebody
   * private server, so it never enters AppState (which every surface copies) and never
   * reaches storage (which outlives the session).
   */
  readonly privateServerCodes = new Map<number, string>();

  /**
   * The last presence lookup. Session-scoped and never persisted: where other people are
   * is not something this extension keeps.
   */
  presenceSummary: PresenceSummary | null = null;

  /** The profile last asked about. Session-scoped: nobody else's friend list is kept. */
  profileState: ProfileState = EMPTY_PROFILE;

  /** The last experience search, kept so reopening the tool does not re-query Roblox. */
  searchState: SearchState = EMPTY_SEARCH;

  /** Results of the last Developer Mode API probe. */
  lastProbe: ApiProbeResult[] | null = null;

  /** What the last Developer Mode job-id inspection found, if one has been run. */
  lastJobIdClock: JobIdClockReport | null = null;

  /**
   * What the last presence poll decided, so the panel can show that following is working
   * without the user having to infer it from a timer that may not have moved yet.
   */
  lastPresenceFollow: PresenceFollowStatus | null = null;

  /** Live stats per universeId, refreshed on demand rather than polled. */
  readonly statsCache = new Map<string, LiveExperienceStats>();

  private constructor(preferredTransport: 'auto' | 'sw' | 'page') {
    const sw = new SwTransport();
    const page = new PageTransport(this.tabs);
    this.transport = new AdaptiveTransport(sw, page, preferredTransport, (mode) => {
      // Remember the measured answer so the next session starts on the right path.
      void this.settings.setTransportMode(mode);
    });

    // Paced from what the transport has measured, not from a fixed guess.
    this.scheduler = new RequestScheduler(() =>
      this.transport.canPaceFast ? AUTHENTICATED_SPACING_MS : REQUEST_SPACING_MS,
    );

    this.http = new RobloxHttpClient(this.transport, this.scheduler);
    this.games = new GamesApi(this.http);
    this.users = new UsersApi(this.http);
    this.serverList = new ServerListService(this.http);
    this.join = new JoinService(this.tabs);
    this.regions = new UnavailableRegionSource();
    this.apiProbe = new ApiProbe(this.http);
    this.privateServers = new PrivateServersApi(this.http);
    this.search = new SearchApi(this.http);
    this.friends = new FriendsApi(this.http);
    this.presence = new PresenceApi(this.http);
    this.liveStats = new LiveStatsService(this.http);
    this.backup = new BackupService(
      this.settings,
      this.flags,
      this.blacklist,
      this.reports,
      this.history,
    );
    this.smartJoin = new SmartJoinService(this.regions);
  }

  static async create(): Promise<AppContext> {
    const bootstrap = new SettingsRepository(chromeStorage);
    await bootstrap.init();
    const mode = await bootstrap.getTransportMode();

    const context = new AppContext(mode);
    await context.settings.init();
    return context;
  }

  /**
   * Places this session has touched, plus an optional current one. Used when a change
   * has to be applied across every experience the user has data for, such as stripping
   * a deleted flag. Session-scoped on purpose: a full sweep of chrome.storage on every
   * flag deletion would cost far more than it is worth.
   */
  knownPlaceIds(current?: string): string[] {
    const ids = new Set(this.experiences.keys());
    for (const placeId of this.scans.keys()) ids.add(placeId);
    if (current) ids.add(current);
    return [...ids];
  }

  getScan(placeId: string): ScanOutcome | null {
    return this.scans.get(placeId) ?? null;
  }

  setScan(outcome: ScanOutcome): void {
    this.scans.set(outcome.placeId, outcome);
    this.noteSightings(outcome);
  }

  /**
   * Remembers the first time each server in a scan was seen, and only the first.
   *
   * `scannedAt` rather than `Date.now()`: the sighting happened when the list was
   * fetched, and a scan that took eight seconds to paginate should not date its servers
   * from the moment it finished.
   */
  private noteSightings(outcome: ScanOutcome): void {
    // Bounded so a long session across many games cannot grow this without limit. Losing
    // the oldest entries costs a "first seen" on servers nobody has looked at in a while.
    if (this.firstSightings.size > MAX_TRACKED_SIGHTINGS) this.firstSightings.clear();

    for (const server of outcome.servers) {
      const key = `${outcome.placeId}:${server.jobId}`;
      if (!this.firstSightings.has(key)) this.firstSightings.set(key, outcome.scannedAt);
    }
  }

  /** The earliest sighting of one server this session, if we happen to have one. */
  firstSightingOf(placeId: string, jobId: string): number | undefined {
    return this.firstSightings.get(`${placeId}:${jobId}`);
  }

  /**
   * Real Roblox job ids to inspect, for the Developer Mode job-id check.
   *
   * From this session's scans, which is where the largest sample is. The caller falls
   * back to stored history when the worker has restarted and there is nothing here.
   */
  scannedJobIds(limit: number): string[] {
    const ids: string[] = [];
    for (const outcome of this.scans.values()) {
      for (const server of outcome.servers) {
        ids.push(server.jobId);
        if (ids.length >= limit) return ids;
      }
    }
    return ids;
  }

  clearScan(placeId: string): void {
    this.scans.delete(placeId);
  }

  /** Cached so the popup opening does not re-resolve the universe every time. */
  async getExperience(placeId: string): Promise<ExperienceContext> {
    const cached = this.experiences.get(placeId);
    if (cached) return cached;
    const described = await this.games.describe(placeId);
    this.experiences.set(placeId, described);
    return described;
  }
}
