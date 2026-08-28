import { describe, expect, it } from 'vitest';
import type { JoinablePrivateServer, PrivateServer } from '../../models/privateServer';
import {
  choosePrivateServer,
  describeExpiry,
  parseJoinable,
  groupByExperience,
  parsePrivateServer,
  sortServers,
  type RawPrivateServer,
} from './privateServers';

/** Shaped after the real 28 Aug 2026 response, with the identifying values replaced. */
const RAW: RawPrivateServer = {
  active: true,
  universeId: 2647834887,
  placeId: 6924758805,
  name: 'Araini',
  ownerId: 1,
  ownerName: 'someone',
  priceInRobux: null,
  privateServerId: 1381799380,
  expirationDate: '2124-04-22T21:21:15.197Z',
  willRenew: false,
  universeName: 'Aim Trainer',
};

function server(patch: Partial<PrivateServer> = {}): PrivateServer {
  return {
    privateServerId: 1,
    name: 'Server',
    universeId: '9',
    placeId: '123',
    universeName: 'Game',
    active: true,
    expiresAt: null,
    willRenew: false,
    priceInRobux: null,
    ...patch,
  };
}

describe('parsePrivateServer', () => {
  it('reads the response Roblox actually returned', () => {
    const parsed = parsePrivateServer(RAW);
    expect(parsed).toMatchObject({
      privateServerId: 1381799380,
      name: 'Araini',
      // Ids arrive as numbers here and as strings everywhere else in the extension;
      // normalising once is what stops a === comparison silently never matching.
      universeId: '2647834887',
      placeId: '6924758805',
      universeName: 'Aim Trainer',
      active: true,
      willRenew: false,
      priceInRobux: null,
    });
    expect(parsed?.expiresAt).toBe(Date.parse('2124-04-22T21:21:15.197Z'));
  });

  it('drops a row with no id or no place, rather than rendering blanks', () => {
    const { privateServerId: _id, ...withoutId } = RAW;
    const { placeId: _place, ...withoutPlace } = RAW;
    expect(parsePrivateServer(withoutId)).toBeNull();
    expect(parsePrivateServer(withoutPlace)).toBeNull();
  });

  it('survives fields this one account happened not to have', () => {
    // The shape was seen once, from one account. A field that was present then may be
    // absent for someone else, and that must not take the whole list down.
    const parsed = parsePrivateServer({ privateServerId: 5, placeId: 7 });
    expect(parsed?.name).toBe('Untitled private server');
    expect(parsed?.universeName).toBe('Unknown experience');
    expect(parsed?.expiresAt).toBeNull();
  });

  it('treats an unparseable expiry as no expiry instead of as 1970', () => {
    expect(parsePrivateServer({ ...RAW, expirationDate: 'not a date' })?.expiresAt).toBeNull();
  });
});

describe('groupByExperience', () => {
  it('matches on universe, not place', () => {
    // An experience can have several places and the server belongs to the universe, so
    // matching on placeId would hide someone's own server from them.
    const mine = server({ universeId: '9', placeId: '999' });
    const grouped = groupByExperience([mine], '9');
    expect(grouped.here).toHaveLength(1);
    expect(grouped.elsewhere).toHaveLength(0);
  });

  it('puts everything elsewhere when no experience is open', () => {
    const grouped = groupByExperience([server(), server({ privateServerId: 2 })], null);
    expect(grouped.here).toHaveLength(0);
    expect(grouped.elsewhere).toHaveLength(2);
  });
});

describe('sortServers', () => {
  it('puts active servers before inactive ones', () => {
    const sorted = sortServers([
      server({ privateServerId: 1, active: false }),
      server({ privateServerId: 2, active: true }),
    ]);
    expect(sorted[0]?.privateServerId).toBe(2);
  });

  it('sorts the soonest expiry first, and no expiry last', () => {
    // "No date" is not "urgent": a server without an expiry must not be shown as though
    // it needed attention before one expiring tomorrow.
    const sorted = sortServers([
      server({ privateServerId: 1, expiresAt: null }),
      server({ privateServerId: 2, expiresAt: 5_000 }),
      server({ privateServerId: 3, expiresAt: 1_000 }),
    ]);
    expect(sorted.map((s) => s.privateServerId)).toEqual([3, 2, 1]);
  });
});

describe('describeExpiry', () => {
  const now = Date.parse('2026-08-28T00:00:00.000Z');
  const inDays = (days: number): number => now + days * 24 * 60 * 60 * 1000;

  it('says nothing at all for a date a century out', () => {
    // The real response carried an expiry in 2124, which is Roblox's way of saying "this
    // does not expire". Rendering "expires in 35,000 days" would be noise dressed as fact.
    expect(describeExpiry(server({ expiresAt: Date.parse('2124-04-22T21:21:15.197Z') }), now)).toBeNull();
  });

  it('says nothing when there is no date', () => {
    expect(describeExpiry(server({ expiresAt: null }), now)).toBeNull();
  });

  it('describes a near expiry in days and a further one in months', () => {
    expect(describeExpiry(server({ expiresAt: inDays(3) }), now)).toBe('expires in 3 days');
    expect(describeExpiry(server({ expiresAt: inDays(60) }), now)).toBe('expires in about 2 months');
  });

  it('marks a date in the past as expired', () => {
    expect(describeExpiry(server({ expiresAt: inDays(-1) }), now)).toBe('expired');
  });

  it('uses the singular for one month', () => {
    expect(describeExpiry(server({ expiresAt: inDays(30) }), now)).toBe('expires in about 1 month');
  });
});

describe('parseJoinable', () => {
  /** The real 28 Aug 2026 response from GET /v1/games/{placeId}/private-servers. */
  const RAW_JOINABLE = {
    id: null,
    maxPlayers: 12,
    playing: 0,
    playerTokens: [],
    players: [],
    fps: 0,
    ping: 0,
    name: "Goat's server",
    vipServerId: 4155694220,
    accessCode: 'dbc04db0-ee98-4be4-b579-c102b412adf4',
    owner: { hasVerifiedBadge: false, id: 77202537, name: 'Someone', displayName: 'Their name' },
  };

  it('separates the access code from everything the UI sees', () => {
    // The whole point of the split: a code grants entry to someone's private server, so
    // it must not travel into app state with the rest of the row.
    const parsed = parseJoinable(RAW_JOINABLE);
    expect(parsed?.accessCode).toBe('dbc04db0-ee98-4be4-b579-c102b412adf4');
    expect(JSON.stringify(parsed?.server)).not.toContain('dbc04db0');
  });

  it('reads the fields the UI needs', () => {
    expect(parseJoinable(RAW_JOINABLE)?.server).toEqual({
      vipServerId: 4155694220,
      name: "Goat's server",
      ownerName: 'Their name',
      playing: 0,
      maxPlayers: 12,
    });
  });

  it('drops a server with no code, since it could not be joined anyway', () => {
    const { accessCode: _code, ...withoutCode } = RAW_JOINABLE;
    expect(parseJoinable(withoutCode)).toBeNull();
    expect(parseJoinable({ ...RAW_JOINABLE, accessCode: '' })).toBeNull();
  });

  it('falls back to the account name when there is no display name', () => {
    const parsed = parseJoinable({ ...RAW_JOINABLE, owner: { name: 'Someone' } });
    expect(parsed?.server.ownerName).toBe('Someone');
  });
});

describe('choosePrivateServer', () => {
  function joinable(patch: Partial<JoinablePrivateServer> = {}): JoinablePrivateServer {
    return {
      vipServerId: 1,
      name: 'Server',
      ownerName: null,
      playing: 0,
      maxPlayers: 10,
      ...patch,
    };
  }

  it('takes the emptiest when that is the preference', () => {
    const chosen = choosePrivateServer(
      [
        joinable({ vipServerId: 1, name: 'Busy', playing: 8 }),
        joinable({ vipServerId: 2, name: 'Quiet', playing: 1 }),
      ],
      'lowest',
    );

    expect(chosen?.vipServerId).toBe(2);
  });

  it('takes the busiest when that is the preference', () => {
    const chosen = choosePrivateServer(
      [
        joinable({ vipServerId: 1, name: 'Busy', playing: 8 }),
        joinable({ vipServerId: 2, name: 'Quiet', playing: 1 }),
      ],
      'highest',
    );

    expect(chosen?.vipServerId).toBe(1);
  });

  it('takes the one nearest half full when balanced', () => {
    const chosen = choosePrivateServer(
      [
        joinable({ vipServerId: 1, name: 'Empty', playing: 0, maxPlayers: 10 }),
        joinable({ vipServerId: 2, name: 'Half', playing: 5, maxPlayers: 10 }),
        joinable({ vipServerId: 3, name: 'Nearly full', playing: 9, maxPlayers: 10 }),
      ],
      'balanced',
    );

    expect(chosen?.vipServerId).toBe(2);
  });

  it('skips a full server rather than sending someone into a refusal', () => {
    const chosen = choosePrivateServer(
      [
        joinable({ vipServerId: 1, name: 'Full', playing: 10, maxPlayers: 10 }),
        joinable({ vipServerId: 2, name: 'Room left', playing: 9, maxPlayers: 10 }),
      ],
      'highest',
    );

    expect(chosen?.vipServerId).toBe(2);
  });

  it('returns null when every server is full, so the caller can fall back to public', () => {
    const chosen = choosePrivateServer([joinable({ playing: 10, maxPlayers: 10 })], 'lowest');
    expect(chosen).toBeNull();
  });

  /*
   * The rule that matters most here: an unmeasured server is not an empty one. Sorting it
   * first under "emptiest" would mean joining the server we know least about precisely
   * because we know least about it.
   */
  it('ranks a server with no player count behind every server that has one', () => {
    const chosen = choosePrivateServer(
      [
        joinable({ vipServerId: 1, name: 'Unknown', playing: null, maxPlayers: null }),
        joinable({ vipServerId: 2, name: 'Known', playing: 6 }),
      ],
      'lowest',
    );

    expect(chosen?.vipServerId).toBe(2);
  });

  it('still uses an unmeasured server when it is the only one', () => {
    const chosen = choosePrivateServer(
      [joinable({ vipServerId: 7, playing: null, maxPlayers: null })],
      'lowest',
    );

    expect(chosen?.vipServerId).toBe(7);
  });

  it('picks the same server every time from the same list', () => {
    const servers = [
      joinable({ vipServerId: 1, name: 'B', playing: 3 }),
      joinable({ vipServerId: 2, name: 'A', playing: 3 }),
    ];

    expect(choosePrivateServer(servers, 'lowest')?.vipServerId).toBe(2);
    expect(choosePrivateServer([...servers].reverse(), 'lowest')?.vipServerId).toBe(2);
  });

  it('has nothing to choose from an empty list', () => {
    expect(choosePrivateServer([], 'lowest')).toBeNull();
  });
});
