/**
 * Tunables. Values marked "measured" come from live probing of the Roblox API during
 * the predecessor project and are documented in 02_ROBLOX_API_MAP.md. Changing one of
 * those is a decision about Roblox's behaviour, not a matter of taste.
 */

export const ROBLOX_ORIGIN = 'https://www.roblox.com';

/** measured: the servers API rejects any limit other than 10/25/50/100 with HTTP 400. */
export const PAGE_LIMIT = 100;
/** measured: limit=100 intermittently returns an empty data array; 50 is the fallback. */
export const FALLBACK_PAGE_LIMIT = 50;

/**
 * measured: pagination is capped server-side somewhere between ~150 and ~500 servers,
 * and Roblox states this is intentional, so scanning past this returns nothing new.
 *
 * We stop well short of that cap by default. With `sortOrder=Asc` Roblox returns the
 * emptiest servers FIRST, so page one already holds the hundred servers that Join Lowest
 * and Smart Join actually choose between - pages three through five cost seconds of
 * waiting to add servers that will never win. Users who want a fuller picture can raise
 * this in Settings.
 */
export const DEFAULT_SCAN_PAGES = 2;
/** Ceiling for the Settings control; beyond this Roblox's own cap takes over anyway. */
export const MAX_SCAN_PAGES = 5;

/**
 * Spacing between requests, chosen from what we know about our own quota.
 *
 * measured: the guest bucket is 3 requests / 60s, so an unauthenticated scan has to
 * crawl. An authenticated one gets roughly 100 / 60s - about 600ms sustained - so the
 * old flat 1500ms was pacing every user as though they were a guest and made a scan feel
 * slow for no reason. A short burst well inside the authenticated budget is fine.
 */
export const REQUEST_SPACING_MS = 1500;
export const AUTHENTICATED_SPACING_MS = 350;
export const MAX_RATE_LIMIT_RETRIES = 3;
export const DEFAULT_RETRY_AFTER_MS = 5000;
/** An x-ratelimit-limit at or below this means we are in the unauthenticated bucket. */
export const GUEST_RATE_LIMIT_THRESHOLD = 5;

export const CACHE_TTL_MS = 15_000;
export const REFRESH_THROTTLE_MS = 5_000;
export const RPC_TIMEOUT_MS = 15_000;
export const TAB_READY_TIMEOUT_MS = 20_000;

/** Unknown, never-reported and unseen for this long gets pruned. Reports are kept. */
export const PRUNE_AGE_MS = 24 * 60 * 60 * 1000;
export const PRUNE_ALARM_NAME = 'rc:prune';
export const PRUNE_ALARM_MINUTES = 360;

/**
 * Bumped whenever a feature ships switched on by default, so the migration can unpin its
 * flag - a settings object written before the feature existed would otherwise keep it off
 * forever. 4 was Themes, 5 Private Servers, 6 Quick Search, 7 Profiles. See FEATURES_INTRODUCED_AT.
 */
export const STORAGE_SCHEMA_VERSION = 7;

/** Give up injecting into a Roblox page after this long rather than retrying forever. */
export const INJECT_TIMEOUT_MS = 8000;

export const STORAGE_KEYS = {
  schemaVersion: 'rc:v',
  settings: 'rc:settings',
  transportMode: 'rc:transport',
  blacklist: 'rc:blacklist',
  customFlags: 'rc:flags',
  playtime: 'rc:playtime',
  reports: (placeId: string) => `rc:reports:${placeId}`,
  history: (placeId: string) => `rc:history:${placeId}`,
  lastJoined: (placeId: string) => `rc:lastJoined:${placeId}`,
} as const;

/** Keeps injected page UI idempotent across React re-renders. */
export const INJECT_MARKER = 'data-rc-injected';
export const PAGE_MESSAGE_NAMESPACE = '__robloxCompanion';

/** How many entries the history list keeps per experience. */
export const HISTORY_LIMIT = 200;
