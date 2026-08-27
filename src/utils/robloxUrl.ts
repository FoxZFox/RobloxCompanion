/**
 * Extracts a placeId from a roblox.com URL.
 *
 * Covers the shapes Roblox actually serves today: the canonical game page, the share
 * link that carries the id in a query parameter, and the direct launch URL.
 */
export function parsePlaceId(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!url.hostname.endsWith('roblox.com')) return null;

  const fromPath = /^\/games\/(\d+)(?:\/|$)/.exec(url.pathname);
  if (fromPath?.[1]) return fromPath[1];

  const fromQuery = url.searchParams.get('placeId');
  if (fromQuery && /^\d+$/.test(fromQuery)) return fromQuery;

  return null;
}

export function isExperiencePage(rawUrl: string | undefined): boolean {
  return parsePlaceId(rawUrl) !== null;
}

/** Finds the placeId of whichever Roblox tab the user is looking at, if any. */
export async function detectActivePlaceId(): Promise<string | null> {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  const fromActive = parsePlaceId(active?.url);
  if (fromActive) return fromActive;

  // The user may be looking at the extension's own dashboard, so fall back to any
  // Roblox game tab that is open.
  const tabs = await chrome.tabs.query({ url: 'https://www.roblox.com/games/*' });
  for (const tab of tabs) {
    const placeId = parsePlaceId(tab.url);
    if (placeId) return placeId;
  }
  return null;
}

/** Which kind of Roblox page we are on, used to order palette commands (spec section 41). */
export type PageContext = 'experience' | 'profile' | 'catalog' | 'trades' | 'other';

export function parseUserId(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    if (!url.hostname.endsWith('roblox.com')) return null;
    const match = /^\/users\/(\d+)/.exec(url.pathname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Classifies the current page.
 *
 * Drives which commands are offered first: on an experience the server actions matter,
 * on a profile the actions about that person do. Anything unrecognised falls back to
 * `other`, which still offers the global commands rather than an empty palette.
 */
export function detectPageContext(rawUrl: string | undefined): PageContext {
  if (!rawUrl) return 'other';
  if (parsePlaceId(rawUrl)) return 'experience';
  if (parseUserId(rawUrl)) return 'profile';

  try {
    const path = new URL(rawUrl).pathname;
    if (path.startsWith('/catalog') || path.startsWith('/bundles')) return 'catalog';
    if (path.startsWith('/trades')) return 'trades';
  } catch {
    return 'other';
  }
  return 'other';
}
