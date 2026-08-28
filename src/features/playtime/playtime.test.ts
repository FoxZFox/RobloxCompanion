import { describe, expect, it } from 'vitest';
import {
  closeSession,
  isStale,
  SESSION_IDLE_TIMEOUT_MS,
  sessionDuration,
  sessionsSince,
  startOfDay,
  summarise,
  totalMs,
  type PlaySession,
} from './playtime';
import { PlaytimeRepository } from '../../services/storage/PlaytimeRepository';
import { MemoryStorageArea } from '../../services/storage/storageArea';

const NOW = 1_700_000_000_000;
const MINUTE = 60_000;

const session = (patch: Partial<PlaySession> = {}): PlaySession => ({
  placeId: '1',
  jobId: 'job',
  startedAt: NOW - 10 * MINUTE,
  ...patch,
});

describe('sessionDuration', () => {
  it('measures a closed session end to end', () => {
    const closed = session({ startedAt: NOW - 30 * MINUTE, endedAt: NOW - 10 * MINUTE });
    expect(sessionDuration(closed, NOW)).toBe(20 * MINUTE);
  });

  it('measures an open session up to now', () => {
    expect(sessionDuration(session({ startedAt: NOW - 5 * MINUTE }), NOW)).toBe(5 * MINUTE);
  });

  it('caps an open session at the idle timeout', () => {
    // Someone who closed their laptop mid-game must not come back to a day of playtime.
    const forgotten = session({ startedAt: NOW - 24 * 60 * MINUTE });
    expect(sessionDuration(forgotten, NOW)).toBe(SESSION_IDLE_TIMEOUT_MS);
  });

  it('does not cap a closed session, however long it ran', () => {
    const long = session({ startedAt: NOW - 300 * MINUTE, endedAt: NOW });
    expect(sessionDuration(long, NOW)).toBe(300 * MINUTE);
  });

  it('never returns a negative duration', () => {
    const backwards = session({ startedAt: NOW, endedAt: NOW - MINUTE });
    expect(sessionDuration(closeSession(backwards, NOW - MINUTE), NOW)).toBe(0);
  });
});

describe('isStale', () => {
  it('is false for a session that just started', () => {
    expect(isStale(session({ startedAt: NOW - MINUTE }), NOW)).toBe(false);
  });

  it('is true past the idle timeout', () => {
    expect(isStale(session({ startedAt: NOW - SESSION_IDLE_TIMEOUT_MS - 1 }), NOW)).toBe(true);
  });

  it('is never true for a closed session', () => {
    const closed = session({ startedAt: 0, endedAt: 1 });
    expect(isStale(closed, NOW)).toBe(false);
  });
});

describe('summarise', () => {
  it('groups by experience and sorts by time spent, not by session count', () => {
    // 'a' has two sessions totalling 15 minutes; 'b' has one of 30. The longer total
    // wins, so the list answers "where does my time go" rather than "what did I open".
    const totals = summarise(
      [
        session({ placeId: 'a', startedAt: NOW - 10 * MINUTE, endedAt: NOW }),
        session({ placeId: 'b', startedAt: NOW - 30 * MINUTE, endedAt: NOW }),
        session({ placeId: 'a', startedAt: NOW - 5 * MINUTE, endedAt: NOW }),
      ],
      NOW,
    );

    expect(totals.map((t) => t.placeId)).toEqual(['b', 'a']);
    expect(totals[0]?.totalMs).toBe(30 * MINUTE);
    expect(totals[0]?.sessions).toBe(1);

    const a = totals.find((t) => t.placeId === 'a');
    expect(a?.totalMs).toBe(15 * MINUTE);
    expect(a?.sessions).toBe(2);
  });

  it('fills in a name learned on a later session', () => {
    // The first join can happen before the experience name resolves.
    const totals = summarise(
      [
        session({ placeId: 'a', endedAt: NOW }),
        session({ placeId: 'a', gameName: 'Steal An Egg', endedAt: NOW }),
      ],
      NOW,
    );
    expect(totals[0]?.gameName).toBe('Steal An Egg');
  });

  it('reports the most recent activity per experience', () => {
    const totals = summarise(
      [
        session({ placeId: 'a', startedAt: NOW - 100 * MINUTE, endedAt: NOW - 90 * MINUTE }),
        session({ placeId: 'a', startedAt: NOW - 10 * MINUTE, endedAt: NOW - 5 * MINUTE }),
      ],
      NOW,
    );
    expect(totals[0]?.lastPlayedAt).toBe(NOW - 5 * MINUTE);
  });

  it('handles an empty history', () => {
    expect(summarise([], NOW)).toEqual([]);
    expect(totalMs([], NOW)).toBe(0);
  });
});

describe('sessionsSince', () => {
  it('keeps only sessions touched after the cutoff', () => {
    const recent = session({ startedAt: NOW - MINUTE, endedAt: NOW });
    const old = session({ startedAt: NOW - 500 * MINUTE, endedAt: NOW - 400 * MINUTE });
    expect(sessionsSince([recent, old], NOW - 10 * MINUTE)).toEqual([recent]);
  });
});

describe('startOfDay', () => {
  it('lands at local midnight, so "today" means what the user means', () => {
    const midnight = startOfDay(NOW);
    const asDate = new Date(midnight);
    expect(asDate.getHours()).toBe(0);
    expect(asDate.getMinutes()).toBe(0);
    expect(midnight).toBeLessThanOrEqual(NOW);
  });
});

describe('PlaytimeRepository', () => {
  it('opens a session on join', async () => {
    const repo = new PlaytimeRepository(new MemoryStorageArea());
    await repo.startSession({ placeId: '1', jobId: 'a' }, NOW);
    expect((await repo.openSession())?.jobId).toBe('a');
  });

  it('closes the previous session when a new one starts', async () => {
    // Joining elsewhere is the only end-of-session signal Roblox gives us.
    const repo = new PlaytimeRepository(new MemoryStorageArea());
    await repo.startSession({ placeId: '1', jobId: 'a' }, NOW - 10 * MINUTE);
    await repo.startSession({ placeId: '1', jobId: 'b' }, NOW);

    const sessions = await repo.list();
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((s) => s.endedAt === undefined)).toHaveLength(1);
    expect((await repo.openSession())?.jobId).toBe('b');
  });

  it('credits a stale predecessor only up to the timeout, not the whole gap', async () => {
    const repo = new PlaytimeRepository(new MemoryStorageArea());
    await repo.startSession({ placeId: '1', jobId: 'a' }, NOW - 24 * 60 * MINUTE);
    await repo.startSession({ placeId: '1', jobId: 'b' }, NOW);

    const stale = (await repo.list()).find((s) => s.jobId === 'a')!;
    expect(sessionDuration(stale, NOW)).toBe(SESSION_IDLE_TIMEOUT_MS);
  });

  it('closes the open session on request', async () => {
    const repo = new PlaytimeRepository(new MemoryStorageArea());
    await repo.startSession({ placeId: '1', jobId: 'a' }, NOW - MINUTE);
    await repo.endSession(NOW);
    expect(await repo.openSession()).toBeNull();
  });

  it('closeStale only acts on a session past the timeout', async () => {
    const repo = new PlaytimeRepository(new MemoryStorageArea());
    await repo.startSession({ placeId: '1', jobId: 'a' }, NOW - MINUTE);
    expect(await repo.closeStale(NOW)).toBe(false);
    expect(await repo.closeStale(NOW + SESSION_IDLE_TIMEOUT_MS + MINUTE)).toBe(true);
  });

  it('survives a reload', async () => {
    const storage = new MemoryStorageArea();
    await new PlaytimeRepository(storage).startSession({ placeId: '1', jobId: 'a' }, NOW);
    expect((await new PlaytimeRepository(storage).openSession())?.jobId).toBe('a');
  });
});

describe('a session Roblox keeps confirming', () => {
  const START = Date.parse('2026-08-28T08:00:00.000Z');
  const HOUR = 60 * 60 * 1000;

  function followed(patch: Partial<PlaySession> = {}): PlaySession {
    return { placeId: '1', jobId: 'a', startedAt: START, startedBy: 'presence', ...patch };
  }

  /*
   * The reason `confirmedAt` exists. Without it every open session is capped at the idle
   * timeout, which is right when the only thing we ever saw was the start - and wrong the
   * moment Roblox is telling us, every minute, that the session is still running.
   */
  it('runs past the idle cap while confirmations keep arriving', () => {
    const session = followed({ confirmedAt: START + 3 * HOUR });
    expect(sessionDuration(session, START + 3 * HOUR)).toBe(3 * HOUR);
  });

  it('is not stale while it is being confirmed', () => {
    const session = followed({ confirmedAt: START + 3 * HOUR });
    expect(isStale(session, START + 3 * HOUR + 60_000)).toBe(false);
  });

  it('goes stale once the confirmations stop, not once the session gets long', () => {
    const session = followed({ confirmedAt: START + 3 * HOUR });
    expect(isStale(session, START + 3 * HOUR + SESSION_IDLE_TIMEOUT_MS)).toBe(true);
  });

  it('stops counting at the last confirmation plus the timeout, not at now', () => {
    const session = followed({ confirmedAt: START + HOUR });
    const muchLater = START + 9 * HOUR;
    expect(sessionDuration(session, muchLater)).toBe(HOUR + SESSION_IDLE_TIMEOUT_MS);
  });

  it('still caps a session nobody confirmed, exactly as before', () => {
    const session: PlaySession = { placeId: '1', jobId: 'a', startedAt: START };
    expect(sessionDuration(session, START + 9 * HOUR)).toBe(SESSION_IDLE_TIMEOUT_MS);
  });
});
