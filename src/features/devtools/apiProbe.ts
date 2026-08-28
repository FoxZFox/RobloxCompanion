import {
  OPTIONAL_ORIGINS,
  authenticatedUserUrl,
  avatarUrl,
  friendsUrl,
  gameDetailsUrl,
  gameVotesUrl,
  completedTradesUrl,
  inboundTradesUrl,
  placePrivateServersUrl,
  myPrivateServersUrl,
  omniSearchUrl,
  presenceUrl,
  lastOnlineUrl,
  privateServersEnabledUrl,
  vipServerUrl,
  publicServersUrl,
  universeIdUrl,
  usernamesToUsersUrl,
} from '../../services/roblox/endpoints';
import type { RobloxHttpClient } from '../../services/roblox/RobloxHttpClient';

/**
 * `empty` is the verdict this tool was missing, and the first probe run proved it.
 *
 * Omni-search answered HTTP 200 with an empty result array for the query "obby", which
 * cannot be a true answer - and the probe reported it as working and advised marking the
 * endpoint verified-live. That is exactly the overclaim the probe exists to prevent,
 * committed by the probe itself. An endpoint that answers with nothing to look at has
 * shown us that it responds, and nothing whatever about its shape.
 */
export type ProbeVerdict = 'ok' | 'empty' | 'refused' | 'failed' | 'skipped';

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

type ProbeBase = Pick<ApiProbeResult, 'id' | 'label' | 'documentedAs'>;

/**
 * The verdict for a probe whose answer is a list, in one place so no probe can quietly
 * decide that nothing counts as something.
 *
 * An empty list is deliberately not `ok`. It proves the endpoint answered and nothing
 * else - no field names, no types, nothing to update the API map from. Whether it means
 * "you have no trades" or "these query parameters are wrong" is a question the caller
 * has to look at, which it cannot do if this reports success.
 */
function listVerdict(
  base: ProbeBase,
  list: unknown,
  count: (n: number) => string,
  body: unknown,
): ApiProbeResult {
  if (!Array.isArray(list)) {
    return { ...base, verdict: 'refused', detail: 'No list in the response', sample: sample(body) };
  }
  if (list.length === 0) {
    return {
      ...base,
      verdict: 'empty',
      detail: `${count(0)} — it answered, but there was nothing to look at`,
      sample: sample(body),
    };
  }
  return { ...base, verdict: 'ok', detail: count(list.length), sample: sample(list[0]) };
}

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
 * Everything in `docs/02_ROBLOX_API_MAP.md` that is still `docs-only` carries the same risk -
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
    const mine = await this.myPrivateServers();
    results.push(mine.result);
    results.push(await this.vipServerDetail(mine.firstId));
    results.push(await this.placePrivateServers(context));

    /*
     * Everything below answers "is this phase even possible from a browser extension?"
     * for the phases that are currently blocked - 5 (presence), 7 (quick search),
     * 8 (mutual friends, avatar) and 9 (trading). One run should settle all four.
     *
     * They come after the rest because they need the signed-in user id, and several sit
     * on hosts behind an optional permission that may not have been granted.
     */
    const self = await this.authenticatedUser();
    results.push(self.result);
    results.push(await this.presence(self.userId));
    results.push(await this.lastOnline(self.userId));
    results.push(await this.friends(self.userId));
    results.push(await this.avatar(self.userId));
    results.push(await this.omniSearch());
    results.push(await this.inboundTrades());
    return results;
  }

  /**
   * Who the signed-in user is, and the key that unlocks the self-directed probes below.
   *
   * Asking about oneself is the whole point: the shape of a presence or friends response
   * is the same whoever it describes, so there is no reason to point any of this at
   * another player's account (§13).
   */
  private async authenticatedUser(): Promise<{ result: ApiProbeResult; userId: number | null }> {
    const base = {
      id: 'authenticated',
      label: 'Who am I signed in as',
      documentedAs: 'docs-only' as const,
    };

    try {
      const body = await this.http.getJson<{ id?: number; name?: string }>(authenticatedUserUrl(), {
        force: true,
      });
      if (typeof body.id !== 'number') {
        return {
          result: { ...base, verdict: 'refused', detail: 'No user id in the response', sample: sample(body) },
          userId: null,
        };
      }
      return {
        result: { ...base, verdict: 'ok', detail: `signed in as ${body.name} (${body.id})`, sample: sample(body) },
        userId: body.id,
      };
    } catch (err) {
      return { result: { ...base, verdict: 'failed', detail: describe(err) }, userId: null };
    }
  }

  /**
   * Optional hosts are skipped rather than attempted when access has not been granted.
   *
   * A fetch to a host we hold no permission for fails as a bare network error, which
   * would read as "Roblox refused us" - the one conclusion this tool exists to stop
   * anyone drawing on bad evidence.
   */
  private async hasAccess(origin: string): Promise<boolean> {
    try {
      return await chrome.permissions.contains({ origins: [origin] });
    } catch {
      return false;
    }
  }

  private async presence(userId: number | null): Promise<ApiProbeResult> {
    const base = {
      id: 'presence',
      label: 'Presence — own account (phase 5)',
      documentedAs: 'docs-only' as const,
    };
    if (userId === null) return { ...base, verdict: 'skipped', detail: 'Needs the signed-in user' };
    if (!(await this.hasAccess(OPTIONAL_ORIGINS.presence))) {
      return { ...base, verdict: 'skipped', detail: 'Grant optional access first' };
    }

    try {
      const body = await this.http.postJson<{
        userPresences?: Array<{ userPresenceType?: number; gameId?: string | null }>;
      }>(presenceUrl(), { userIds: [userId] });
      const entry = body.userPresences?.[0];
      if (!entry) {
        return { ...base, verdict: 'refused', detail: 'No presence returned', sample: sample(body) };
      }
      // Whether gameId comes back at all is the question phase 5 hangs on: it is the only
      // way to tell which server someone is in, and Roblox withholds it by privacy.
      return {
        ...base,
        verdict: 'ok',
        detail: entry.gameId ? 'gameId present for own account' : 'gameId is null even for own account',
        sample: sample(entry),
      };
    } catch (err) {
      return { ...base, verdict: 'failed', detail: describe(err) };
    }
  }

  /**
   * When each of a list of users was last online (phase 8's "last online").
   *
   * Worth a probe of its own even though presence is already verified: they are separate
   * endpoints with separate privacy rules, and `presence/users` answering says nothing
   * about whether this one will. Pointed at the signed-in account, like every probe here.
   *
   * The shape question it settles is whether a timestamp comes back at all, and under
   * what field name - the map records neither, because nobody has ever called it.
   */
  private async lastOnline(userId: number | null): Promise<ApiProbeResult> {
    const base = {
      id: 'lastOnline',
      label: 'Last online — own account (phase 8)',
      documentedAs: 'planned' as const,
    };
    if (userId === null) return { ...base, verdict: 'skipped', detail: 'Needs the signed-in user' };
    if (!(await this.hasAccess(OPTIONAL_ORIGINS.presence))) {
      return { ...base, verdict: 'skipped', detail: 'Grant optional access first' };
    }

    try {
      const body = await this.http.postJson<{
        lastOnlineTimestamps?: Array<{ userId?: number; lastOnline?: string }>;
      }>(lastOnlineUrl(), { userIds: [userId] });

      const entry = body.lastOnlineTimestamps?.[0];
      if (!entry) {
        // Not a failure: the endpoint answered, in a shape the docs did not describe. That
        // is precisely the difference this tool exists to record.
        return {
          ...base,
          verdict: 'empty',
          detail: 'Answered, but not with the documented lastOnlineTimestamps list',
          sample: sample(body),
        };
      }
      return {
        ...base,
        verdict: entry.lastOnline ? 'ok' : 'empty',
        detail: entry.lastOnline
          ? `last online ${entry.lastOnline}`
          : 'The entry came back without a timestamp',
        sample: sample(entry),
      };
    } catch (err) {
      return { ...base, verdict: 'failed', detail: describe(err) };
    }
  }

  private async friends(userId: number | null): Promise<ApiProbeResult> {
    const base = {
      id: 'friends',
      label: 'Friends list (phase 8 mutual friends)',
      documentedAs: 'docs-only' as const,
    };
    if (userId === null) return { ...base, verdict: 'skipped', detail: 'Needs the signed-in user' };
    if (!(await this.hasAccess(OPTIONAL_ORIGINS.friends))) {
      return { ...base, verdict: 'skipped', detail: 'Grant optional access first' };
    }

    try {
      const body = await this.http.getJson<{ data?: unknown[] }>(friendsUrl(userId), { force: true });
      return listVerdict(base, body.data, (n) => `${n} friend(s) readable`, body);
    } catch (err) {
      return { ...base, verdict: 'failed', detail: describe(err) };
    }
  }

  private async avatar(userId: number | null): Promise<ApiProbeResult> {
    const base = {
      id: 'avatar',
      label: 'Own avatar (phase 8 avatar tools)',
      documentedAs: 'docs-only' as const,
    };
    if (userId === null) return { ...base, verdict: 'skipped', detail: 'Needs the signed-in user' };
    if (!(await this.hasAccess(OPTIONAL_ORIGINS.avatar))) {
      return { ...base, verdict: 'skipped', detail: 'Grant optional access first' };
    }

    try {
      const body = await this.http.getJson<{ assets?: unknown[]; playerAvatarType?: string }>(
        avatarUrl(userId),
        { force: true },
      );
      return listVerdict(
        base,
        body.assets,
        (n) => `${n} asset(s) worn, type ${body.playerAvatarType ?? '?'}`,
        body,
      );
    } catch (err) {
      return { ...base, verdict: 'failed', detail: describe(err) };
    }
  }

  private async omniSearch(): Promise<ApiProbeResult> {
    const base = {
      id: 'omniSearch',
      label: 'Experience search (phase 7 quick search)',
      documentedAs: 'docs-only' as const,
    };

    try {
      /*
       * Now with a sessionId, which the first run did not send.
       *
       * That run came back `{searchResults: [], nextPageToken: "", filteredSearchQuery: ""}`
       * for the query "obby" - one of the most common words on Roblox, so the empty result
       * was a fact about our parameters, not about the query. `sessionId` is what Roblox's
       * own search page sends and we did not; ruling it out is the cheapest next step.
       */
      const body = await this.http.getJson<{ searchResults?: unknown[] }>(
        omniSearchUrl('obby', crypto.randomUUID()),
        { force: true },
      );
      return listVerdict(base, body.searchResults, (n) => `${n} result group(s) for "obby"`, body);
    } catch (err) {
      return { ...base, verdict: 'failed', detail: describe(err) };
    }
  }

  /**
   * Which private servers this place says can be joined.
   *
   * The last question phase 6's join button depends on. `vip-servers/{id}` describes a
   * server the user owns and answered `joinCode: null`; this asks a different question -
   * what can be joined here - and a list meant for joining ought to carry the means to
   * join. If this carries nothing either, joining costs a write, and this extension will
   * not make one on its own.
   */
  private async placePrivateServers(context: ApiProbeContext): Promise<ApiProbeResult> {
    const base = {
      id: 'placePrivateServers',
      label: 'Private servers on this place — do they carry a code? (phase 6)',
      documentedAs: 'docs-only' as const,
    };
    if (!context.placeId) return { ...base, verdict: 'skipped', detail: 'Needs a place' };

    try {
      const body = await this.http.getJson<{ data?: Array<Record<string, unknown>> }>(
        placePrivateServersUrl(context.placeId),
        { force: true },
      );
      if (!Array.isArray(body.data)) {
        return { ...base, verdict: 'refused', detail: 'No data array', sample: sample(body) };
      }

      const first = body.data[0];
      if (!first) {
        return {
          ...base,
          verdict: 'empty',
          detail: 'Nothing listed here — run this on a game where you own a private server',
          sample: sample(body),
        };
      }

      const codeField = ['accessCode', 'joinCode', 'link', 'privateServerLinkCode'].find(
        (key) => typeof first[key] === 'string' && first[key],
      );
      return codeField
        ? {
            ...base,
            verdict: 'ok',
            detail: `join code readable via "${codeField}"`,
            sample: sample(first),
          }
        : {
            ...base,
            verdict: 'refused',
            detail: 'Lists servers but carries no join code',
            sample: sample(first),
          };
    } catch (err) {
      return { ...base, verdict: 'failed', detail: describe(err) };
    }
  }

  /** Read-only, and only the user's own inbox. Nothing is accepted, declined or sent. */
  private async inboundTrades(): Promise<ApiProbeResult> {
    const base = {
      id: 'trades',
      label: 'Inbound trades (phase 9)',
      documentedAs: 'docs-only' as const,
    };
    if (!(await this.hasAccess(OPTIONAL_ORIGINS.trades))) {
      return { ...base, verdict: 'skipped', detail: 'Grant optional access first' };
    }

    try {
      const body = await this.http.getJson<{ data?: unknown[] }>(inboundTradesUrl(), { force: true });
      if (Array.isArray(body.data) && body.data.length > 0) {
        return listVerdict(base, body.data, (n) => `${n} inbound trade(s)`, body);
      }

      /*
       * An empty inbox is the normal case, and it shows nothing of a trade's shape - which
       * is the only thing phase 9 needs from this probe. Completed trades answer the same
       * question and are equally read-only, so fall through to those rather than reporting
       * a dead end that is really just a quiet account.
       */
      const completed = await this.http.getJson<{ data?: unknown[] }>(completedTradesUrl(), {
        force: true,
      });
      return listVerdict(
        { ...base, label: 'Trades — inbox empty, checked completed instead (phase 9)' },
        completed.data,
        (n) => `${n} completed trade(s)`,
        completed,
      );
    } catch (err) {
      return { ...base, verdict: 'failed', detail: describe(err) };
    }
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

  private async myPrivateServers(): Promise<{ result: ApiProbeResult; firstId: number | null }> {
    const base = {
      id: 'myPrivateServers',
      label: 'My private servers (phase 6)',
      documentedAs: 'docs-only' as const,
    };

    try {
      const body = await this.http.getJson<{ data?: Array<{ privateServerId?: number }> }>(
        myPrivateServersUrl(),
        { force: true },
      );
      const result = listVerdict(
        base,
        body.data,
        (n) => `${n} private server(s) on this account`,
        body,
      );
      return { result, firstId: body.data?.[0]?.privateServerId ?? null };
    } catch (err) {
      return { result: { ...base, verdict: 'failed', detail: describe(err) }, firstId: null };
    }
  }

  /**
   * Whether one private server's access code can be read without writing anything.
   *
   * This is the question phase 6 turns on. The list endpoint carries no code, and the
   * documented alternative is a PATCH - which can regenerate the link and break the one
   * the user already shared. If this GET carries the code, joining costs nothing; if it
   * does not, phase 6 ships without a join button rather than with a write nobody asked
   * for (§8).
   */
  private async vipServerDetail(privateServerId: number | null): Promise<ApiProbeResult> {
    const base = {
      id: 'vipServerDetail',
      label: 'One private server — is the join code readable? (phase 6)',
      documentedAs: 'docs-only' as const,
    };
    if (privateServerId === null) {
      return { ...base, verdict: 'skipped', detail: 'Needs a private server on this account' };
    }

    try {
      const body = await this.http.getJson<Record<string, unknown>>(vipServerUrl(privateServerId), {
        force: true,
      });
      // Roblox has used several names for this over the years, so the probe reports which
      // one came back rather than assuming any of them.
      const codeField = ['accessCode', 'joinCode', 'link', 'privateServerLinkCode'].find(
        (key) => typeof body[key] === 'string' && body[key],
      );
      return codeField
        ? { ...base, verdict: 'ok', detail: `join code readable via "${codeField}"`, sample: sample(body) }
        : {
            ...base,
            verdict: 'refused',
            detail: 'Answered, but carries no join code — joining would need a write',
            sample: sample(body),
          };
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
