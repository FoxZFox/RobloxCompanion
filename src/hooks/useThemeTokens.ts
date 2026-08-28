import { useEffect } from 'react';
import { TOKEN_PROPERTY_NAMES, hostTokens, resolveTheme } from '../features/themes/buildThemeCss';
import type { AppState } from '../models/messages';

/**
 * Applies the chosen theme to an extension page.
 *
 * The injected panel gets its palette from the content script, which has a page to write
 * a stylesheet into; the popup, side panel, dashboard and options page have no such
 * thing, so they set the same tokens on their own root element. Inline properties beat
 * the stylesheet, so this needs no `!important` and no injected CSS.
 *
 * Themes therefore reach every surface from one setting, which is the point: a user who
 * picks Midnight should not find the options page still white.
 */
export function useThemeTokens(state: AppState | null): void {
  const theme = state?.settings.theme;
  const enabled = state?.settings.features.themes ?? false;

  useEffect(() => {
    const root = document.documentElement;
    const resolved = theme ? resolveTheme(theme, enabled) : null;

    if (!resolved) {
      // Back to the palette in theme.css, which follows the OS light/dark setting.
      for (const property of TOKEN_PROPERTY_NAMES) root.style.removeProperty(property);
      return;
    }

    for (const [property, value] of Object.entries(hostTokens(resolved.tokens))) {
      root.style.setProperty(property, value);
    }
  }, [theme, enabled]);
}
