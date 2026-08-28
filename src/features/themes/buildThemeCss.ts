import type { ThemeInput, ThemeSettings, ThemeTokens } from '../../models/theme';
import { DEFAULT_THEME, THEME_CUSTOM, THEME_OFF } from '../../models/theme';
import { deriveTokens, relativeLuminance, sanitiseInput } from './colors';
import { findPreset } from './presets';
import { ROBLOX_SURFACES } from './robloxSurfaces';

/**
 * Turns theme settings into the CSS that gets injected, and nothing else.
 *
 * Kept free of the DOM so the whole of it is unit-testable: what a palette produces, what
 * happens to a colour that is not a colour, and whether a rule can escape its block are
 * all questions answerable without a browser.
 */

export interface ResolvedTheme {
  /** The preset id, or `custom`. */
  id: string;
  name: string;
  base: 'dark' | 'light';
  tokens: ThemeTokens;
  restyleRobloxPage: boolean;
  /** Colours refused because they were not hex literals; the default was used instead. */
  rejected: (keyof ThemeInput)[];
}

/** CSS custom property for each token, matching components/theme.css exactly. */
const TOKEN_PROPERTIES: Readonly<Record<keyof ThemeTokens, string>> = {
  bg: '--rc-bg',
  bgSubtle: '--rc-bg-subtle',
  bgRaised: '--rc-bg-raised',
  border: '--rc-border',
  borderStrong: '--rc-border-strong',
  text: '--rc-text',
  textMuted: '--rc-text-muted',
  textFaint: '--rc-text-faint',
  accent: '--rc-accent',
  accentText: '--rc-accent-text',
};

/** Every property a theme sets, for clearing them again when it is switched off. */
export const TOKEN_PROPERTY_NAMES: readonly string[] = Object.values(TOKEN_PROPERTIES);

/**
 * `null` means inject nothing - which is not the same as injecting an empty theme. A
 * disabled feature or an unknown preset id must leave the page exactly as it was.
 */
export function resolveTheme(settings: ThemeSettings, enabled: boolean): ResolvedTheme | null {
  if (!enabled || settings.preset === THEME_OFF) return null;

  if (settings.preset === THEME_CUSTOM) {
    const { input, rejected } = sanitiseInput(settings.custom, DEFAULT_THEME.custom);
    return {
      id: THEME_CUSTOM,
      name: 'Custom',
      // Derived from the colours themselves rather than stored: someone who picks a pale
      // background has made a light theme whatever the setting says.
      base: isLight(input) ? 'light' : 'dark',
      tokens: deriveTokens(input),
      restyleRobloxPage: settings.restyleRobloxPage,
      rejected,
    };
  }

  const preset = findPreset(settings.preset);
  // An id we do not recognise - a newer build's preset arriving in an imported backup,
  // say - leaves the page alone rather than falling back to a palette nobody chose.
  if (!preset) return null;

  return {
    id: preset.id,
    name: preset.name,
    base: preset.base,
    tokens: deriveTokens(preset.input),
    restyleRobloxPage: settings.restyleRobloxPage,
    rejected: [],
  };
}

function isLight(input: ThemeInput): boolean {
  return relativeLuminance(input.background) > 0.35;
}

/**
 * The token block, which is all that is needed to theme everything this extension draws.
 *
 * `:root.dark-theme` and `:root.light-theme` are listed as well as `:root` because
 * components/theme.css sets its dark palette on `.dark-theme`, and a bare `:root` block
 * ties with it on specificity - leaving the winner to depend on stylesheet order, which
 * is not a thing to leave to chance on a page we do not control.
 */
function tokenBlock(tokens: ThemeTokens): string {
  const declarations = (Object.keys(TOKEN_PROPERTIES) as (keyof ThemeTokens)[])
    .map((key) => `  ${TOKEN_PROPERTIES[key]}: ${tokens[key]};`)
    .join('\n');
  return `:root.dark-theme,\n:root.light-theme,\n:root {\n${declarations}\n}`;
}

/**
 * Roblox's own surfaces. Values are written literally rather than as `var(--rc-bg)`: if
 * the token block ever failed to apply, a page painted with undefined variables would be
 * far worse than a page left alone.
 *
 * `!important` is needed because Roblox's own rules are more specific than anything we
 * can write from outside their stylesheet.
 */
function surfaceBlocks(tokens: ThemeTokens): string {
  return ROBLOX_SURFACES.map((surface) => {
    const declarations = surface.declarations(tokens)
      .map((declaration) => `  ${declaration} !important;`)
      .join('\n');
    return `/* ${surface.label} */\n${surface.selectors.join(',\n')} {\n${declarations}\n}`;
  }).join('\n\n');
}

export function buildThemeCss(theme: ResolvedTheme): string {
  const parts = [`/* Roblox Companion theme: ${theme.name} */`, tokenBlock(theme.tokens)];
  if (theme.restyleRobloxPage) parts.push(surfaceBlocks(theme.tokens));
  return `${parts.join('\n\n')}\n`;
}

/**
 * The same tokens as inline custom properties for the panel's shadow host.
 *
 * The panel deliberately redeclares its tokens on `:host` so it is never left unstyled,
 * which also means a `:root` block cannot reach it. Inline properties on the host outrank
 * `:host` rules - the same cascade quirk that once wiped the panel's own positioning.
 */
export function hostTokens(tokens: ThemeTokens): Record<string, string> {
  const entries = (Object.keys(TOKEN_PROPERTIES) as (keyof ThemeTokens)[]).map((key) => [
    TOKEN_PROPERTIES[key],
    tokens[key],
  ]);
  return Object.fromEntries(entries) as Record<string, string>;
}
