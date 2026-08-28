import { describe, expect, it } from 'vitest';
import {
  describePresence,
  detectedIn,
  parsePresence,
  summarisePresence,
  undeterminable,
  type PlayerPresence,
} from './presence';

/** The real 28 Aug 2026 response, with the identifying values replaced. */
const IN_GAME = {
  userPresenceType: 2,
  lastLocation: 'Fish an Anime RNG',
  placeId: 74729868188364,
  rootPlaceId: 74729868188364,
  gameId: '12997a38-f110-40e3-befb-9d0b39e30cb3',
  universeId: 9582986239,
  userId: 77202537,
};

function presence(patch: Partial<PlayerPresence> = {}): PlayerPresence {
  return { userId: 1, kind: 'in-game', lastLocation: null, placeId: null, jobId: null, ...patch };
}

describe('parsePresence', () => {
  it('reads the response Roblox actually returned', () => {
    expect(parsePresence(IN_GAME)).toEqual({
      userId: 77202537,
      kind: 'in-game',
      lastLocation: 'Fish an Anime RNG',
      placeId: '74729868188364',
      jobId: '12997a38-f110-40e3-befb-9d0b39e30cb3',
    });
  });

  it('keeps a withheld location as null rather than inventing one', () => {
    // The normal case for anyone who is not a friend: Roblox says they are in a game and
    // refuses to say which. That is not the same as being nowhere.
    const parsed = parsePresence({ userId: 5, userPresenceType: 2, gameId: null, placeId: null });
    expect(parsed?.kind).toBe('in-game');
    expect(parsed?.jobId).toBeNull();
    expect(parsed?.placeId).toBeNull();
  });

  it('treats an unrecognised presence code as unknown, never as offline', () => {
    // A new enum value must not be reported as "not playing" - that is the one error that
    // would send someone into a server believing it was checked.
    expect(parsePresence({ userId: 5, userPresenceType: 99 })?.kind).toBe('unknown');
    expect(parsePresence({ userId: 5 })?.kind).toBe('unknown');
  });

  it('maps the codes Roblox documents', () => {
    expect(parsePresence({ userId: 1, userPresenceType: 0 })?.kind).toBe('offline');
    expect(parsePresence({ userId: 1, userPresenceType: 1 })?.kind).toBe('website');
    expect(parsePresence({ userId: 1, userPresenceType: 3 })?.kind).toBe('in-studio');
  });

  it('drops an entry with no user id', () => {
    expect(parsePresence({ userPresenceType: 2 })).toBeNull();
  });
});

describe('detectedIn', () => {
  it('finds the players Roblox placed in that exact server', () => {
    const players = [
      presence({ userId: 1, jobId: 'job-a' }),
      presence({ userId: 2, jobId: 'job-b' }),
      presence({ userId: 3, jobId: 'job-a' }),
    ];
    expect(detectedIn('job-a', players)).toEqual([1, 3]);
  });

  it('never matches a player whose server was withheld', () => {
    expect(detectedIn('job-a', [presence({ userId: 1, jobId: null })])).toEqual([]);
  });
});

describe('summarisePresence', () => {
  it('counts how many disclosed a server, which is the honest denominator', () => {
    const summary = summarisePresence(
      [presence({ userId: 1, jobId: 'job-a' }), presence({ userId: 2 })],
      5,
    );
    expect(summary.located).toBe(1);
    expect(summary.asked).toBe(5);
    expect(undeterminable(summary)).toBe(4);
  });

  it('never describes a silent answer as an all-clear', () => {
    // The sentence matters as much as the number: someone reading "checked 4" must not
    // conclude those four are not here.
    const text = describePresence(summarisePresence([presence({ userId: 1 })], 4));
    expect(text).toMatch(/not an all-clear/i);
    expect(text).not.toMatch(/safe/i);
  });

  it('says how many are still unaccounted for when some did disclose', () => {
    const summary = summarisePresence(
      [presence({ userId: 1, jobId: 'job-a' }), presence({ userId: 2 })],
      3,
    );
    expect(describePresence(summary)).toMatch(/the other 2 could be anywhere/i);
  });

  it('says there is nobody to check rather than reporting a clean result', () => {
    expect(describePresence(summarisePresence([], 0))).toMatch(/nobody on your blacklist/i);
  });
});
