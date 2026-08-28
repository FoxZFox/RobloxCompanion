export type ScoreKey =
  | 'population'
  | 'reputation'
  | 'freshness'
  | 'favorite'
  | 'serverHealth'
  | 'region';

export interface ScoreComponent {
  key: ScoreKey;
  label: string;
  /** Points awarded out of `max`. Zero when `applicable` is false. */
  points: number;
  max: number;
  /** One line the Explain Why panel shows verbatim. */
  reason: string;
  /**
   * False when the underlying data does not exist - an unprobed region, a server we have
   * never seen before so it has no age. Inapplicable components are excluded from BOTH
   * sides of the total rather than scored as zero, because a zero would read as "this
   * server is bad at that" when the truth is "we do not know".
   */
  applicable: boolean;
}

export interface SmartJoinScore {
  jobId: string;
  /** 0-100, normalised over applicable components only. */
  total: number;
  components: ScoreComponent[];
  /** Set when the server was ruled out entirely; `total` is then 0. */
  disqualified?: string;
}

export type PopulationPreference = 'lowest' | 'highest' | 'balanced';

export interface SmartJoinWeights {
  population: number;
  reputation: number;
  freshness: number;
  favorite: number;
  /**
   * How well the server itself is running. NOT how near it is to you - see the
   * serverHealth component in scoring.ts for why those are different questions.
   */
  serverHealth: number;
  region: number;
}

export interface SmartJoinSettings {
  population: PopulationPreference;
  weights: SmartJoinWeights;
  /**
   * Region ids in priority order. Retained because the scoring path is written and
   * tested, but nothing can populate regions today - see regionSource.ts.
   */
  preferredRegions: string[];
  /**
   * Take a private server you can enter here in preference to any public one (§29).
   *
   * Off by default because it changes where the user lands, and that is not a default
   * anyone should discover by surprise. On, it costs one request instead of a whole
   * scan: the private list is asked for and, if it has something joinable, no public
   * page is fetched at all.
   */
  preferOwnPrivateServer: boolean;
}

export const DEFAULT_SMART_JOIN: SmartJoinSettings = {
  population: 'lowest',
  weights: {
    population: 40,
    reputation: 30,
    serverHealth: 20,
    freshness: 15,
    favorite: 10,
    region: 25,
  },
  preferredRegions: [],
  preferOwnPrivateServer: false,
};

export interface Region {
  id: string;
  city: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  flag: string;
  /** Roblox has retired the datacenter; kept so old cached results still resolve. */
  retired?: boolean;
}

export type RegionFailure =
  | 'not-probed'
  | 'no-endpoint'
  | 'unmatched'
  | 'probe-failed'
  | 'no-permission'
  /** Roblox accepted the request but refused to hand back a join script. */
  | 'blocked'
  /** No region source is configured at all - see regionSource.ts for why. */
  | 'no-source';

export interface RegionResult {
  jobId: string;
  region: Region | null;
  /** The public address we matched on, kept for Developer Mode. */
  address?: string;
  /**
   * Why there is no region. `unmatched` means we got an address but no range covers it,
   * which is a gap in our table rather than a fact about the server.
   */
  reason?: RegionFailure;
  /** Roblox's own `status` field, retained so a refusal can be diagnosed not guessed. */
  status?: number;
  /** Roblox's own `message`, when it sends one. */
  message?: string;
}

/**
 * A private server Smart Join took instead of scoring public ones (§29).
 *
 * It carries no score and no breakdown, because none was computed: the preference is a
 * decision the user already made, not a signal weighed against others. Explain Why says
 * that in those words rather than inventing points to justify it after the fact.
 *
 * There is deliberately no access code here. The plan travels in AppState, and a code
 * that grants entry to a private server never does (see models/privateServer.ts).
 */
export interface PrivatePick {
  vipServerId: number;
  name: string;
  playing: number | null;
  maxPlayers: number | null;
  /** One line for Explain Why, in the same voice as a ScoreComponent reason. */
  reason: string;
}

/** What Smart Join decided, including everything needed to explain it. */
export interface SmartJoinPlan {
  /** Null when nothing qualified. */
  chosen: SmartJoinScore | null;
  ranked: SmartJoinScore[];
  /** How many servers were considered, out of how many were loaded. */
  considered: number;
  loaded: number;
  /** True when Roblox's pagination cap means this is a window, not the whole list. */
  capped: boolean;
  /** Regions resolved this run. Always 0 until a region source exists. */
  regionsProbed: number;
  /** Set when a private server was taken instead of scoring public ones. */
  privatePick: PrivatePick | null;
  /**
   * Why there was no private pick, when the preference is switched on. Null when it is
   * off, so the panel can stay silent about a feature the user is not using.
   */
  privateNote: string | null;
}

/**
 * Smart Join is the only settings branch that nests two levels deep, so it needs its own
 * patch type: the generic one-level SettingsPatch would demand a whole RegionProbeSettings
 * just to flip `enabled`.
 */
export interface SmartJoinPatch {
  population?: PopulationPreference;
  weights?: Partial<SmartJoinWeights>;
  preferredRegions?: string[];
  preferOwnPrivateServer?: boolean;
}
