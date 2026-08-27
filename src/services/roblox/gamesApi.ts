import type { ExperienceContext } from '../../models/experience';
import { gameDetailsUrl, universeIdUrl } from './endpoints';
import type { RobloxHttpClient } from './RobloxHttpClient';

interface UniverseIdResponse {
  universeId?: number;
}

interface GameDetailsResponse {
  data?: Array<{
    id?: number;
    rootPlaceId?: number;
    name?: string;
    playing?: number;
    maxPlayers?: number;
  }>;
}

/**
 * Experience identity. Both endpoints are docs-only, so every caller has to cope with
 * them returning nothing: the extension still works with a bare placeId, it just shows
 * the raw id instead of a name.
 */
export class GamesApi {
  private readonly universeCache = new Map<string, string>();

  constructor(private readonly http: RobloxHttpClient) {}

  async resolveUniverseId(placeId: string): Promise<string | null> {
    const cached = this.universeCache.get(placeId);
    if (cached) return cached;

    try {
      const res = await this.http.getJson<UniverseIdResponse>(universeIdUrl(placeId), {
        cacheTtlMs: 60 * 60 * 1000, // A place never changes universe.
      });
      if (typeof res.universeId !== 'number') return null;
      const universeId = String(res.universeId);
      this.universeCache.set(placeId, universeId);
      return universeId;
    } catch {
      // Identity is a nicety. Failing here must not stop the server browser.
      return null;
    }
  }

  /** Fills in name and maxPlayers where possible; degrades to just the placeId. */
  async describe(placeId: string): Promise<ExperienceContext> {
    const context: ExperienceContext = { placeId };

    const universeId = await this.resolveUniverseId(placeId);
    if (!universeId) return context;
    context.universeId = universeId;

    try {
      const res = await this.http.getJson<GameDetailsResponse>(gameDetailsUrl([universeId]), {
        cacheTtlMs: 5 * 60 * 1000,
      });
      const entry = res.data?.[0];
      if (entry?.name) context.name = entry.name;
      if (typeof entry?.maxPlayers === 'number') context.maxPlayers = entry.maxPlayers;
    } catch {
      // Same reasoning as above.
    }

    return context;
  }
}
