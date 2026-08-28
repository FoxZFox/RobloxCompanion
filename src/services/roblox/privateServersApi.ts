import type { JoinablePrivateServer, PrivateServer } from '../../models/privateServer';
import {
  parseJoinable,
  parsePrivateServer,
  type RawJoinableServer,
  type RawPrivateServer,
} from '../../features/privateServers/privateServers';
import { myPrivateServersUrl, placePrivateServersUrl, privateServersEnabledUrl } from './endpoints';
import type { RobloxHttpClient } from './RobloxHttpClient';

/**
 * The private-server calls that have actually been made (phase 6).
 *
 * Every one was verified live on 28 Aug 2026 through the API probe before a line of this
 * was written - the order this project got wrong once and does not intend to get wrong
 * again. Creating a private server costs Robux and stays out of the codebase entirely
 * (§8); `PATCH vip-servers/{id}` stays out because it can regenerate a link the user has
 * already shared.
 */
export class PrivateServersApi {
  constructor(private readonly http: RobloxHttpClient) {}

  /**
   * Whether this experience offers private servers at all.
   *
   * A `false` here is a fact worth showing: it is the difference between "you own none"
   * and "you cannot own one", which look identical in an empty list.
   */
  async enabledInUniverse(universeId: string): Promise<boolean | null> {
    try {
      const body = await this.http.getJson<{ privateServersEnabled?: boolean }>(
        privateServersEnabledUrl(universeId),
      );
      return typeof body.privateServersEnabled === 'boolean' ? body.privateServersEnabled : null;
    } catch {
      // Unknown, which the UI renders as unknown. Guessing "enabled" would send someone
      // looking for a button Roblox never offered them.
      return null;
    }
  }

  /** Every private server on this account, across all experiences. */
  async mine(): Promise<PrivateServer[]> {
    const body = await this.http.getJson<{ data?: RawPrivateServer[] }>(myPrivateServersUrl());
    if (!Array.isArray(body.data)) return [];
    return body.data
      .map(parsePrivateServer)
      .filter((server): server is PrivateServer => server !== null);
  }

  /**
   * Private servers joinable at this place, with their access codes.
   *
   * Verified 28 Aug 2026, and it is what settled phase 6: this list carries `accessCode`,
   * so joining needs no write at all - unlike `vip-servers/{id}`, which answered
   * `joinCode: null` and left a PATCH as the only alternative. Two probes to establish
   * that, and both were worth it.
   *
   * Codes are returned to the caller rather than folded into the view model, because they
   * must not travel any further than the service worker.
   */
  async joinableAtPlace(
    placeId: string,
  ): Promise<Array<{ server: JoinablePrivateServer; accessCode: string }>> {
    const body = await this.http.getJson<{ data?: RawJoinableServer[] }>(
      placePrivateServersUrl(placeId),
    );
    if (!Array.isArray(body.data)) return [];
    return body.data
      .map(parseJoinable)
      .filter((entry): entry is { server: JoinablePrivateServer; accessCode: string } => entry !== null);
  }
}
