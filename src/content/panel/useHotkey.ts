import { useEffect } from 'react';

/**
 * Global Ctrl+K / Cmd+K listener (spec section 40).
 *
 * Captured on the document so it works wherever the user's focus happens to be on the
 * Roblox page, and `preventDefault` is essential rather than tidy: Ctrl+K is bound to
 * the browser's own search box, so without it the address bar steals the keystroke and
 * the palette never opens.
 *
 * Typing into an input is left alone. Someone mid-way through a Roblox search box or our
 * own note field means to type a character, not to summon a palette.
 */
export function usePaletteHotkey(onOpen: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'k' && event.key !== 'K') return;
      if (!event.ctrlKey && !event.metaKey) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;

      event.preventDefault();
      event.stopPropagation();
      onOpen();
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onOpen, enabled]);
}
