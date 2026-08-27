import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PANEL_STYLES } from './panelStyles';
import { SHARED_STYLES } from './sharedStyles';
import { PanelShell } from './PanelShell';

const HOST_ID = 'roblox-companion-panel';

/**
 * Mounts the panel into a Shadow DOM root on the Roblox page.
 *
 * Shadow DOM is doing real work here, in both directions. roblox.com's global CSS is
 * broad enough to restyle anything we inject - and anything we inject could just as
 * easily break their layout. A closed style boundary is the only way an injected window
 * stays predictable across a site we do not control and whose markup changes often.
 *
 * The styles travel as strings for the same reason: a stylesheet emitted as its own file
 * lands in the main document, where the shadow root cannot see it.
 */
export function mountPanel(): void {
  // Idempotent: Roblox's client-side router can re-run our bootstrap on navigation.
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement('div');
  host.id = HOST_ID;

  /*
   * Set inline, with !important, and never via `all: initial`.
   *
   * `all: initial` looked like the safe way to stop the page styling our host, but an
   * inline declaration outranks the `:host` rules inside the shadow root, so it was
   * silently resetting position and z-index - leaving the panel static and underneath
   * Roblox's own layers. The host needs exactly these five properties and nothing else.
   *
   * !important is what keeps it above roblox.com, whose own stacking goes high.
   */
  host.style.cssText = [
    'position: fixed !important',
    'top: 0 !important',
    'left: 0 !important',
    'width: 0 !important',
    'height: 0 !important',
    'z-index: 2147483647 !important',
    'pointer-events: none !important',
  ].join(';');

  document.body.append(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `${PANEL_STYLES}\n${SHARED_STYLES}`;
  shadow.append(style);

  const mount = document.createElement('div');
  shadow.append(mount);

  syncTheme(shadow.host as HTMLElement);
  watchTheme(shadow.host as HTMLElement);

  createRoot(mount).render(
    <StrictMode>
      <PanelShell />
    </StrictMode>,
  );
}

/**
 * Mirrors Roblox's own theme onto the shadow host.
 *
 * Read from the page rather than from `prefers-color-scheme`: someone running Roblox in
 * dark mode on a light OS should get a dark panel, because the panel is sitting on top of
 * their dark page.
 */
function syncTheme(host: HTMLElement): void {
  const source = document.querySelector('.dark-theme, .light-theme');
  const dark = source
    ? source.classList.contains('dark-theme')
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  host.classList.toggle('rc-dark', dark);
}

function watchTheme(host: HTMLElement): void {
  const observer = new MutationObserver(() => syncTheme(host));
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
    subtree: true,
  });
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => syncTheme(host));
}
