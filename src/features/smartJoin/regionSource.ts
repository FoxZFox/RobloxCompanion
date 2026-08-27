import type { RegionResult } from '../../models/smartJoin';

export interface RegionLookup {
  placeId: string;
  jobIds: string[];
  limit: number;
}

/**
 * Where a server's datacenter would come from, if we had a way to ask.
 *
 * The interface exists and the implementation does not, deliberately (spec section 34:
 * separate the interface first, add a backend only for features that genuinely need one).
 *
 * WHY THERE IS NO BROWSER IMPLEMENTATION
 *
 * Roblox publishes no endpoint that reports where a server runs. The only call that
 * reveals it is `POST gamejoin.roblox.com/v1/join-game-instance`, which returns the
 * server's public address inside `joinScript.UdmuxEndpoints[0].Address`.
 *
 * Verified live on 27 Aug 2026: that endpoint answers a browser-originated request with
 * `status: 12` and no join script. Requests that succeed carry `User-Agent: Roblox/WinInet`
 * alongside the session cookie, and `User-Agent` is a forbidden header name that the
 * Fetch spec does not let an extension set. Rewriting it through declarativeNetRequest
 * would mean impersonating the game client to defeat a check that exists precisely to
 * tell the client apart from the website, so this project does not do it (spec section 55).
 *
 * That leaves exactly one legitimate route: a backend of our own that performs the
 * lookup server-side and returns the result. Spec section 34 names "server region
 * database" as a legitimate reason to run one - it is simply out of scope for a
 * local-first V1, which is why this interface has only a null implementation today.
 */
export interface RegionSource {
  /** Resolve regions for the given servers. May return fewer entries than asked for. */
  lookup(request: RegionLookup): Promise<Map<string, RegionResult>>;
  /** Cached answers only; never performs work. */
  cached(jobIds: string[]): Map<string, RegionResult>;
  /** False when this source cannot answer at all, so callers can skip the round trip. */
  readonly available: boolean;
}

/**
 * The only source that ships today: it reports that region data is unavailable.
 *
 * Because `available` is false, Smart Join never asks it anything and the region signal
 * is left out of scoring entirely rather than shown as a permanently empty row.
 */
export class UnavailableRegionSource implements RegionSource {
  readonly available = false;

  async lookup(request: RegionLookup): Promise<Map<string, RegionResult>> {
    return this.cached(request.jobIds);
  }

  cached(jobIds: string[]): Map<string, RegionResult> {
    const results = new Map<string, RegionResult>();
    for (const jobId of jobIds) {
      results.set(jobId, { jobId, region: null, reason: 'no-source' });
    }
    return results;
  }
}
