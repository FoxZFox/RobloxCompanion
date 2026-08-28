/**
 * Theme model (phase 8).
 *
 * A theme is nothing but colour: no images, no fonts fetched from anywhere, no assets of
 * any kind. Every palette here was authored for this project (spec section 23 forbids
 * reusing anyone else's themes or artwork), and the whole feature is CSS the extension
 * writes itself, so it needs no Roblox endpoint and could ship while phases 6, 8 and 9
 * wait on API verification.
 */

/**
 * The resolved colour set every surface reads. These map one-to-one onto the `--rc-*`
 * custom properties declared in components/theme.css, which is what lets a theme reach
 * the popup, the side panel, the dashboard, the options page and the injected panel
 * without any of them knowing a theme exists.
 */
export interface ThemeTokens {
  bg: string;
  bgSubtle: string;
  bgRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentText: string;
}

/**
 * The three colours a human actually picks. Everything else is derived from them, so a
 * palette cannot end up internally inconsistent - a mid-grey border against a black
 * background and a white one against a light background come out of the same rule
 * rather than out of someone remembering to change both.
 */
export interface ThemeInput {
  background: string;
  text: string;
  accent: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  /** One line, shown under the name in the picker. */
  description: string;
  /** Which of Roblox's own themes this palette was drawn to sit on. */
  base: 'dark' | 'light';
  input: ThemeInput;
}

/** `off` injects nothing at all; `custom` uses the colours in `ThemeSettings.custom`. */
export const THEME_OFF = 'off';
export const THEME_CUSTOM = 'custom';

export interface ThemeSettings {
  /** A preset id, `custom`, or `off`. */
  preset: string;
  custom: ThemeInput;
  /**
   * Whether to restyle roblox.com's own chrome as well as the extension's UI.
   *
   * Off means the theme still applies in full to everything this extension draws; only
   * Roblox's own page is left alone. It is separate from the preset because the two
   * carry very different risk: our own surfaces are ours to restyle and cannot break,
   * while Roblox's depend on class names they rename without notice.
   */
  restyleRobloxPage: boolean;
}

export type ThemePatch = Partial<Omit<ThemeSettings, 'custom'>> & {
  custom?: Partial<ThemeInput>;
};

/**
 * Nothing until the user picks something.
 *
 * A themes feature that turns itself on would repaint roblox.com the first time the
 * extension updates, which is not a thing to do to someone's browser uninvited.
 */
export const DEFAULT_THEME: ThemeSettings = {
  preset: THEME_OFF,
  custom: {
    background: '#12141a',
    text: '#e9edf2',
    accent: '#5b8cff',
  },
  restyleRobloxPage: true,
};

export function mergeTheme(base: ThemeSettings, patch: ThemePatch | undefined): ThemeSettings {
  if (!patch) return base;
  return {
    preset: patch.preset ?? base.preset,
    custom: { ...base.custom, ...patch.custom },
    restyleRobloxPage: patch.restyleRobloxPage ?? base.restyleRobloxPage,
  };
}
