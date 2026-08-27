import { DEFAULT_SCAN_PAGES, FALLBACK_PAGE_LIMIT, PAGE_LIMIT } from '../../config/constants';
import type { LiveServer, ScanOutcome } from '../../models/server';
import type { SortOrder } from '../../models/settings';
import { publicServersUrl } from '../../services/roblox/endpoints';
import type { RobloxHttpClient } from '../../services/roblox/RobloxHttpClient';
import { normalizeServersPage, toLiveServer } from '../../services/roblox/serversApi';

export interface ScanRequest {
  placeId: string;
  sort: SortOrder;
  excludeFull: boolean;
  /** Bypass the request cache; used by an explicit Refresh. */
  force?: boolean;
  maxPages?: number;
  /** Continue a previous run instead of starting over. */
  from?: ScanOutcome | null;
}

export type ProgressCallback = (scanned: number, page: number) => void;

/**
 * Paginates the public server list.
 *
 * The important output is not just the servers but *how complete the list is*.
 * Roblox caps pagination somewhere between ~150 and ~500 servers and then returns a
 * null cursor as though the list simply ended, so without tracking `complete` and
 * `truncated` the UI would confidently claim to show every server in an experience
 * while showing a fraction of them (spec section 33).
 */
export class ServerListService {
  constructor(private readonly http: RobloxHttpClient) {}

  async scan(request: ScanRequest, onProgress?: ProgressCallback): Promise<ScanOutcome> {
    const maxPages = request.maxPages ?? DEFAULT_SCAN_PAGES;
    const previous = request.from;

    const servers: LiveServer[] = previous ? [...previous.servers] : [];
    const seen = new Set(servers.map((s) => s.jobId));

    let cursor: string | null = previous?.cursor ?? null;
    let pagesFetched = 0;
    let complete = false;
    // The cursor is bound to both the serverType spelling and the limit, so the limit
    // must not change partway through a run. It is chosen once, here.
    let limit = PAGE_LIMIT;

    while (pagesFetched < maxPages) {
      const url = publicServersUrl({
        placeId: request.placeId,
        sortOrder: request.sort,
        excludeFullGames: request.excludeFull,
        limit,
        cursor,
      });

      const page = normalizeServersPage(
        await this.http.getJson<unknown>(url, request.force ? { force: true } : {}),
      );
      pagesFetched += 1;

      // measured: limit=100 intermittently returns an empty data array. Retrying the
      // same cursor at 50 recovers it; a genuinely empty page ends the scan.
      if (page.data.length === 0 && limit === PAGE_LIMIT && page.nextPageCursor) {
        limit = FALLBACK_PAGE_LIMIT;
        continue;
      }

      for (const raw of page.data) {
        if (seen.has(raw.id)) continue;
        seen.add(raw.id);
        servers.push(toLiveServer(raw));
      }

      onProgress?.(servers.length, pagesFetched);

      cursor = page.nextPageCursor;
      if (!cursor) {
        complete = true;
        break;
      }
    }

    return {
      placeId: request.placeId,
      servers,
      complete,
      truncated: !complete && cursor !== null,
      filtered: request.excludeFull,
      cursor,
      pagesFetched: (previous?.pagesFetched ?? 0) + pagesFetched,
      scannedAt: Date.now(),
    };
  }

  /** One more page onto an existing outcome, for the "Load More" button. */
  async loadMore(request: ScanRequest, outcome: ScanOutcome): Promise<ScanOutcome> {
    if (!outcome.cursor) return outcome;
    return this.scan({ ...request, from: outcome, maxPages: 1 });
  }
}
