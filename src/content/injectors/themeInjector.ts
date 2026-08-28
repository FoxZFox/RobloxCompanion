import {
  TOKEN_PROPERTY_NAMES,
  buildThemeCss,
  hostTokens,
  resolveTheme,
  type ResolvedTheme,
} from '../../features/themes/buildThemeCss';
import { conflictsWithPage, type PageTheme } from '../../features/themes/pageTheme';
import { ROBLOX_SURFACES } from '../../features/themes/robloxSurfaces';
import { SettingsRepository } from '../../services/storage/SettingsRepository';
import { onSettingsChanged } from '../../services/storage/settingsWatcher';
import { chromeStorage } from '../../services/storage/storageArea';

/**
 * Puts the theme on the page, and measures what it actually managed to do.
 *
 * Two things get painted from one palette. The `<style>` element covers roblox.com and
 * anything this extension injects into the page directly; the panel's shadow host has to
 * be set separately, because it redeclares its tokens on `:host` so it can never be left
 * unstyled - which also means a `:root` block cannot reach it. Inline properties on the
 * host outrank `:host` rules, the same cascade quirk that once wiped the panel's own
 * positioning.
 *
 * Nothing here is claimed rather than checked. Whether the stylesheet survived
 * roblox.com's CSP is read back off the element, and how much of Roblox's own markup the
 * theme found is counted against the live page - so the panel can report "4 of 6 parts
 * matched" instead of leaving someone to work out why their theme looks half-applied.
 */

const STYLE_ID = 'rc-theme';
const PANEL_HOST_ID = 'roblox-companion-panel';

export type ThemeState =
  /** No theme chosen, or the feature is off. Nothing is injected. */
  | { status: 'off' }
  | {
      status: 'applied';
      name: string;
      /** Whether Roblox's own page is being painted, after the conflict check. */
      restyleRobloxPage: boolean;
      /** Set when the page was deliberately left alone: palette and page disagree. */
      conflict: { palette: 'dark' | 'light'; page: 'dark' | 'light' } | null;
    }
  /** The page's Content-Security-Policy refused our stylesheet. */
  | { status: 'blocked'; name: string };

let state: ThemeState = { status: 'off' };
let applied: ResolvedTheme | null = null;
let lastPageTheme: PageTheme = null;

/**
 * Reads whichever light/dark theme Roblox itself is running.
 *
 * Read off the page rather than from `prefers-color-scheme`: Roblox has its own setting,
 * and it is the one that decided what colour the text on this page is.
 */
function readPageTheme(): PageTheme {
  const source = document.querySelector('.dark-theme, .light-theme');
  if (!source) return null;
  return source.classList.contains('dark-theme') ? 'dark' : 'light';
}

export function themeState(): ThemeState {
  return state;
}

export interface SurfaceMatch {
  id: string;
  label: string;
  /** How many elements on the page this group's selectors find, right now. */
  matched: number;
}

/**
 * Counts what each surface group matches on the page as it stands.
 *
 * Measured on demand rather than at inject time: Roblox renders client-side, so counting
 * during bootstrap would mostly count an empty page.
 */
export function measureSurfaces(root: ParentNode = document): SurfaceMatch[] {
  return ROBLOX_SURFACES.map((surface) => {
    let matched = 0;
    for (const selector of surface.selectors) {
      try {
        matched += root.querySelectorAll(selector).length;
      } catch {
        // A selector the browser refuses must not take the whole report down with it.
      }
    }
    return { id: surface.id, label: surface.label, matched };
  });
}

/**
 * Writes the stylesheet and reports whether the page accepted it.
 *
 * roblox.com's CSP is why this is checked rather than assumed. A blocked `<style>` leaves
 * an element in the DOM with no stylesheet attached, so `sheet` being null is the
 * difference between "the theme is on" and "the theme did nothing and said nothing".
 */
function writeStyle(css: string): boolean {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    // Last in head, so it lands after Roblox's own stylesheets in the cascade.
    (document.head ?? document.documentElement).append(style);
  }
  style.textContent = css;
  return style.sheet !== null;
}

/**
 * Repaints the panel's shadow host, which keeps its own copy of the tokens.
 *
 * A missing host is normal rather than an error: the panel may not have mounted yet, or
 * may have failed to, and neither is a reason for the rest of the theme not to apply.
 */
export function paintPanelHost(): void {
  const host = document.getElementById(PANEL_HOST_ID);
  if (!host) return;

  if (!applied) {
    // Clearing the properties is how a theme is switched off: the `:host` rules
    // underneath take over and the panel goes back to following Roblox's own choice.
    for (const property of TOKEN_PROPERTY_NAMES) host.style.removeProperty(property);
    return;
  }

  for (const [property, value] of Object.entries(hostTokens(applied.tokens))) {
    host.style.setProperty(property, value);
  }
}

export function applyTheme(theme: ResolvedTheme | null): ThemeState {
  applied = theme;

  if (!theme) {
    document.getElementById(STYLE_ID)?.remove();
    paintPanelHost();
    state = { status: 'off' };
    lastPageTheme = null;
    return state;
  }

  const page = readPageTheme();
  lastPageTheme = page;

  /*
   * A dark palette over Roblox's light theme (or the reverse) leaves their own text sitting
   * on our background in a colour chosen for the opposite one - readable content painted
   * invisible, which reads as "the page stopped loading". Our own surfaces are unaffected
   * because we colour their text too, so only Roblox's page is held back.
   */
  const conflict = theme.restyleRobloxPage && conflictsWithPage(theme.base, page);
  const painted: ResolvedTheme = conflict ? { ...theme, restyleRobloxPage: false } : theme;

  const accepted = writeStyle(buildThemeCss(painted));
  paintPanelHost();

  state = accepted
    ? {
        status: 'applied',
        name: theme.name,
        restyleRobloxPage: painted.restyleRobloxPage,
        conflict: conflict && page ? { palette: theme.base, page } : null,
      }
    : { status: 'blocked', name: theme.name };
  return state;
}

/**
 * Reads the chosen theme and keeps it in step with Settings.
 *
 * Settings are read through the repository rather than from chrome.storage directly, so
 * the defaults and the override merge are exactly the ones the service worker applies.
 * Reading them here rather than asking the service worker also means the theme does not
 * wait on a message round trip, nor on the network call that building the full app state
 * involves - a theme that arrives a second late is a flash of the wrong colours.
 */
export async function startThemeInjector(): Promise<void> {
  const settings = new SettingsRepository(chromeStorage);

  const paint = async (): Promise<void> => {
    const resolved = await settings.reload();
    applyTheme(resolveTheme(resolved.theme, resolved.features.themes));
  };

  await paint();
  onSettingsChanged(() => {
    void paint();
  });

  /*
   * Roblox's own light/dark switch decides whether our palette is safe to put on their
   * page, and it can be flipped without a reload, so the decision has to be revisited
   * when it changes. Compared against the last value first: their React stamps class
   * changes constantly, and rebuilding the stylesheet on each one would be wasteful.
   */
  const observer = new MutationObserver(() => {
    if (readPageTheme() === lastPageTheme) return;
    if (applied) applyTheme(applied);
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
    subtree: true,
  });
}
