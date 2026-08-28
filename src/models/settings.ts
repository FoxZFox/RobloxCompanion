import { DEFAULT_SCAN_PAGES } from '../config/constants';
import type { ServerStatus } from './server';
import type { SmartJoinPatch, SmartJoinSettings } from './smartJoin';
import { DEFAULT_SMART_JOIN } from './smartJoin';
import type { ThemePatch, ThemeSettings } from './theme';
import { DEFAULT_THEME, mergeTheme } from './theme';

export type SortOrder = 'Asc' | 'Desc';
/**
 * Where the Command Center appears. `inpage` is the floating panel injected into
 * roblox.com itself, which is the default: it sits next to what the user is actually
 * looking at, survives alt-tabbing, and can be dragged out of the way.
 */
export type SurfacePreference = 'inpage' | 'panel' | 'popup';

export interface PanelSettings {
  /** Viewport coordinates of the panel's top-left corner. */
  x: number;
  y: number;
  open: boolean;
  /** Which tool was showing when it was last closed. */
  tool: string;
  /** Collapsed to just its title bar. */
  minimised: boolean;
}

/** Every feature can be switched off (spec section 25). */
export interface FeatureFlags {
  servers: boolean;
  smartJoin: boolean;
  serverHistory: boolean;
  playerBlacklist: boolean;
  quickActionBar: boolean;
  privateServers: boolean;
  quickSearch: boolean;
  themes: boolean;
  profiles: boolean;
  avatar: boolean;
  trading: boolean;
  playtime: boolean;
  commandPalette: boolean;
}

export interface ServerBrowserSettings {
  /**
   * How many pages of 100 to fetch. Roblox returns the emptiest servers first under
   * `Asc`, so page one already contains what Join Lowest will pick; more pages mainly
   * buy a fuller picture for browsing.
   */
  scanPages: number;
  sort: SortOrder;
  excludeFull: boolean;
  /** Only show servers at or below this count. 0 = off. */
  maxPlayerCount: number;
  /** Only show servers with exactly this count. 0 = off. */
  exactPlayerCount: number;
  hideCleanServers: boolean;
  onlyStatus: ServerStatus | 'none';
  onlyFavorites: boolean;
}

/** Which reputation flags cause a server to be skipped by Join Lowest / Smart Join. */
export interface AvoidSettings {
  exploiterServers: boolean;
  buggedServers: boolean;
  manuallyAvoided: boolean;
  blacklistedPlayersWhenDetectable: boolean;
}

export interface PrivacySettings {
  /**
   * Off by default and stays off in V1: nothing about the user's servers, reports or
   * blacklist leaves the machine (spec sections 34-35).
   */
  shareReportsWithCommunity: boolean;
  /** Presence lookups touch third-party users, so they are opt-in. */
  allowPresenceChecks: boolean;
}

export interface Settings {
  features: FeatureFlags;
  serverBrowser: ServerBrowserSettings;
  smartJoin: SmartJoinSettings;
  avoid: AvoidSettings;
  privacy: PrivacySettings;
  theme: ThemeSettings;
  surface: SurfacePreference;
  panel: PanelSettings;
  developerMode: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  features: {
    servers: true,
    smartJoin: true,
    serverHistory: true,
    playerBlacklist: true,
    quickActionBar: true,
    privateServers: true,
    quickSearch: true,
    // On, but a theme still has to be chosen before anything is repainted
    // (DEFAULT_THEME.preset is 'off'). Shipping this on is what makes the Themes tool
    // findable; shipping it applied would repaint someone's Roblox uninvited.
    themes: true,
    profiles: true,
    avatar: false, // phase 8
    trading: false, // phase 9
    playtime: true,
    commandPalette: true,
  },
  smartJoin: DEFAULT_SMART_JOIN,
  serverBrowser: {
    scanPages: DEFAULT_SCAN_PAGES,
    sort: 'Asc',
    excludeFull: true,
    maxPlayerCount: 0,
    exactPlayerCount: 0,
    hideCleanServers: false,
    onlyStatus: 'none',
    onlyFavorites: false,
  },
  avoid: {
    exploiterServers: true,
    buggedServers: true,
    manuallyAvoided: true,
    blacklistedPlayersWhenDetectable: true,
  },
  privacy: {
    shareReportsWithCommunity: false,
    allowPresenceChecks: false,
  },
  theme: DEFAULT_THEME,
  surface: 'inpage',
  panel: {
    x: 0,
    y: 0,
    open: false,
    tool: 'servers',
    minimised: false,
  },
  developerMode: false,
};

/**
 * One level of partiality is enough for every branch except Smart Join and the theme,
 * which nest twice, so those keys are excluded from the mapped type and given their own
 * shapes.
 */
export type SettingsPatch = {
  [K in keyof Omit<Settings, 'smartJoin' | 'theme'>]?: Settings[K] extends object
    ? Partial<Settings[K]>
    : Settings[K];
} & {
  smartJoin?: SmartJoinPatch;
  theme?: ThemePatch;
};

/**
 * Combines two override sets, keeping them as overrides.
 *
 * Distinct from mergeSettings, which resolves against defaults: this must never
 * introduce a key the user has not actually set, or the override set would grow to pin
 * everything and defeat the point of storing overrides at all.
 */
export function mergePatch(base: SettingsPatch, patch: SettingsPatch): SettingsPatch {
  const next: SettingsPatch = { ...base };

  if (patch.features) next.features = { ...base.features, ...patch.features };
  if (patch.serverBrowser) next.serverBrowser = { ...base.serverBrowser, ...patch.serverBrowser };
  if (patch.avoid) next.avoid = { ...base.avoid, ...patch.avoid };
  if (patch.privacy) next.privacy = { ...base.privacy, ...patch.privacy };
  if (patch.panel) next.panel = { ...base.panel, ...patch.panel };
  if (patch.smartJoin) {
    next.smartJoin = {
      ...base.smartJoin,
      ...patch.smartJoin,
      // Weights nest a level deeper, so a patch touching one must not drop the rest.
      ...(patch.smartJoin.weights
        ? { weights: { ...base.smartJoin?.weights, ...patch.smartJoin.weights } }
        : {}),
    };
  }
  if (patch.theme) {
    next.theme = {
      ...base.theme,
      ...patch.theme,
      // The custom palette nests a level deeper, so a patch changing one colour must not
      // drop the other two.
      ...(patch.theme.custom ? { custom: { ...base.theme?.custom, ...patch.theme.custom } } : {}),
    };
  }
  if (patch.surface !== undefined) next.surface = patch.surface;
  if (patch.developerMode !== undefined) next.developerMode = patch.developerMode;

  return next;
}

/** Shallow-merges one level deep, which is exactly the shape of SettingsPatch. */
export function mergeSettings(base: Settings, patch: SettingsPatch): Settings {
  return {
    features: { ...base.features, ...patch.features },
    serverBrowser: { ...base.serverBrowser, ...patch.serverBrowser },
    smartJoin: mergeSmartJoin(base.smartJoin, patch.smartJoin),
    avoid: { ...base.avoid, ...patch.avoid },
    privacy: { ...base.privacy, ...patch.privacy },
    theme: mergeTheme(base.theme, patch.theme),
    surface: patch.surface ?? base.surface,
    panel: { ...base.panel, ...patch.panel },
    developerMode: patch.developerMode ?? base.developerMode,
  };
}

/**
 * Smart Join nests one level deeper than the rest of Settings, so its sub-objects are
 * merged explicitly. A plain spread would let a patch that touches one weight wipe the
 * others.
 */
function mergeSmartJoin(
  base: SmartJoinSettings,
  patch: SmartJoinPatch | undefined,
): SmartJoinSettings {
  if (!patch) return base;
  return {
    population: patch.population ?? base.population,
    weights: { ...base.weights, ...patch.weights },
    preferredRegions: patch.preferredRegions ?? base.preferredRegions,
  };
}
