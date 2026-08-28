/**
 * Which tool the arrow keys move to, as arithmetic rather than as DOM work.
 *
 * Split out so the rule can be tested without React or a browser, the same way the
 * scoring and filter logic is (spec section 46). The caller does the focusing.
 */
export function nextToolIndex(key: string, current: number, count: number): number | null {
  if (count === 0) return null;

  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      // Wrapping, so the rail has no dead end at either extreme.
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
