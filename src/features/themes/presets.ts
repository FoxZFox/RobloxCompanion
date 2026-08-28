import type { ThemePreset } from '../../models/theme';

/**
 * The palettes that ship with the extension.
 *
 * Each is three colours, written here by hand for this project; every other shade is
 * derived (see colors.ts). Nothing is copied from RoPro or from any other extension -
 * spec section 23 rules that out, and it would be indefensible anyway for a project whose
 * whole pitch is doing the work honestly.
 *
 * `base` records which of Roblox's own themes a palette was drawn against. It does not
 * force anything: it drives the "you are on Roblox's light theme, this palette was drawn
 * for the dark one" note in the picker, because telling someone why a theme looks wrong
 * beats silently overriding the choice they made on Roblox itself.
 */
export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep blue-black with a cold accent.',
    base: 'dark',
    input: { background: '#0f1420', text: '#e6ecf5', accent: '#5b8cff' },
  },
  {
    id: 'carbon',
    name: 'Carbon',
    description: 'Neutral near-black. Nothing competes with the page.',
    base: 'dark',
    input: { background: '#141516', text: '#ededee', accent: '#8b93a7' },
  },
  {
    id: 'ember',
    name: 'Ember',
    description: 'Warm dark grey with an orange accent.',
    base: 'dark',
    input: { background: '#191512', text: '#f2e9e2', accent: '#ff8a3d' },
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Dark green, low contrast, easy for long sessions.',
    base: 'dark',
    input: { background: '#111a16', text: '#e2ece6', accent: '#3fbf82' },
  },
  {
    id: 'paper',
    name: 'Paper',
    description: 'Warm light background, dark ink.',
    base: 'light',
    input: { background: '#f7f5f0', text: '#22201c', accent: '#c0562b' },
  },
  {
    id: 'daylight',
    name: 'Daylight',
    description: 'Clean white with a blue accent.',
    base: 'light',
    input: { background: '#ffffff', text: '#1b1e23', accent: '#1268d3' },
  },
];

export function findPreset(id: string): ThemePreset | null {
  return THEME_PRESETS.find((preset) => preset.id === id) ?? null;
}
