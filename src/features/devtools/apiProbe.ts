import {
  gameDetailsUrl,
  gameVotesUrl,
  myPrivateServersUrl,
  privateServersEnabledUrl,
  publicServersUrl,
  universeIdUrl,
  usernamesToUsersUrl,
} from '../../services/roblox/endpoints';
import type { RobloxHttpClient } from '../../services/roblox/RobloxHttpClient';

export type ProbeVerdict = 'ok' | 'refused' | 'failed' | 'skipped';

export interface ApiProbeResult {
  id: string;
  label: string;
  /** What the API map currently claims, so the two can be compared. */
  documentedAs: 'verified-live' | 'docs-only' | 'planned';
  verdict: ProbeVerdict;
  detail: string;
  /** Trimmed response, for eyeballing the real shape. */
  sample?: string;
}

export interface ApiProbeContext {
  placeId?: string;
  universeId?: string;
}

const SAMPLE_LIMIT = 400;

function sample(value: unknown): string {
  const text = JSON.stringify(value);
  if (!text) return '';
  return text.length > SAMPLE_LIMIT ? `${text.slice(0, SAMPLE_LIMIT)}…` : text;
}

/**
 * Runs each endpoint the extension depends on and reports what actually came back.
 *
 * This exists because of a mistake worth not repeating. Region detection was built on
 * `join-game-instance` while that endpoint was still marked `docs-only`, and only after
 * the UI shipped did a real call reveal that Roblox refuses browser traffic with
 * `status: 12`. A whole feature had to be withdrawn.
 *
 * Everything in `02_ROBLOX_API_MAP.md` that is still `docs-only` carries the same risk -
 * private servers most of all, since phase 6 is built entirely on five unverified calls.
 * So the order is now: probe first, read the real response, update the map, then build.
 *
 * Every probe here is a plain read. Nothing creates, buys or joins anything.
 */
export class ApiProbe {
  constructor(private readonly http: RobloxHttpClient) {}

  async runAll(context: ApiProbeContext): Promise<ApiProbeResult[]> {
    const results: ApiProbeResult[] = [];
    results.push(await this.publicServers(context));
    results.push(await this.universeLookup(context));
    results.push(await this.gameDetails(context));
    results.push(await this.usernameLookup());
    results.push(await this.votes(context));
    results.push(await this.privateServersEnabled(context));
    results.push(await this.myPrivateServers());
    return results;
  }

  private async votes(context: ApiProbeContext): Promise<ApiProbeResult> {
    const base = { id: 'votes', label: 'Like / dislike counts', documentedAs: 'docs-only' as const };
    if (!context.universeId) {
      return { ...base, verdict: 'skipped', detail: 'Needs a universeId' };
    }

    try {
      const body = await this.http.getJson<{ data?: Array<{ upVotes?: number }> }>(
        gameVotesUrl([context.universeId]),
        { force: true },
      );
      const entry = body.data?.[0];
      return entry
        ? { ...base, verdict: 'ok', detail: `${entry.upVotes ?? '?'} up-votes`, sample: sample(entry) }
        : { ...base, verdict: 'refused', detail: 'Empty data array', sample: sample(body) };
    } catch (err) {
      return { ...base, verdict: 'failed', detail: describe(err) };
    }
  }

  /*
   * The two probes below are the ones that matter most right now: phase 6 is built
   * entirely on the private-server endpoints, and none of them has ever been called. Both
   * are reads - nothing is created and nothing is bought.
   */
  private async privateServersEnabled(context: ApiProbeContext): Promise<ApiProbeResult> {
    const base = {
      id: 'privateServersEnabled',
      label: 'Private servers enabled? (phase 6)',
      documentedAs: 'docs-only' as const,
    };
    if (!context.universeId) {
      return { ...base, verdict: 'skipped', detail: 'Needs a universeId' };
    }

    try {
      const body = await this.http.getJson<{ privateServersEnabled?: boolean }>(
        privateServersEnabledUrl(context.universeId),
        { force: true },
      );
      return typeof body.privateServersEnabled === 'boolean'
        ? {
            ...base,
            verdict: 'ok',
            detail: `privateServersEnabled = ${body.privateServersEnabled}`,
            sample: sample(body),
          }
        : { ...base, verdict: 'refused', detail: 'Field missing', sample: sample(body) };
    } catch (err) {
      return { ...base, verdict: 'failed', detail: describe(err) };
    }
  }

  private async myPrivateServers(): Promise<ApiProbeResult> {
    const base = {
      id: 'myPrivateServers',
      label: 'My private servers (phase 6)',
      documentedAs: 'docs-only' as const,
    };

    try {
      const body = await this.http.getJson<{ data?: unknown[] }>(myPrivateServersUrl(), {
        force: true,
      });
      return Array.isArray(body.data)
        ? {
            ...base,
            verdict: 'ok',
            detail: `${body.data.length} private server(s) on this account`,
            sample: sample(body.data[0] ?? {}),
          }
        : { ...base, verdict: 'refused', detail: 'No data array', sample: sample(body) };
    } catch (err) {
      return { ...base, verdict: 'failed', detail: describe(err) };
    }
  }

  private async publicServers(context: ApiProbeContext): Promise<ApiProbeResult> {
    const base = {
      id: 'servers',
      label: 'Public server list',
      documentedAs: 'verified-live' as const,
    };
    if (!context.placeId) {
      return { ...base, verdict: 'skipped', detail: 'Open a Roblox experience page first' };
    }

    try {
      const body = await this.http.getJson<{ data?: unknown[]; nextPageCursor?: unknown }>(
        publicServersUrl({
          placeId: context.placeId,
          sortOrder: 'Asc',
          excludeFullGames: false,
          limit: 10,
        }),
        { force: true },
      );
      const first = body.data?.[0];
      return {
        ...base,
        verdict: 'ok',
        detail: `${body.data?.length ?? 0} server(s); cursor ${body.nextPageCursor ? 'present' : 'null'}`,
        sample: sample(first),
      };
    } catch (err) {
      return { ...base, verdict: 'failed', detail: describe(err) };
    }
  }

  private async universeLookup(context: ApiProbeContext): Promise<ApiProbeResult> {
    const base = {
      id: 'universe',
      label: 'placeId to universeId',
      documentedAs: 'docs-only' as const,
    };
    if (!context.placeId) {
      return { ...base, verdict: 'skipped', detail: 'Open a Roblox experience page first' };
    }

    try {
      const body = await this.http.getJson<{ universeId?: number }>(
        universeIdUrl(context.placeId),
        { force: true },
      );
      return typeof body.universeId === 'number'
        ? { ...base, verdict: 'ok', detail: `universeId ${body.universeId}`, sample: sample(body) }
        : { ...base, verdict: 'refused', detail: 'Responded without a universeId', sample: sample(body) };
    } catch (err) {
      return { ...base, verdict: 'failed', detail: describe(err) };
    }
  }

  private async gameDetails(context: ApiProbeContext): Promise<ApiProbeResult> {
    const base = {
      id: 'gameDetails',
      label: 'Experience details',
      documentedAs: 'docs-only' as const,
    };
    if (!context.universeId) {
      return { ...base, verdict: 'skipped', detail: 'Needs a universeId, which the probe above resolves' };
    }

    try {
      const body = await this.http.getJson<{ data?: Array<{ name?: string }> }>(
        gameDetailsUrl([context.universeId]),
        { force: true },
      );
      const entry = body.data?.[0];
      return entry
        ? { ...base, verdict: 'ok', detail: `name "${entry.name ?? '?'}"`, sample: sample(entry) }
        : { ...base, verdict: 'refused', detail: 'Empty data array', sample: sample(body) };
    } catch (err) {
      return { ...base, verdict: 'failed', detail: describe(err) };
    }
  }

  /**
   * A POST, so it also exercises the CSRF path in RobloxHttpClient - the only read-only
   * write in the extension, and the one every phase-6 call will depend on.
   */
  private async usernameLookup(): Promise<ApiProbeResult> {
    const base = {
      id: 'usernames',
      label: 'username to userId (also tests CSRF)',
      documentedAs: 'docs-only' as const,
    };

    try {
      const body = await this.http.postJson<{ data?: Array<{ id?: number; name?: string }> }>(
        usernamesToUsersUrl(),
        { usernames: ['Roblox'], excludeBannedUsers: false },
      );
      const entry = body.data?.[0];
      return typeof entry?.id === 'number'
        ? { ...base, verdict: 'ok', detail: `resolved "${entry.name}" to ${entry.id}`, sample: sample(entry) }
        : { ...base, verdict: 'refused', detail: 'No user resolved', sample: sample(body) };
    } catch (err) {
      return { ...base, verdict: 'failed', detail: describe(err) };
    }
  }
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
