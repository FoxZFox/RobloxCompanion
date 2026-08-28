import { beforeEach, describe, expect, it } from 'vitest';
import { clampToViewport, defaultPosition } from './useDraggable';
import { nextToolIndex } from './railNavigation';

const VIEWPORT = { width: 1280, height: 800 };
const SIZE = { width: 420, height: 560 };

beforeEach(() => {
  // The hook reads window directly; vitest runs in node, so stand one up.
  (globalThis as { window?: unknown }).window = {
    innerWidth: VIEWPORT.width,
    innerHeight: VIEWPORT.height,
  };
});

describe('clampToViewport', () => {
  it('leaves a position that already fits alone', () => {
    expect(clampToViewport({ x: 300, y: 200 }, SIZE)).toEqual({ x: 300, y: 200 });
  });

  it('pulls a panel back from beyond the right and bottom edges', () => {
    // The case that matters: a window dragged to the edge on a large display, then
    // reopened on a small one, would otherwise be stranded with its title bar off-screen
    // and no way to drag it back.
    const clamped = clampToViewport({ x: 5000, y: 5000 }, SIZE);
    expect(clamped.x).toBe(VIEWPORT.width - SIZE.width - 8);
    expect(clamped.y).toBe(VIEWPORT.height - SIZE.height - 8);
  });

  it('pulls a panel back from negative coordinates', () => {
    expect(clampToViewport({ x: -400, y: -400 }, SIZE)).toEqual({ x: 8, y: 8 });
  });

  it('keeps the panel reachable even when it is larger than the viewport', () => {
    const huge = { width: 4000, height: 4000 };
    const clamped = clampToViewport({ x: 1000, y: 1000 }, huge);
    // Pinned to the margin rather than pushed off-screen by a negative maximum.
    expect(clamped.x).toBe(8);
    expect(clamped.y).toBe(8);
  });

  it('is idempotent, so repeated clamping never drifts', () => {
    const once = clampToViewport({ x: 9999, y: -50 }, SIZE);
    expect(clampToViewport(once, SIZE)).toEqual(once);
  });
});

describe('defaultPosition', () => {
  it('places a new panel inside the viewport', () => {
    const point = defaultPosition(SIZE);
    expect(point.x).toBeGreaterThanOrEqual(8);
    expect(point.y).toBeGreaterThanOrEqual(8);
    expect(point.x + SIZE.width).toBeLessThanOrEqual(VIEWPORT.width);
    expect(point.y + SIZE.height).toBeLessThanOrEqual(VIEWPORT.height);
  });

  it('sits clear of the launcher in the lower-right corner', () => {
    const point = defaultPosition(SIZE);
    expect(point.x).toBeGreaterThan(VIEWPORT.width / 2);
  });

  it('still lands on screen in a small viewport', () => {
    (globalThis as { window?: unknown }).window = { innerWidth: 500, innerHeight: 400 };
    const point = defaultPosition(SIZE);
    expect(point.x).toBeGreaterThanOrEqual(8);
    expect(point.y).toBeGreaterThanOrEqual(8);
  });
});

describe('nextToolIndex', () => {
  it('moves down and up the rail', () => {
    expect(nextToolIndex('ArrowDown', 0, 6)).toBe(1);
    expect(nextToolIndex('ArrowUp', 3, 6)).toBe(2);
  });

  it('wraps at both ends, so the rail has no dead end', () => {
    expect(nextToolIndex('ArrowDown', 5, 6)).toBe(0);
    expect(nextToolIndex('ArrowUp', 0, 6)).toBe(5);
  });

  it('treats left and right the same as up and down', () => {
    // The rail is vertical, but a keyboard user reaching for the arrows should not have
    // to work out which pair this particular list wants.
    expect(nextToolIndex('ArrowRight', 0, 6)).toBe(1);
    expect(nextToolIndex('ArrowLeft', 0, 6)).toBe(5);
  });

  it('jumps to the ends with Home and End', () => {
    expect(nextToolIndex('Home', 4, 6)).toBe(0);
    expect(nextToolIndex('End', 1, 6)).toBe(5);
  });

  it('ignores every other key, so typing still reaches the page', () => {
    expect(nextToolIndex('a', 0, 6)).toBeNull();
    expect(nextToolIndex('Tab', 0, 6)).toBeNull();
    expect(nextToolIndex('Enter', 0, 6)).toBeNull();
  });

  it('does nothing when the rail is empty', () => {
    expect(nextToolIndex('ArrowDown', -1, 0)).toBeNull();
  });

  it('starts from the first tool when none is active', () => {
    // findIndex returns -1 when the stored tool no longer exists - a feature switched off
    // while the panel was closed - and the rail still has to move somewhere sensible.
    expect(nextToolIndex('ArrowDown', -1, 6)).toBe(0);
  });
});
