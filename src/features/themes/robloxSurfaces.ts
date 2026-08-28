import type { ThemeTokens } from '../../models/theme';

/**
 * The parts of roblox.com a theme repaints, and the one place their class names live.
 *
 * This is a fragile point by construction, in the same family as PLAY_ANCHORS: it is
 * coupled to markup Roblox rewrites without notice. The difference is that a Play button
 * we cannot find is obvious - the bar does not appear - whereas a theme that half applies
 * just looks like a bad theme.
 *
 * So the groups are separate, each is applied on its own, and every one can be counted
 * against the live page at runtime (see measureSurfaces in the injector). The panel shows
 * how many actually matched, which turns "the theme looks wrong" into "Roblox renamed the
 * navigation class" without anyone having to guess.
 *
 * Verified live on 28 Aug 2026, on a real Roblox page: all six groups matched - page 5,
 * navigation 2, cards 19, buttons 16, links 8, fields 4. The injected stylesheet was also
 * accepted, so roblox.com's CSP does not stand in the way of a content script writing one.
 * Both facts were measured rather than assumed, and both can stop being true.
 *
 * Rules for anything added here:
 *   - colour only. No display, position, size or spacing: a theme must not move the page.
 *   - never hide anything. This is a paint job, not a content blocker.
 *   - leave images, thumbnails and avatars alone.
 *   - pair every background with a foreground, so a match can never produce
 *     text the same colour as what is behind it.
 */
export interface RobloxSurface {
  id: string;
  /** Shown in the match report, so it has to read as a part of the page, not a selector. */
  label: string;
  selectors: readonly string[];
  declarations: (tokens: ThemeTokens) => readonly string[];
}

export const ROBLOX_SURFACES: readonly RobloxSurface[] = [
  {
    id: 'page',
    label: 'Page background',
    selectors: ['html', 'body', '#container-main', '.container-main', '#content'],
    declarations: (t) => [`background-color: ${t.bg}`, `color: ${t.text}`],
  },
  {
    id: 'navigation',
    label: 'Header and navigation',
    selectors: ['#header', '.rbx-header', '.navbar-universal', '#navigation', '.left-col-content'],
    declarations: (t) => [
      `background-color: ${t.bgRaised}`,
      `color: ${t.text}`,
      `border-color: ${t.border}`,
    ],
  },
  {
    id: 'surfaces',
    label: 'Cards and sections',
    selectors: ['.section-content', '.card-item', '.container-list', '.rbx-tab-content'],
    declarations: (t) => [
      `background-color: ${t.bgSubtle}`,
      `color: ${t.text}`,
      `border-color: ${t.border}`,
    ],
  },
  {
    id: 'buttons',
    label: 'Primary buttons',
    selectors: [
      '.btn-primary-xs',
      '.btn-primary-sm',
      '.btn-primary-md',
      '.btn-primary-lg',
      '.btn-growth-xs',
      '.btn-growth-sm',
      '.btn-growth-md',
      '.btn-growth-lg',
    ],
    declarations: (t) => [
      `background-color: ${t.accent}`,
      `border-color: ${t.accent}`,
      `color: ${t.accentText}`,
    ],
  },
  {
    id: 'links',
    label: 'Links',
    selectors: ['a.text-link', '.text-link'],
    declarations: (t) => [`color: ${t.accent}`],
  },
  {
    id: 'inputs',
    label: 'Text fields',
    selectors: ['.input-field', '.form-control', 'input.form-control', 'textarea.form-control'],
    declarations: (t) => [
      `background-color: ${t.bgRaised}`,
      `color: ${t.text}`,
      `border-color: ${t.borderStrong}`,
    ],
  },
];
