import type { ScanOutcome, ServerView } from '../../models/server';
import type { AvoidSettings } from '../../models/settings';
import type { RegionResult, SmartJoinPlan, SmartJoinSettings } from '../../models/smartJoin';
import type { RegionSource } from './regionSource';
import { rankServers, type ScoringContext } from './scoring';

export interface PlanRequest {
  placeId: string;
  views: ServerView[];
  outcome: ScanOutcome | null;
  settings: SmartJoinSettings;
  avoid: AvoidSettings;
  now?: number;
}

/** Cap on how many servers a region source is asked about in one go. */
const REGION_CANDIDATE_LIMIT = 8;

/**
 * Smart Join (spec sections 5, 27, 28 and 52).
 *
 * Pass A ranks every loaded server using only data we already hold - population,
 * reputation, our own first-seen timestamp, favourites. It costs nothing: no extra
 * request to Roblox is made for a Smart Join, ever.
 *
 * Pass B would fold in each server's datacenter. It runs only when a RegionSource says
 * it can actually answer, and today none can: Roblox gates the one endpoint that reveals
 * a server's location to its own game client (see regionSource.ts). So pass B is skipped
 * entirely rather than attempted and failed, and region is left out of the scoring
 * breakdown instead of appearing as a row that never has a value.
 */
export class SmartJoinService {
  constructor(private readonly regions: RegionSource) {}

  async plan(request: PlanRequest): Promise<SmartJoinPlan> {
    const baseContext: ScoringContext = {
      settings: request.settings,
      avoid: request.avoid,
      ...(request.now !== undefined ? { now: request.now } : {}),
    };

    // Pass A: free, over everything.
    const firstPass = rankServers(request.views, baseContext);

    const loaded = request.views.length;
    const capped = Boolean(request.outcome && !request.outcome.complete);

    if (firstPass.length === 0) {
      return { chosen: null, ranked: [], considered: 0, loaded, capped, regionsProbed: 0 };
    }

    const wantsRegion =
      this.regions.available && request.settings.preferredRegions.length > 0;

    if (!wantsRegion) {
      return {
        chosen: firstPass[0] ?? null,
        ranked: firstPass,
        considered: firstPass.length,
        loaded,
        capped,
        regionsProbed: 0,
      };
    }

    const candidates = firstPass.slice(0, REGION_CANDIDATE_LIMIT).map((score) => score.jobId);
    const regions = await this.regions.lookup({
      placeId: request.placeId,
      jobIds: candidates,
      limit: REGION_CANDIDATE_LIMIT,
    });

    // Pass B: re-rank with whatever region data we now hold.
    const ranked = rankServers(request.views, { ...baseContext, regions });

    return {
      chosen: ranked[0] ?? null,
      ranked,
      considered: ranked.length,
      loaded,
      capped,
      regionsProbed: countResolved(regions),
    };
  }
}

function countResolved(regions: ReadonlyMap<string, RegionResult>): number {
  let resolved = 0;
  for (const result of regions.values()) if (result.region) resolved += 1;
  return resolved;
}
