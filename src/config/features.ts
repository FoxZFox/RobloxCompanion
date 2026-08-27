import type { FeatureFlags } from '../models/settings';

export interface FeatureDefinition {
  key: keyof FeatureFlags;
  label: string;
  description: string;
  /** The phase that makes this real. Anything above the shipped phase stays off. */
  phase: number;
}

/**
 * The single registry of features (spec section 25). Settings renders straight from
 * this, and every feature checks its own flag before doing any work, so switching one
 * off genuinely stops it rather than merely hiding its UI.
 */
export const FEATURES: readonly FeatureDefinition[] = [
  { key: 'servers', label: 'Server Browser', description: 'Browse, filter and join public servers.', phase: 2 },
  { key: 'serverHistory', label: 'Server History', description: 'Remember which servers you joined and how they went.', phase: 2 },
  { key: 'playerBlacklist', label: 'Player Blacklist', description: 'Keep a local list of players to avoid.', phase: 2 },
  { key: 'quickActionBar', label: 'Quick Action Bar', description: 'Add quick actions next to the Play button.', phase: 2 },
  { key: 'smartJoin', label: 'Smart Join', description: 'Score every server and join the best one.', phase: 3 },
  { key: 'playtime', label: 'Playtime Tracking', description: 'Track time spent per experience.', phase: 7 },
  { key: 'profiles', label: 'Profile Enhancements', description: 'Mutual friends and last online on profiles.', phase: 8 },
  { key: 'avatar', label: 'Avatar Tools', description: 'Sandbox, saved outfits and quick equip.', phase: 8 },
  { key: 'themes', label: 'Themes', description: 'Custom colours and backgrounds for Roblox.', phase: 8 },
  { key: 'trading', label: 'Trading', description: 'Trade panel, values and notifications.', phase: 9 },
  { key: 'commandPalette', label: 'Command Palette', description: 'Ctrl+K to run any action by name.', phase: 10 },
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
};

/** Phases whose code actually exists today. */
export const SHIPPED_PHASE = 10;

export function isImplemented(feature: FeatureDefinition): boolean {
  return feature.phase <= SHIPPED_PHASE;
}
