import type { ServerView } from '../../models/server';
import { isFull } from '../../models/server';
import type { AvoidSettings } from '../../models/settings';
import type {
  RegionResult,
  ScoreComponent,
  SmartJoinScore,
  SmartJoinSettings,
} from '../../models/smartJoin';
import { isAvoided } from '../servers/serverFilters';

/** A server we first saw this recently counts as fresh; older decays to zero. */
const FRESHNESS_WINDOW_MS = 30 * 60 * 1000;

export interface ScoringContext {
  settings: SmartJoinSettings;
  avoid: AvoidSettings;
  /** Ids of the user's own flags marked "avoid" (spec section 22). */
  avoidableFlags?: ReadonlySet<string>;
  /** Region results by jobId. Absent means "not probed", not "no region". */
  regions?: ReadonlyMap<string, RegionResult>;
  now?: number;
}

/**
 * Scores one server (spec sections 27 and 28).
 *
 * Pure by construction: no Roblox calls, no storage, no clock unless injected. That is
 * what lets the whole ranking be tested without opening Roblox, which spec section 46
 * asks for specifically.
 *
 * The scoring rule that matters most is how missing data is handled. A component whose
 * data does not exist is marked inapplicable and dropped from both the numerator and the
 * denominator, so a server with no region probe is not quietly punished for it - it is
 * simply scored on what we actually know. Scoring it zero would make "unknown" and "bad"
 * indistinguishable, which is the mistake this project exists to avoid.
 */
export function scoreServer(view: ServerView, ctx: ScoringContext): SmartJoinScore {
  const disqualification = disqualify(view, ctx.avoid, ctx.avoidableFlags);
  if (disqualification) {
    return { jobId: view.jobId, total: 0, components: [], disqualified: disqualification };
  }

  const components = [
    populationComponent(view, ctx),
    reputationComponent(view, ctx),
    serverHealthComponent(view, ctx),
    freshnessComponent(view, ctx),
    favoriteComponent(view, ctx),
  ];

  // Region is included only when something could actually answer. Rendering a row that
  // permanently reads "not checked" would be noise, not honesty - the reason region is
  // unavailable belongs in Settings once, not against every server forever.
  if (ctx.regions) components.push(regionComponent(view, ctx));

  return { jobId: view.jobId, total: normalise(components), components };
}

export function rankServers(views: ServerView[], ctx: ScoringContext): SmartJoinScore[] {
  return views
    .map((view) => scoreServer(view, ctx))
    .filter((score) => score.disqualified === undefined)
    .sort((a, b) => b.total - a.total || a.jobId.localeCompare(b.jobId));
}

/**
 * Totals only what we could actually judge, then scales to 0-100.
 *
 * Returns 0 when nothing was applicable, which happens only if every weight is zero.
 */
function normalise(components: ScoreComponent[]): number {
  const applicable = components.filter((component) => component.applicable);
  const max = applicable.reduce((sum, component) => sum + component.max, 0);
  if (max <= 0) return 0;
  const points = applicable.reduce((sum, component) => sum + component.points, 0);
  return Math.round((points / max) * 100);
}

function disqualify(
  view: ServerView,
  avoid: AvoidSettings,
  avoidableFlags?: ReadonlySet<string>,
): string | undefined {
  if (isFull(view)) return 'Server is full';
  if (avoidableFlags?.size) {
    for (const flagId of view.customFlagIds) {
      if (avoidableFlags.has(flagId)) return 'One of your own flags marks this to avoid';
    }
  }
  if (isAvoided(view, avoid)) {
    if (view.status === 'exploiters') return 'You flagged this server for exploiters';
    if (view.status === 'bugged') return 'You flagged this server as bugged';
    return 'You marked this server as one to avoid';
  }
  return undefined;
}

function populationComponent(view: ServerView, ctx: ScoringContext): ScoreComponent {
  const max = ctx.settings.weights.population;
  const capacity = view.maxPlayers;

  if (capacity <= 0) {
    return {
      key: 'population',
      label: 'Population',
      points: 0,
      max,
      reason: 'Roblox did not report this server capacity',
      applicable: false,
    };
  }

  const occupancy = Math.min(1, view.playing / capacity);
  const preference = ctx.settings.population;

  // "balanced" peaks at half full: enough players for the game to function, not so many
  // that it is about to fill up.
  const ratio =
    preference === 'lowest'
      ? 1 - occupancy
      : preference === 'highest'
        ? occupancy
        : 1 - Math.abs(occupancy - 0.5) * 2;

  const describe =
    preference === 'lowest'
      ? occupancy <= 0.34
        ? 'Nearly empty'
        : occupancy <= 0.67
          ? 'Moderately busy'
          : 'Close to full'
      : preference === 'highest'
        ? occupancy >= 0.67
          ? 'Busy, as you prefer'
          : 'Quieter than you prefer'
        : 'Judged against a half-full target';

  return {
    key: 'population',
    label: 'Population',
    points: round(ratio * max),
    max,
    reason: `${describe} (${view.playing}/${capacity})`,
    applicable: true,
  };
}

function reputationComponent(view: ServerView, ctx: ScoringContext): ScoreComponent {
  const max = ctx.settings.weights.reputation;

  // Flagged servers never reach here - they are disqualified outright - so this only
  // distinguishes "you checked it and it was fine" from "nobody has checked".
  if (view.status === 'clean') {
    return {
      key: 'reputation',
      label: 'Reputation',
      points: max,
      max,
      reason: 'You marked this server clean',
      applicable: true,
    };
  }

  return {
    key: 'reputation',
    label: 'Reputation',
    points: round(max * 0.5),
    max,
    reason: 'Never checked, so nothing is known either way',
    applicable: true,
  };
}

/**
 * Server age, approximated.
 *
 * Roblox exposes no server start time, so the only age signal available is when this
 * extension first saw the server. That makes it genuinely unknown for any server we are
 * seeing for the first time, which is marked inapplicable rather than guessed at.
 */
function freshnessComponent(view: ServerView, ctx: ScoringContext): ScoreComponent {
  const max = ctx.settings.weights.freshness;
  const now = ctx.now ?? Date.now();

  if (view.firstSeenAt === undefined) {
    return {
      key: 'freshness',
      label: 'Freshness',
      points: 0,
      max,
      reason: 'First time we have seen this server, so its age is unknown',
      applicable: false,
    };
  }

  const age = Math.max(0, now - view.firstSeenAt);
  const ratio = Math.max(0, 1 - age / FRESHNESS_WINDOW_MS);

  return {
    key: 'freshness',
    label: 'Freshness',
    points: round(ratio * max),
    max,
    reason:
      ratio > 0.5
        ? 'We first saw this server recently'
        : 'We have been seeing this server for a while',
    applicable: true,
  };
}

/** Roblox servers simulate at 60Hz; below this they are visibly struggling. */
const FPS_TARGET = 60;
const FPS_FLOOR = 30;
/** Average player latency at or under this is healthy; at or over the ceiling is not. */
const PING_FLOOR = 50;
const PING_CEILING = 250;

/**
 * How well the server itself is running, from the two numbers Roblox reports.
 *
 * WHAT THIS IS NOT: it is not how far the server is from you, and it must never be
 * presented that way. `ping` is the average across the players already inside that
 * server, measured from them to it. Roblox matches players to nearby servers, so a
 * Singapore server full of Singaporeans and a Dallas server full of Texans both report a
 * low number - the value cannot separate "near you" from "far from you" at all. The one
 * signal that could is the datacenter, and Roblox does not expose it to a browser
 * (see regionSource.ts).
 *
 * WHAT IT IS: a high average ping means the people in that server are having a bad time
 * on it, and a low `fps` means the server is overloaded. Both are worth avoiding on
 * their own merits, whoever you are and wherever you sit.
 */
function serverHealthComponent(view: ServerView, ctx: ScoringContext): ScoreComponent {
  const max = ctx.settings.weights.serverHealth;
  const ratios: number[] = [];
  const notes: string[] = [];

  if (view.fps !== undefined) {
    ratios.push(clamp((view.fps - FPS_FLOOR) / (FPS_TARGET - FPS_FLOOR)));
    notes.push(
      view.fps >= FPS_TARGET - 5
        ? `running at ${Math.round(view.fps)} FPS`
        : `only ${Math.round(view.fps)} FPS - overloaded`,
    );
  }

  if (view.ping !== undefined) {
    ratios.push(clamp(1 - (view.ping - PING_FLOOR) / (PING_CEILING - PING_FLOOR)));
    notes.push(
      view.ping <= PING_FLOOR * 2
        ? `players in it average ${Math.round(view.ping)}ms to it`
        : `players in it average ${Math.round(view.ping)}ms to it - poor for them`,
    );
  }

  if (ratios.length === 0) {
    return {
      key: 'serverHealth',
      label: 'Health',
      points: 0,
      max,
      reason: 'Roblox reported no FPS or ping for this server',
      applicable: false,
    };
  }

  const ratio = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;

  return {
    key: 'serverHealth',
    label: 'Health',
    points: round(ratio * max),
    max,
    // Deliberately worded around the server and its current players, never around you.
    reason: `Server ${notes.join(', ')}`,
    applicable: true,
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function favoriteComponent(view: ServerView, ctx: ScoringContext): ScoreComponent {
  const max = ctx.settings.weights.favorite;
  return {
    key: 'favorite',
    label: 'Favourite',
    points: view.favorite ? max : 0,
    max,
    reason: view.favorite ? 'One of your favourites' : 'Not a favourite',
    applicable: view.favorite,
  };
}

/**
 * Region preference.
 *
 * Inapplicable unless the server was actually probed AND matched. "Not probed" and
 * "probed but our table has no range covering that address" are different facts from
 * "wrong region", and the panel says which one it was.
 */
function regionComponent(view: ServerView, ctx: ScoringContext): ScoreComponent {
  const max = ctx.settings.weights.region;
  const preferred = ctx.settings.preferredRegions;
  const result = ctx.regions?.get(view.jobId);

  if (!result || !result.region) {
    return {
      key: 'region',
      label: 'Region',
      points: 0,
      max,
      reason: describeMissingRegion(result),
      applicable: false,
    };
  }

  const label = `${result.region.flag} ${result.region.city}`;

  if (preferred.length === 0) {
    return {
      key: 'region',
      label: 'Region',
      points: 0,
      max,
      reason: `${label} - you have not set any preferred regions`,
      applicable: false,
    };
  }

  const rank = preferred.indexOf(result.region.id);
  if (rank === -1) {
    return {
      key: 'region',
      label: 'Region',
      points: 0,
      max,
      reason: `${label} - not one of your preferred regions`,
      applicable: true,
    };
  }

  // First choice scores full marks, each subsequent choice a step less.
  const ratio = 1 - rank / preferred.length;
  return {
    key: 'region',
    label: 'Region',
    points: round(ratio * max),
    max,
    reason: `${label} - preference #${rank + 1}`,
    applicable: true,
  };
}

function describeMissingRegion(result: RegionResult | undefined): string {
  switch (result?.reason) {
    case 'no-source':
      return 'No region source is available';
    case 'blocked':
      // Roblox answered and said no. Naming the status is what lets the user see this
      // is a permanent limitation rather than a transient hiccup.
      return `Roblox refused the lookup${
        result.status !== undefined ? ` (status ${result.status})` : ''
      } - this endpoint appears to be restricted to the game client`;
    case 'no-endpoint':
      return 'Roblox returned no public address for this server';
    case 'unmatched':
      return 'Address is outside our region table, so the location is unknown';
    case 'probe-failed':
      return 'Region lookup failed for this server';
    case 'no-permission':
      return 'Region lookup needs permission for gamejoin.roblox.com';
    case 'not-probed':
    default:
      return 'Region not checked';
  }
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
