import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../models/settings';
import { EMPTY_PRIVATE_SERVERS } from '../../models/privateServer';
import { EMPTY_SEARCH } from '../../models/search';
import { EMPTY_PROFILE } from '../../models/profile';
import type { AppState } from '../../models/messages';
import { detectPageContext, parseUserId } from '../../utils/robloxUrl';
import { fuzzyMatch, highlight } from './fuzzy';
import { COMMANDS, rankCommands, type CommandContext } from './commands';

describe('fuzzyMatch', () => {
  it('matches a subsequence, so initials find a command', () => {
    // The whole point of a palette: "jls" has to reach "Join lowest server".
    expect(fuzzyMatch('Join lowest server', 'jls')).not.toBeNull();
  });

  it('returns null when a character is missing', () => {
    expect(fuzzyMatch('Join lowest server', 'jlz')).toBeNull();
  });

  it('matches everything on an empty query', () => {
    expect(fuzzyMatch('anything', '')).toEqual({ score: 0, positions: [] });
  });

  it('is case-insensitive', () => {
    expect(fuzzyMatch('Smart Join', 'SMART')).not.toBeNull();
    expect(fuzzyMatch('Smart Join', 'smart')).not.toBeNull();
  });

  it('scores word starts above mid-word coincidences', () => {
    const initials = fuzzyMatch('Smart Join', 'sj')!;
    const midWord = fuzzyMatch('Basement jars', 'sj')!;
    expect(initials.score).toBeGreaterThan(midWord.score);
  });

  it('scores consecutive characters above scattered ones', () => {
    const consecutive = fuzzyMatch('server', 'ser')!;
    const scattered = fuzzyMatch('some elder rat', 'ser')!;
    expect(consecutive.score).toBeGreaterThan(scattered.score);
  });

  it('reports the positions it matched, for highlighting', () => {
    expect(fuzzyMatch('abc', 'ac')?.positions).toEqual([0, 2]);
  });
});

describe('highlight', () => {
  it('splits a label into matched and unmatched runs', () => {
    expect(highlight('abc', [0, 2])).toEqual([
      { text: 'a', match: true },
      { text: 'b', match: false },
      { text: 'c', match: true },
    ]);
  });

  it('returns the whole label unmatched when nothing matched', () => {
    expect(highlight('abc', [])).toEqual([{ text: 'abc', match: false }]);
  });

  it('merges adjacent matches into one run', () => {
    expect(highlight('abcd', [0, 1])).toEqual([
      { text: 'ab', match: true },
      { text: 'cd', match: false },
    ]);
  });
});

describe('page context', () => {
  it('recognises an experience page', () => {
    expect(detectPageContext('https://www.roblox.com/games/123/Steal-An-Egg')).toBe('experience');
  });

  it('recognises a profile page and its user id', () => {
    expect(detectPageContext('https://www.roblox.com/users/456/profile')).toBe('profile');
    expect(parseUserId('https://www.roblox.com/users/456/profile')).toBe('456');
  });

  it('recognises catalog and trades', () => {
    expect(detectPageContext('https://www.roblox.com/catalog/1/Hat')).toBe('catalog');
    expect(detectPageContext('https://www.roblox.com/trades')).toBe('trades');
  });

  it('falls back to other rather than guessing', () => {
    expect(detectPageContext('https://www.roblox.com/home')).toBe('other');
    expect(detectPageContext('not a url')).toBe('other');
    expect(parseUserId('https://example.com/users/1')).toBeNull();
  });
});

function makeState(patch: Partial<AppState> = {}): AppState {
  return {
    experience: { placeId: '123', universeId: '9', name: 'Test Game' },
    settings: DEFAULT_SETTINGS,
    servers: [],
    flagged: [],
    history: [],
    blacklist: [],
    customFlags: [],
    privateServers: EMPTY_PRIVATE_SERVERS,
    search: EMPTY_SEARCH,
    profile: EMPTY_PROFILE,
    presence: null,
    allCustomFlags: [],
    apiProbe: null,
    jobIdClock: null,
    presenceFollow: null,
    liveStats: null,
    playtime: [],
    sessions: [],
    openSession: null,
    lastJoined: null,
    smartJoinPlan: null,
    health: {
      clean: 0,
      flagged: 0,
      unknown: 0,
      favorites: 0,
      blacklistedPlayers: 0,
      blacklistCheck: { verdict: 'none-detected', detected: [], undeterminable: 0 },
    },
    scan: {
      status: 'idle',
      scanned: 0,
      page: 0,
      complete: false,
      truncated: false,
      lastScanAt: null,
      canLoadMore: false,
    },
    transport: { mode: 'page', authenticated: true, limitPerMin: null },
    totalShown: 0,
    ...patch,
  };
}

function makeCtx(patch: Partial<CommandContext> = {}): CommandContext {
  return {
    state: makeState(),
    page: 'experience',
    userId: null,
    send: vi.fn(),
    copy: vi.fn(),
    closePalette: vi.fn(),
    openPanel: vi.fn(),
    ...patch,
  };
}

const ids = (results: ReturnType<typeof rankCommands>) => results.map((r) => r.command.id);

describe('rankCommands', () => {
  it('offers everything runnable on an empty query', () => {
    expect(rankCommands('', makeCtx()).length).toBeGreaterThan(5);
  });

  it('ranks every context-relevant command above every unrelated one', () => {
    // Spec section 41: the palette should feel like it read the page. Asserted as the
    // actual invariant rather than by comparing first entries, since a short label can
    // top both lists for unrelated reasons.
    const results = rankCommands('', makeCtx({ page: 'experience' }));
    const boosted = results.filter((r) => r.command.boostIn?.includes('experience'));
    const rest = results.filter((r) => !r.command.boostIn?.includes('experience'));

    expect(boosted.length).toBeGreaterThan(0);
    expect(rest.length).toBeGreaterThan(0);

    const worstBoosted = Math.min(...boosted.map((r) => r.score));
    const bestOther = Math.max(...rest.map((r) => r.score));
    expect(worstBoosted).toBeGreaterThan(bestOther);
  });

  it('drops that boost away from the matching page', () => {
    const onExperience = rankCommands('', makeCtx({ page: 'experience' }));
    const elsewhere = rankCommands('', makeCtx({ page: 'other' }));

    const scoreOf = (results: typeof onExperience, id: string) =>
      results.find((r) => r.command.id === id)?.score ?? 0;

    expect(scoreOf(onExperience, 'join-lowest')).toBeGreaterThan(
      scoreOf(elsewhere, 'join-lowest'),
    );
  });

  it('hides profile-only commands away from a profile', () => {
    expect(ids(rankCommands('', makeCtx({ page: 'experience' })))).not.toContain('copy-user-id');
  });

  it('offers profile commands on a profile, with a user id', () => {
    const ctx = makeCtx({ page: 'profile', userId: '456' });
    expect(ids(rankCommands('', ctx))).toContain('copy-user-id');
  });

  it('hides a profile command when the page has no user id', () => {
    const ctx = makeCtx({ page: 'profile', userId: null });
    expect(ids(rankCommands('', ctx))).not.toContain('copy-user-id');
  });

  it('hides server commands when no experience is open', () => {
    const ctx = makeCtx({ page: 'other', state: makeState({ experience: null }) });
    const found = ids(rankCommands('', ctx));
    expect(found).not.toContain('join-lowest');
    // Global commands still available, so the palette is never a dead end.
    expect(found).toContain('open-settings');
  });

  it('hides commands whose feature is switched off', () => {
    const state = makeState({
      settings: {
        ...DEFAULT_SETTINGS,
        features: { ...DEFAULT_SETTINGS.features, smartJoin: false },
      },
    });
    expect(ids(rankCommands('', makeCtx({ state })))).not.toContain('smart-join');
  });

  it('hides flag commands until something has been joined', () => {
    expect(ids(rankCommands('', makeCtx()))).not.toContain('flag-exploiter');

    const state = makeState({
      lastJoined: { placeId: '123', jobId: 'job', playersAtJoin: 1, maxPlayers: 7, joinedAt: 1 },
    });
    expect(ids(rankCommands('', makeCtx({ state })))).toContain('flag-exploiter');
  });

  it('finds a command by its initials', () => {
    expect(ids(rankCommands('jls', makeCtx()))[0]).toBe('join-lowest');
  });

  it('searches the hint as well as the label', () => {
    // "Preview Smart Join choice" is found by what it does, not only what it is called.
    expect(ids(rankCommands('without joining', makeCtx()))).toContain('preview-smart-join');
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(rankCommands('zzzzqqq', makeCtx())).toEqual([]);
  });

  it('runs the command it was given', () => {
    const send = vi.fn();
    const ctx = makeCtx({ send });
    const hit = rankCommands('join lowest', ctx)[0];
    hit!.command.run(ctx);
    expect(send).toHaveBeenCalledWith({ type: 'join/lowest', placeId: '123' });
  });
});

describe('command registry integrity', () => {
  it('has unique ids', () => {
    const seen = new Set(COMMANDS.map((c) => c.id));
    expect(seen.size).toBe(COMMANDS.length);
  });

  it('gives every command a label, icon and section', () => {
    for (const command of COMMANDS) {
      expect(command.label.length, command.id).toBeGreaterThan(0);
      expect(command.icon.length, command.id).toBeGreaterThan(0);
      expect(command.section.length, command.id).toBeGreaterThan(0);
    }
  });
});
