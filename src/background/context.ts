import {
  AUTHENTICATED_SPACING_MS,
  REFRESH_THROTTLE_MS,
  REQUEST_SPACING_MS,
} from '../config/constants';
import type { ExperienceContext } from '../models/experience';
import type { ScanOutcome } from '../models/server';
import type { SmartJoinPlan } from '../models/smartJoin';
import type { ApiProbeResult } from '../features/devtools/apiProbe';
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
import { LiveStatsService, type LiveExperienceStats } from '../features/experience/liveStats';
import { PlaytimeRepository } from '../services/storage/PlaytimeRepository';
import { UnavailableRegionSource } from '../features/smartJoin/regionSource';
import { SmartJoinService } from '../features/smartJoin/SmartJoinService';
import { JoinService } from '../features/servers/joinService';
import { KeyedMutex, ThrottleGate } from '../utils/async';

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

  /** The most recent Smart Join plan, kept so the UI can explain the choice. */
  lastPlan: SmartJoinPlan | null = null;

  /** Results of the last Developer Mode API probe. */
  lastProbe: ApiProbeResult[] | null = null;

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
