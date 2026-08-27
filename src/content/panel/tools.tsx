import type { AppState, UiRequest } from '../../models/messages';
import type { FeatureFlags } from '../../models/settings';
import { SmartJoinPanel } from '../../components/SmartJoinPanel';
import { LastJoinedCard } from '../../components/LastJoinedCard';
import { BlacklistTab, HistoryTab, ServersTab } from '../../components/tabs';
import { FlagsPane } from './FlagsPane';
import { PlaytimePane } from '../../components/PlaytimePane';
import { QuickActions } from './QuickActions';

export interface ToolProps {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
}

export interface ToolDefinition {
  id: string;
  /** Rail icon. */
  icon: string;
  /** Rail label, kept to roughly eight characters so the rail stays narrow. */
  label: string;
  title: string;
  /** Hidden when its feature flag is off, so the rail reflects what is actually on. */
  flag?: keyof FeatureFlags;
  /** A count worth surfacing on the rail and launcher, e.g. flagged servers. */
  badge?: (state: AppState) => number;
  render: (props: ToolProps) => React.JSX.Element;
}

/**
 * Every tool in the panel, in rail order.
 *
 * This registry is the reason the panel was built this way. A new feature adds one entry
 * here and appears in the rail with no layout decisions to make and nothing else to
 * touch - which is what stops a growing extension turning into nested menus.
 */
export const TOOLS: readonly ToolDefinition[] = [
  {
    id: 'servers',
    icon: '\u{1F5A5}',
    label: 'Servers',
    title: 'Server browser',
    flag: 'servers',
    badge: (state) => state.health.flagged,
    render: ({ state, busy, send }) => (
      <>
        <LastJoinedCard state={state} busy={busy} send={send} />
        <QuickActions state={state} busy={busy} send={send} />
        <SmartJoinPanel state={state} />
        <ServersTab state={state} busy={busy} send={send} />
      </>
    ),
  },
  {
    id: 'history',
    icon: '\u{1F553}',
    label: 'History',
    title: 'Servers you have joined',
    flag: 'serverHistory',
    render: (props) => <HistoryTab {...props} />,
  },
  {
    id: 'blacklist',
    icon: '\u{1F6AB}',
    label: 'Players',
    title: 'Player blacklist',
    flag: 'playerBlacklist',
    badge: (state) => state.blacklist.length,
    render: (props) => <BlacklistTab {...props} />,
  },
  {
    id: 'playtime',
    icon: '\u{23F1}',
    label: 'Time',
    title: 'Playtime and live stats',
    flag: 'playtime',
    render: (props) => <PlaytimePane {...props} />,
  },
  {
    id: 'flags',
    icon: '\u{1F6A9}',
    label: 'Flags',
    title: 'Your own flags',
    render: (props) => <FlagsPane {...props} />,
  },
];

export function visibleTools(state: AppState): ToolDefinition[] {
  return TOOLS.filter((tool) => !tool.flag || state.settings.features[tool.flag]);
}

export function resolveTool(state: AppState, id: string): ToolDefinition {
  const available = visibleTools(state);
  // Falling back rather than rendering nothing: a tool can vanish when its feature is
  // switched off while the panel is open.
  return available.find((tool) => tool.id === id) ?? available[0] ?? TOOLS[0]!;
}
