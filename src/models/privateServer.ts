/**
 * Private servers the signed-in user owns (phase 6).
 *
 * Every field here was read off a real response on 28 Aug 2026, not from Roblox's docs -
 * which is the whole reason this phase sat blocked for as long as it did. What the
 * response does NOT carry is an access code, so nothing in this model can join anything:
 * see 02_ROBLOX_API_MAP.md section 4.
 */
export interface PrivateServer {
  privateServerId: number;
  name: string;
  universeId: string;
  placeId: string;
  /** Roblox's own name for the experience, so a list of servers reads as a list of games. */
  universeName: string;
  active: boolean;
  /** Epoch millis, parsed from Roblox's ISO string. */
  expiresAt: number | null;
  willRenew: boolean;
  /**
   * Robux per renewal, or null when there is nothing to pay.
   *
   * Read per user, never per game: since 30 Apr 2026 Premium subscribers get private
   * servers free even on experiences that charge, so a price on the game page says
   * nothing about what this account would be charged.
   */
  priceInRobux: number | null;
}

/** What the panel renders: the servers for the experience in front of you, plus the rest. */
export interface PrivateServerState {
  /** null when the experience has not been checked, e.g. no game page open. */
  enabledHere: boolean | null;
  /** Private servers joinable at the current place, owned or shared with this account. */
  joinableHere: JoinablePrivateServer[];
  /** Owned servers belonging to the current experience. */
  here: PrivateServer[];
  /** Everything else the account owns, so the list is never a dead end. */
  elsewhere: PrivateServer[];
  fetchedAt: number | null;
}

export const EMPTY_PRIVATE_SERVERS: PrivateServerState = {
  enabledHere: null,
  joinableHere: [],
  here: [],
  elsewhere: [],
  fetchedAt: null,
};

/**
 * A private server this account can actually join at the current place.
 *
 * Verified 28 Aug 2026: `GET /v1/games/{placeId}/private-servers` answers with
 * `{name, vipServerId, accessCode, owner:{id,name,displayName}, playing, maxPlayers, ...}`
 * - so joining costs no write after all, which is what the two earlier probes were for.
 *
 * **`accessCode` is deliberately absent from this type.** It is a secret that grants
 * entry to someone's private server, so it never travels into app state, never reaches a
 * surface, and is never written to storage. The service worker holds the codes in memory
 * and the UI joins by `vipServerId`.
 */
export interface JoinablePrivateServer {
  vipServerId: number;
  name: string;
  ownerName: string | null;
  playing: number | null;
  maxPlayers: number | null;
}
