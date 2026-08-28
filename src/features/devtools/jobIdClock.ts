/**
 * Does a Roblox job id carry the moment its server started?
 *
 * This is the one question nobody had asked about server uptime. The servers API has no
 * start time, no uptime and no version field, so the project has always fallen back to
 * "when we first saw it" - but a job id is a UUID, and a **version 1** UUID has a
 * 60-bit timestamp built into it. If Roblox mints them that way, every server in the list
 * comes with its real start time attached and no request is needed to get it.
 *
 * So this reads the version nibble instead of assuming, exactly as the API probe reads a
 * response instead of trusting the docs. Nothing here is wired into a feature: it reports
 * what the ids are, and what is built on top of that comes after the answer, not before
 * (rule 7 of docs/05_IMPLEMENTATION_PLAN.md).
 */

/** Roblox launched in 2006; a server cannot have started before that, or in the future. */
const EARLIEST_PLAUSIBLE = Date.UTC(2006, 0, 1);
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/** 1582-10-15 to 1970-01-01, the offset a version-1 UUID counts from. */
const GREGORIAN_OFFSET_MS = 12_219_292_800_000;

const UUID = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f])([0-9a-f]{3})-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface JobIdClock {
  /** The UUID version nibble, or null when the id is not a UUID at all. */
  version: number | null;
  /** Epoch millis decoded from a version-1 id. Null for every other version. */
  startedAt: number | null;
  /**
   * Whether a decoded time could be a server start time. A version-1 id whose timestamp
   * lands in 1970 or in 2190 decodes fine and means nothing.
   */
  plausible: boolean;
}

export function readJobIdClock(jobId: string, now = Date.now()): JobIdClock {
  const match = UUID.exec(jobId.trim());
  if (!match) return { version: null, startedAt: null, plausible: false };

  const [, timeLow = '', timeMid = '', versionNibble = '', timeHigh = ''] = match;
  const version = Number.parseInt(versionNibble, 16);
  if (version !== 1) return { version, startedAt: null, plausible: false };

  // 60 bits does not fit in a double without losing the low end, so decode in BigInt.
  const ticks =
    (BigInt(`0x${timeHigh}`) << 48n) | (BigInt(`0x${timeMid}`) << 32n) | BigInt(`0x${timeLow}`);
  const startedAt = Number(ticks / 10_000n) - GREGORIAN_OFFSET_MS;

  return {
    version,
    startedAt,
    plausible: startedAt >= EARLIEST_PLAUSIBLE && startedAt <= now + FUTURE_TOLERANCE_MS,
  };
}

export interface JobIdClockReport {
  /** How many ids were looked at. */
  sampled: number;
  /** Counts per UUID version; `0` collects anything that is not a UUID. */
  versions: Record<number, number>;
  /** True only when every id is version 1 AND every decoded time is plausible. */
  carriesStartTime: boolean;
  /** The oldest plausible start time found, for eyeballing against a server's age. */
  oldestStartedAt: number | null;
  /** One line, written so it cannot be read as more than it is. */
  detail: string;
}

/**
 * Reads a whole loaded server list at once, because one id proves nothing either way -
 * Roblox could mint some ids one way and some another, and a single sample would hide it.
 */
export function inspectJobIds(jobIds: readonly string[], now = Date.now()): JobIdClockReport {
  const versions: Record<number, number> = {};
  let plausibleCount = 0;
  let oldestStartedAt: number | null = null;

  for (const jobId of jobIds) {
    const clock = readJobIdClock(jobId, now);
    const key = clock.version ?? 0;
    versions[key] = (versions[key] ?? 0) + 1;
    if (clock.plausible && clock.startedAt !== null) {
      plausibleCount += 1;
      oldestStartedAt = oldestStartedAt === null ? clock.startedAt : Math.min(oldestStartedAt, clock.startedAt);
    }
  }

  const sampled = jobIds.length;
  const carriesStartTime = sampled > 0 && plausibleCount === sampled;

  return { sampled, versions, carriesStartTime, oldestStartedAt, detail: describe(sampled, versions, plausibleCount) };
}

function describe(
  sampled: number,
  versions: Record<number, number>,
  plausibleCount: number,
): string {
  if (sampled === 0) {
    return 'No servers loaded yet — refresh the server list on a game page and look again.';
  }

  const kinds = Object.entries(versions)
    .map(([version, count]) => `${count} × ${version === '0' ? 'not a UUID' : `v${version}`}`)
    .join(', ');

  if (plausibleCount === sampled) {
    return `${kinds}. Every id decodes to a plausible time, so job ids carry a real server start time — uptime can stop being an estimate.`;
  }
  if (plausibleCount > 0) {
    return `${kinds}. Only ${plausibleCount} of ${sampled} decode to a plausible time, so the timestamp is not dependable — a partial answer is not one to build on.`;
  }
  return `${kinds}. No id carries a usable timestamp, so a server's real start time cannot be recovered from its job id. Age stays a floor measured from our own first sighting.`;
}
