import type { AppState, UiRequest } from '../../models/messages';
import type { FeatureFlags } from '../../models/settings';
import type { PageContext } from '../../utils/robloxUrl';
import { fuzzyMatch } from './fuzzy';

export interface CommandContext {
  state: AppState;
  page: PageContext;
  /** userId of the profile being viewed, when there is one. */
  userId: string | null;
  send: (request: UiRequest) => void;
  /** Content-script side effects the palette itself cannot do. */
  copy: (text: string) => void;
  closePalette: () => void;
  openPanel: (tool?: string) => void;
}

export interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  section: string;
  flag?: keyof FeatureFlags;
  /** Contexts where this command is especially relevant; it ranks higher in them. */
  boostIn?: readonly PageContext[];
  /** When present, the command is hidden entirely outside these contexts. */
  onlyIn?: readonly PageContext[];
  /** Hidden when the state cannot support it, e.g. no experience open. */
  available?: (ctx: CommandContext) => boolean;
  run: (ctx: CommandContext) => void;
}

const hasExperience = (ctx: CommandContext): boolean => Boolean(ctx.state.experience?.placeId);
const hasLastJoined = (ctx: CommandContext): boolean => Boolean(ctx.state.lastJoined);
const placeIdOf = (ctx: CommandContext): string => ctx.state.experience?.placeId ?? '';

/**
 * Everything the palette can do.
 *
 * Same shape of decision as the tool rail: one entry per action, no layout to think
 * about, so a feature added later shows up here for free. `boostIn` is what makes the
 * palette feel like it read the page (spec section 41) - on an experience the server
 * actions rise to the top, on a profile the actions about that person do - without
 * hiding anything, so the palette is never a dead end.
 */
export const COMMANDS: readonly Command[] = [
  {
    id: 'smart-join',
    label: 'Smart Join',
    hint: 'Score every server and join the best',
    icon: '⚡',
    section: 'Servers',
    flag: 'smartJoin',
    boostIn: ['experience'],
    available: hasExperience,
    run: (ctx) => ctx.send({ type: 'join/smart', placeId: placeIdOf(ctx) }),
  },
  {
    id: 'join-lowest',
    label: 'Join lowest server',
    icon: '👤',
    section: 'Servers',
    flag: 'servers',
    boostIn: ['experience'],
    available: hasExperience,
    run: (ctx) => ctx.send({ type: 'join/lowest', placeId: placeIdOf(ctx) }),
  },
  {
    id: 'join-random',
    label: 'Join random server',
    icon: '🎲',
    section: 'Servers',
    flag: 'servers',
    boostIn: ['experience'],
    available: hasExperience,
    run: (ctx) => ctx.send({ type: 'join/random', placeId: placeIdOf(ctx) }),
  },
  {
    id: 'preview-smart-join',
    label: 'Preview Smart Join choice',
    hint: 'Work out the pick without joining',
    icon: '👁',
    section: 'Servers',
    flag: 'smartJoin',
    boostIn: ['experience'],
    available: hasExperience,
    run: (ctx) => {
      ctx.send({ type: 'smartJoin/plan', placeId: placeIdOf(ctx) });
      ctx.openPanel('servers');
    },
  },
  {
    id: 'refresh-servers',
    label: 'Refresh server list',
    icon: '↻',
    section: 'Servers',
    flag: 'servers',
    boostIn: ['experience'],
    available: hasExperience,
    run: (ctx) => ctx.send({ type: 'servers/scan', placeId: placeIdOf(ctx), force: true }),
  },
  {
    id: 'rejoin',
    label: 'Rejoin last server',
    icon: '↩',
    section: 'Servers',
    flag: 'servers',
    available: hasLastJoined,
    run: (ctx) => {
      const last = ctx.state.lastJoined!;
      ctx.send({ type: 'join/server', placeId: last.placeId, jobId: last.jobId });
    },
  },

  /*
   * The flag commands exist because of the loop in spec section 15: the user alt-tabs
   * back having just seen an exploiter, and the fastest possible path to recording that
   * is a keystroke and three letters.
   */
  {
    id: 'flag-clean',
    label: 'Flag last server: Clean',
    icon: '👍',
    section: 'Flag',
    available: hasLastJoined,
    run: (ctx) => flagLast(ctx, 'clean'),
  },
  {
    id: 'flag-exploiter',
    label: 'Flag last server: Exploiter',
    icon: '⚠',
    section: 'Flag',
    available: hasLastJoined,
    run: (ctx) => flagLast(ctx, 'exploiters'),
  },
  {
    id: 'flag-bugged',
    label: 'Flag last server: Bugged',
    icon: '🐛',
    section: 'Flag',
    available: hasLastJoined,
    run: (ctx) => flagLast(ctx, 'bugged'),
  },
  {
    id: 'flag-avoid',
    label: 'Flag last server: Avoid',
    icon: '🚫',
    section: 'Flag',
    available: hasLastJoined,
    run: (ctx) => flagLast(ctx, 'avoid'),
  },

  {
    id: 'copy-user-id',
    label: 'Copy user ID',
    icon: '🆔',
    section: 'Profile',
    onlyIn: ['profile'],
    available: (ctx) => Boolean(ctx.userId),
    run: (ctx) => ctx.copy(ctx.userId ?? ''),
  },
  {
    id: 'blacklist-profile',
    label: 'Blacklist this player',
    hint: 'Opens the blacklist with the panel',
    icon: '🚫',
    section: 'Profile',
    flag: 'playerBlacklist',
    onlyIn: ['profile'],
    run: (ctx) => ctx.openPanel('blacklist'),
  },
  {
    id: 'copy-place-id',
    label: 'Copy place ID',
    icon: '📋',
    section: 'Experience',
    boostIn: ['experience'],
    available: hasExperience,
    run: (ctx) => ctx.copy(placeIdOf(ctx)),
  },

  { id: 'open-servers', label: 'Open server browser', icon: '🖥', section: 'Open', flag: 'servers', run: (ctx) => ctx.openPanel('servers') },
  { id: 'open-history', label: 'Open server history', icon: '🕘', section: 'Open', flag: 'serverHistory', run: (ctx) => ctx.openPanel('history') },
  { id: 'open-blacklist', label: 'Open player blacklist', icon: '🚫', section: 'Open', flag: 'playerBlacklist', run: (ctx) => ctx.openPanel('blacklist') },
  { id: 'open-flags', label: 'Open your flags', icon: '🚩', section: 'Open', run: (ctx) => ctx.openPanel('flags') },
  { id: 'open-playtime', label: 'Open playtime and live stats', icon: '⏱', section: 'Open', flag: 'playtime', run: (ctx) => ctx.openPanel('playtime') },
  { id: 'open-themes', label: 'Change theme', hint: 'Recolour Roblox and this extension', icon: '🎨', section: 'Open', flag: 'themes', run: (ctx) => ctx.openPanel('themes') },
  { id: 'open-profile', label: 'Mutual friends', hint: 'Compare friends with this profile', icon: '👤', section: 'Profile', flag: 'profiles', onlyIn: ['profile'], run: (ctx) => ctx.openPanel('profile') },
  { id: 'open-search', label: 'Search for an experience', hint: 'Find a game by name', icon: '🔍', section: 'Open', flag: 'quickSearch', run: (ctx) => ctx.openPanel('search') },
  { id: 'open-private', label: 'Open private servers', hint: 'The ones you own', icon: '🔒', section: 'Open', flag: 'privateServers', run: (ctx) => ctx.openPanel('private') },
  { id: 'open-settings', label: 'Open settings', icon: '⚙', section: 'Open', run: (ctx) => ctx.send({ type: 'ui/openOptions' }) },
  { id: 'open-dashboard', label: 'Open dashboard', icon: '📊', section: 'Open', run: (ctx) => ctx.send({ type: 'ui/openDashboard' }) },
];

function flagLast(ctx: CommandContext, status: 'clean' | 'exploiters' | 'bugged' | 'avoid'): void {
  const last = ctx.state.lastJoined;
  if (!last) return;
  ctx.send({ type: 'report/setStatus', placeId: last.placeId, jobId: last.jobId, status });
}

export interface ScoredCommand {
  command: Command;
  score: number;
  positions: number[];
}

/** Ranks in-context commands above the rest, so the palette reflects the page. */
const CONTEXT_BOOST = 40;

export function rankCommands(
  query: string,
  ctx: CommandContext,
  commands: readonly Command[] = COMMANDS,
): ScoredCommand[] {
  const results: ScoredCommand[] = [];

  for (const command of commands) {
    if (command.onlyIn && !command.onlyIn.includes(ctx.page)) continue;
    if (command.flag && !ctx.state.settings.features[command.flag]) continue;
    if (command.available && !command.available(ctx)) continue;

    // Searching the hint too, so "without joining" finds the preview command.
    const haystack = command.hint ? `${command.label} ${command.hint}` : command.label;
    const match = fuzzyMatch(haystack, query);
    if (!match) continue;

    const boost = command.boostIn?.includes(ctx.page) ? CONTEXT_BOOST : 0;
    results.push({ command, score: match.score + boost, positions: match.positions });
  }

  return results.sort(
    (a, b) => b.score - a.score || a.command.label.localeCompare(b.command.label),
  );
}
