import type { FeatureFlags } from '../models/settings';

export interface FeatureDefinition {
  key: keyof FeatureFlags;
  label: string;
  description: string;
  /** The phase this belongs to. Used to explain what is coming, never to decide anything. */
  phase: number;
  /**
   * Whether the code behind it actually exists in this build.
   *
   * This used to be derived from a single `SHIPPED_PHASE` watermark, which quietly
   * assumed phases ship in order. They do not: phase 10's command palette shipped while
   * phase 8 was still research, so every phase 8 and 9 toggle rendered enabled and did
   * nothing when the user turned it on. A per-feature fact cannot drift like that.
   */
  shipped: boolean;
}

/**
 * The single registry of features (spec section 25). Settings renders straight from
 * this, and every feature checks its own flag before doing any work, so switching one
 * off genuinely stops it rather than merely hiding its UI.
 */
export const FEATURES: readonly FeatureDefinition[] = [
  { key: 'servers', label: 'Server Browser', description: 'Browse, filter and join public servers.', phase: 2, shipped: true },
  { key: 'serverHistory', label: 'Server History', description: 'Remember which servers you joined and how they went.', phase: 2, shipped: true },
  { key: 'playerBlacklist', label: 'Player Blacklist', description: 'Keep a local list of players to avoid.', phase: 2, shipped: true },
  { key: 'quickActionBar', label: 'Quick Action Bar', description: 'Add quick actions next to the Play button.', phase: 2, shipped: true },
  { key: 'smartJoin', label: 'Smart Join', description: 'Score every server and join the best one.', phase: 3, shipped: true },
  { key: 'playtime', label: 'Playtime Tracking', description: 'Track time spent per experience.', phase: 7, shipped: true },
  { key: 'quickSearch', label: 'Quick Search', description: 'Search Roblox for an experience from the panel.', phase: 7, shipped: true },
  { key: 'privateServers', label: 'Private Servers', description: 'See the private servers you own for an experience.', phase: 6, shipped: true },
  { key: 'profiles', label: 'Profile Enhancements', description: 'Compare friends with the profile you are viewing.', phase: 8, shipped: true },
  { key: 'avatar', label: 'Avatar Tools', description: 'Sandbox, saved outfits and quick equip.', phase: 8, shipped: false },
  { key: 'themes', label: 'Themes', description: 'Recolour Roblox and this extension. Colour only - no assets, no layout changes.', phase: 8, shipped: true },
  { key: 'trading', label: 'Trading', description: 'Trade panel, values and notifications.', phase: 9, shipped: false },
  { key: 'commandPalette', label: 'Command Palette', description: 'Ctrl+K to run any action by name.', phase: 10, shipped: true },
];

/** Phases 4 and 5 added no new toggles: custom flags and backup are part of the server
 * and blacklist features that already have one. A feature flag that guards nothing would
 * be worse than none at all. */
export const PHASE_NOTES: readonly string[] = [
  'phase 4: custom flags live under the Server Browser feature',
  'phase 5: backup and restore live under Player Blacklist and Settings',
];

/**
 * Which features first became controllable at each storage schema version.
 *
 * Settings disables the toggle for anything not yet implemented, so a stored value from
 * before a feature shipped was never a choice the user made - it was whatever the
 * default happened to be at the time. Storage migration drops those entries so the
 * current default applies, while leaving genuine choices alone.
 *
 * Shipping a feature switched on by default therefore means adding it here as well, or
 * it stays invisible to everyone who already had settings saved. That is exactly how
 * playtime shipped and nobody could find it.
 */
export const FEATURES_INTRODUCED_AT: Readonly<Record<number, readonly (keyof FeatureFlags)[]>> = {
  2: ['playtime'],
  3: ['commandPalette'],
  4: ['themes'],
  5: ['privateServers'],
  6: ['quickSearch'],
  7: ['profiles'],
};

/**
 * Drops the flags the user could not have chosen at version `from`, so the current
 * default applies to them instead.
 *
 * Shared by storage migration and backup import: a bundle exported before a feature
 * existed carries the same stale `false` that a stored settings object does, and it
 * would pin it just as effectively.
 */
export function unpinFeaturesIntroducedAfter(
  features: Partial<FeatureFlags>,
  from: number,
): Partial<FeatureFlags> {
  const next = { ...features };
  for (const [version, introduced] of Object.entries(FEATURES_INTRODUCED_AT)) {
    if (Number(version) <= from) continue;
    for (const key of introduced) delete next[key];
  }
  return next;
}

export function isImplemented(feature: FeatureDefinition): boolean {
  return feature.shipped;
}
