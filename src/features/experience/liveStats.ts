import { gameDetailsUrl, gameVotesUrl } from '../../services/roblox/endpoints';
import type { RobloxHttpClient } from '../../services/roblox/RobloxHttpClient';

export interface LiveExperienceStats {
  universeId: string;
  playing?: number;
  visits?: number;
  maxPlayers?: number;
  upVotes?: number;
  downVotes?: number;
  /** When we fetched this, so the UI can say how fresh it is. */
  fetchedAt: number;
}

interface GameDetailsResponse {
  data?: Array<{
    id?: number;
    playing?: number;
    visits?: number;
    maxPlayers?: number;
  }>;
}

interface VotesResponse {
  data?: Array<{ id?: number; upVotes?: number; downVotes?: number }>;
}

/** Live numbers change constantly, but not fast enough to justify hammering the API. */
export const STATS_TTL_MS = 60_000;

/**
 * Whether a refresh is worth making.
 *
 * Shared by the auto-refresh so the decision lives in one place: the request scheduler
 * caches for the same window, so asking more often than this would be answered from
 * cache anyway - it would just add message traffic for nothing.
 */
export function statsAreStale(
  stats: { fetchedAt: number } | null,
  now = Date.now(),
): boolean {
  if (!stats) return true;
  return now - stats.fetchedAt > STATS_TTL_MS;
}

/**
 * Live like, dislike and player counts for an experience (spec section 23).
 *
 * RoPro charges for this on its Plus tier; both endpoints are plain public GETs on the
 * same host as the server list, so there is no reason it should not be free here.
 *
 * Every field is optional and every failure is swallowed. These are decoration on top of
 * the server tools - a votes endpoint that changes shape should cost the user a like
 * count, never the ability to join a server.
 */
export class LiveStatsService {
  constructor(private readonly http: RobloxHttpClient) {}

  async fetch(universeId: string): Promise<LiveExperienceStats | null> {
    const [details, votes] = await Promise.all([
      this.fetchDetails(universeId),
      this.fetchVotes(universeId),
    ]);

    if (!details && !votes) return null;

    const stats: LiveExperienceStats = { universeId, fetchedAt: Date.now() };
    if (details?.playing !== undefined) stats.playing = details.playing;
    if (details?.visits !== undefined) stats.visits = details.visits;
    if (details?.maxPlayers !== undefined) stats.maxPlayers = details.maxPlayers;
    if (votes?.upVotes !== undefined) stats.upVotes = votes.upVotes;
    if (votes?.downVotes !== undefined) stats.downVotes = votes.downVotes;
    return stats;
  }

  private async fetchDetails(universeId: string) {
    try {
      const body = await this.http.getJson<GameDetailsResponse>(gameDetailsUrl([universeId]), {
        cacheTtlMs: STATS_TTL_MS,
      });
      return body.data?.[0] ?? null;
    } catch {
      return null;
    }
  }

  private async fetchVotes(universeId: string) {
    try {
      const body = await this.http.getJson<VotesResponse>(gameVotesUrl([universeId]), {
        cacheTtlMs: STATS_TTL_MS,
      });
      return body.data?.[0] ?? null;
    } catch {
      return null;
    }
  }
}

/**
 * Share of likes, or null when there are no votes at all.
 *
 * Null rather than 0%: a brand new experience with no votes has an unknown reception, not
 * a bad one, and the two must not render the same way.
 */
export function approvalRatio(stats: LiveExperienceStats | null): number | null {
  if (!stats) return null;
  const up = stats.upVotes ?? 0;
  const down = stats.downVotes ?? 0;
  const total = up + down;
  if (total === 0) return null;
  return up / total;
}

export function formatVoteCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}
