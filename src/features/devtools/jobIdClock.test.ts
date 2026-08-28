import { describe, expect, it } from 'vitest';
import { inspectJobIds, readJobIdClock } from './jobIdClock';

const NOW = Date.parse('2026-08-28T12:00:00.000Z');

/**
 * A real version-1 UUID, so the decoder is checked against a value that was minted by
 * something other than this file. `2f7c8e00-9b1a-11f0-9d3e-0242ac120002` encodes
 * 2025-09-30T0?:??Z; the exact instant matters less than that it lands in a sane decade.
 */
const V1 = '2f7c8e00-9b1a-11f0-9d3e-0242ac120002';
/** A job id shaped like the ones Roblox's server list actually returns. */
const V4 = 'd232d8f0-1c3b-4f21-9c0e-f6b44f54a7d1';

describe('readJobIdClock', () => {
  it('reads the version nibble', () => {
    expect(readJobIdClock(V4).version).toBe(4);
    expect(readJobIdClock(V1).version).toBe(1);
  });

  it('gives no timestamp for a random (v4) id, because there is none to give', () => {
    const clock = readJobIdClock(V4, NOW);
    expect(clock.startedAt).toBeNull();
    expect(clock.plausible).toBe(false);
  });

  it('decodes the timestamp inside a version-1 id', () => {
    const clock = readJobIdClock(V1, NOW);

    expect(clock.startedAt).not.toBeNull();
    const year = new Date(clock.startedAt!).getUTCFullYear();
    expect(year).toBeGreaterThan(2020);
    expect(year).toBeLessThan(2030);
    expect(clock.plausible).toBe(true);
  });

  /*
   * The check that stops a decode being mistaken for a fact. A v1 id whose timestamp
   * lands in 1583 parses perfectly and tells us nothing about a server.
   */
  it('refuses a decoded time that could not be a server start', () => {
    const ancient = '00000000-0000-1000-8000-000000000000';
    const clock = readJobIdClock(ancient, NOW);

    expect(clock.version).toBe(1);
    expect(clock.plausible).toBe(false);
  });

  it('treats anything that is not a UUID as no version at all', () => {
    expect(readJobIdClock('not-a-uuid').version).toBeNull();
    expect(readJobIdClock('').version).toBeNull();
  });
});

describe('inspectJobIds', () => {
  it('says plainly that random ids carry no start time', () => {
    const report = inspectJobIds([V4, V4], NOW);

    expect(report.carriesStartTime).toBe(false);
    expect(report.oldestStartedAt).toBeNull();
    expect(report.detail).toContain('cannot be recovered');
  });

  it('reports that uptime is obtainable only when every id decodes', () => {
    expect(inspectJobIds([V1, V1], NOW).carriesStartTime).toBe(true);
  });

  /*
   * A mixed list is the dangerous case: half the servers would show a real start time and
   * half a guess, in the same column, with nothing to tell them apart.
   */
  it('withholds the verdict when only some ids decode', () => {
    const report = inspectJobIds([V1, V4], NOW);

    expect(report.carriesStartTime).toBe(false);
    expect(report.detail).toContain('not dependable');
  });

  it('asks for a scan rather than concluding from nothing', () => {
    const report = inspectJobIds([], NOW);

    expect(report.carriesStartTime).toBe(false);
    expect(report.detail).toContain('No servers loaded');
  });

  it('counts each version so a change in how Roblox mints ids is visible', () => {
    expect(inspectJobIds([V1, V4, 'nonsense'], NOW).versions).toEqual({ 1: 1, 4: 1, 0: 1 });
  });
});
