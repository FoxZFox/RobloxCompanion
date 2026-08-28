/**
 * Where the arrow keys move within a roving group, as arithmetic rather than DOM work.
 *
 * Shared by the two places that use the tabs pattern - the panel's tool rail and the
 * popup's section tabs - so both wrap, both honour Home and End, and neither has its own
 * slightly different idea of what Left does. It lives in utils rather than beside the
 * panel because the panel is content-script code: a page bundle importing from there
 * would silently pull whatever that folder grows into.
 *
 * The caller does the focusing; this only says where to go (spec section 46).
 */
export function nextRovingIndex(key: string, current: number, count: number): number | null {
  if (count === 0) return null;

  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      // Wrapping, so neither the rail nor the tab row has a dead end at either extreme.
      return (current + 1 + count) % count;
    case 'ArrowUp':
    case 'ArrowLeft':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
