/**
 * Whether a palette can safely be painted over Roblox's own page.
 *
 * This exists because of a failure that looks exactly like broken code and is not. Our
 * CSS may only set three colour properties (robloxSurfaces.ts, enforced by test), so it
 * cannot hide anything - but it can paint a container dark while Roblox's own rules,
 * which are more specific and sit on inner elements, keep the text inside it dark too.
 * The content is all still there, in a colour nobody can read.
 *
 * Roblox already has a light and a dark theme of its own, and it colours its text for
 * whichever is on. So a dark palette belongs over Roblox's dark theme and a light one
 * over its light theme; the other way round is not a worse-looking theme, it is an
 * unreadable page. When they disagree we leave Roblox's page alone and say why, rather
 * than half-painting it and letting someone conclude their profile stopped loading.
 */
export type PageTheme = 'dark' | 'light' | null;

/** `null` means Roblox has not told us, and no theme is a good enough reason to guess. */
export function conflictsWithPage(base: 'dark' | 'light', page: PageTheme): boolean {
  return page !== null && page !== base;
}
