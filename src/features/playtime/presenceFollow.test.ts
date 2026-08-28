import { describe, expect, it } from 'vitest';
import type { PlayerPresence } from '../playerBlacklist/presence';
import type { PlaySession } from './playtime';
import { decideFollow, nextPollMinutes } from './presenceFollow';

const NOW = Date.parse('2026-08-28T12:00:00.000Z');

function presence(patch: Partial<PlayerPresence> = {}): PlayerPresence {
  return {
    userId: 1,
    kind: 'in-game',
    lastLocation: 'Steal An Egg',
    placeId: '123',
    jobId: 'job-a',
    ...patch,
  };
}

function open(patch: Partial<PlaySession> = {}): PlaySession {
  return { placeId: '123', jobId: 'job-a', startedAt: NOW - 10 * 60_000, ...patch };
}

describe('decideFollow', () => {
  it('starts a session for a game the user joined outside the extension', () => {
    const action = decideFollow(presence(), null);

    expect(action).toMatchObject({
      kind: 'start',
      placeId: '123',
      jobId: 'job-a',
      // Roblox's own words for the place, so no extra request is needed to name it.
      gameName: 'Steal An Egg',
    });
  });

  it('confirms rather than restarting when nothing has changed', () => {
    expect(decideFollow(presence(), open()).kind).toBe('confirm');
  });

  it('starts a new session when the user moves to another server in the same game', () => {
    const action = decideFollow(presence({ jobId: 'job-b' }), open());
    expect(action).toMatchObject({ kind: 'start', jobId: 'job-b' });
  });

  it('starts a new session when the experience changes', () => {
    const action = decideFollow(presence({ placeId: '999', jobId: 'job-z' }), open());
    expect(action).toMatchObject({ kind: 'start', placeId: '999' });
  });

  it('ends the session when Roblox says the user is back on the website', () => {
    expect(decideFollow(presence({ kind: 'website', placeId: null, jobId: null }), open()).kind).toBe(
      'end',
    );
  });

  it('ends the session when the user goes offline', () => {
    expect(decideFollow(presence({ kind: 'offline', placeId: null, jobId: null }), open()).kind).toBe(
      'end',
    );
  });

  it('treats Studio as not playing', () => {
    expect(decideFollow(presence({ kind: 'in-studio', jobId: null }), open()).kind).toBe('end');
  });

  /*
   * The rule that protects every number this feature produces. A request that failed is
   * not evidence the user stopped playing, and closing on it would silently truncate a
   * real session - the user would see a wrong figure with no way to know it was wrong.
   */
  it('changes nothing when Roblox did not answer', () => {
    expect(decideFollow(null, open()).kind).toBe('none');
  });

  it('changes nothing on a presence state it does not recognise', () => {
    expect(decideFollow(presence({ kind: 'unknown' }), open()).kind).toBe('none');
  });

  it('does not start a session for a game Roblox refuses to name', () => {
    expect(decideFollow(presence({ placeId: null, jobId: null }), null).kind).toBe('none');
  });

  it('keeps confirming when the place is known but the server is not', () => {
    const action = decideFollow(presence({ jobId: null }), open({ jobId: '' }));
    expect(action.kind).toBe('confirm');
  });

  it('does not treat learning the server id as a change of server', () => {
    // We had no id (presence withheld it once); now Roblox names it. Same session.
    expect(decideFollow(presence({ jobId: 'job-a' }), open({ jobId: '' })).kind).toBe('confirm');
  });

  it('starts a session even when the server is unnamed, if the place is known', () => {
    const action = decideFollow(presence({ jobId: null }), null);
    expect(action).toMatchObject({ kind: 'start', jobId: '' });
  });
});

describe('nextPollMinutes', () => {
  it('asks often only while something is running', () => {
    expect(nextPollMinutes({ kind: 'confirm', reason: '' }, 1, 5)).toBe(1);
    expect(nextPollMinutes({ kind: 'start', placeId: '1', jobId: '', reason: '' }, 1, 5)).toBe(1);
    expect(nextPollMinutes({ kind: 'end', reason: '' }, 1, 5)).toBe(5);
    expect(nextPollMinutes({ kind: 'none', reason: '' }, 1, 5)).toBe(5);
  });
});
