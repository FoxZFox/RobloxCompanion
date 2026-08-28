import { describe, expect, it } from 'vitest';
import type { PlaySession } from './playtime';
import { SESSION_IDLE_TIMEOUT_MS } from './playtime';
import { buildSessionLog, describeServerAge, visitsTo } from './sessionLog';

const NOW = Date.parse('2026-08-28T12:00:00.000Z');
const MINUTE = 60_000;

function session(patch: Partial<PlaySession> = {}): PlaySession {
  return {
    placeId: '123',
    jobId: 'job-a',
    gameName: 'Test Game',
    startedAt: NOW - 30 * MINUTE,
    endedAt: NOW - 10 * MINUTE,
    ...patch,
  };
}

/** A session with no `endedAt` at all, which is what "still open" means on disk. */
function openSession(startedAt: number, patch: Partial<PlaySession> = {}): PlaySession {
  return { placeId: '123', jobId: 'job-a', gameName: 'Test Game', startedAt, ...patch };
}

describe('buildSessionLog', () => {
  it('reports which game, which server and how long', () => {
    const [entry] = buildSessionLog([session()], NOW);

    expect(entry).toMatchObject({
      placeId: '123',
      jobId: 'job-a',
      gameName: 'Test Game',
      durationMs: 20 * MINUTE,
      open: false,
    });
  });

  it('counts an open session up to now and marks it open', () => {
    const [entry] = buildSessionLog([openSession(NOW - 5 * MINUTE)], NOW);

    expect(entry?.open).toBe(true);
    expect(entry?.durationMs).toBe(5 * MINUTE);
  });

  it('clamps an abandoned session the same way the totals do', () => {
    const [entry] = buildSessionLog([openSession(NOW - 8 * 60 * MINUTE)], NOW);

    expect(entry?.durationMs).toBe(SESSION_IDLE_TIMEOUT_MS);
  });

  it('gives the server age at the join, measured from our own first sighting', () => {
    const [entry] = buildSessionLog(
      [session({ serverFirstSeenAt: NOW - 42 * MINUTE })],
      NOW,
    );

    // Joined 30 minutes ago, first seen 42 minutes ago: 12 minutes of proven age.
    expect(entry?.serverSeenBeforeMs).toBe(12 * MINUTE);
  });

  /*
   * The distinction the whole feature turns on. A server we met at the moment of joining
   * has an unknown age, not an age of zero - and zero would render as "brand new", which
   * is a claim nobody made.
   */
  it('reports an unseen server as unknown rather than as newly started', () => {
    const [entry] = buildSessionLog([session()], NOW);
    expect(entry?.serverSeenBeforeMs).toBeNull();
  });

  it('treats a sighting recorded at the join itself as no sighting', () => {
    const started = NOW - 30 * MINUTE;
    const [entry] = buildSessionLog([session({ startedAt: started, serverFirstSeenAt: started })], NOW);

    expect(entry?.serverSeenBeforeMs).toBeNull();
  });

  it('lists newest first and caps the list', () => {
    const sessions = [
      session({ jobId: 'old', startedAt: NOW - 90 * MINUTE }),
      session({ jobId: 'new', startedAt: NOW - 5 * MINUTE }),
      session({ jobId: 'mid', startedAt: NOW - 40 * MINUTE }),
    ];

    expect(buildSessionLog(sessions, NOW).map((entry) => entry.jobId)).toEqual([
      'new',
      'mid',
      'old',
    ]);
    expect(buildSessionLog(sessions, NOW, 2)).toHaveLength(2);
  });
});

describe('describeServerAge', () => {
  it('says "at least", never a bare figure', () => {
    const [entry] = buildSessionLog([session({ serverFirstSeenAt: NOW - 42 * MINUTE })], NOW);
    const text = describeServerAge(entry!);

    expect(text).toContain('at least 12m');
    expect(text).not.toMatch(/uptime/i);
  });

  it('says the age is not known when we had never seen the server', () => {
    const [entry] = buildSessionLog([session()], NOW);
    const text = describeServerAge(entry!);

    expect(text).toContain('not known');
    // "0m" would be a measurement nobody took.
    expect(text).not.toContain('0m');
  });
});

describe('visitsTo', () => {
  it('counts repeat visits to the same instance', () => {
    const entries = buildSessionLog(
      [
        session({ jobId: 'job-a', startedAt: NOW - 90 * MINUTE }),
        session({ jobId: 'job-b', startedAt: NOW - 60 * MINUTE }),
        session({ jobId: 'job-a', startedAt: NOW - 30 * MINUTE }),
      ],
      NOW,
    );

    expect(visitsTo(entries, 'job-a')).toBe(2);
    expect(visitsTo(entries, 'job-c')).toBe(0);
  });
});
