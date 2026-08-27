import { useCallback, useEffect, useRef, useState } from 'react';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

const MIN_SIZE: Size = { width: 320, height: 260 };
const EDGE_MARGIN = 8;

/**
 * Keeps the panel on screen.
 *
 * Without this a window dragged to the edge and then reopened on a smaller display, or
 * after the browser is resized, would be stranded off-viewport with no way to reach its
 * title bar. Clamping on every read makes that unreachable state impossible.
 */
export function clampToViewport(point: Point, size: Size): Point {
  const maxX = Math.max(EDGE_MARGIN, window.innerWidth - size.width - EDGE_MARGIN);
  const maxY = Math.max(EDGE_MARGIN, window.innerHeight - size.height - EDGE_MARGIN);
  return {
    x: Math.min(Math.max(EDGE_MARGIN, point.x), maxX),
    y: Math.min(Math.max(EDGE_MARGIN, point.y), maxY),
  };
}

/** A sensible first position: lower-right, clear of the launcher. */
export function defaultPosition(size: Size): Point {
  return clampToViewport(
    { x: window.innerWidth - size.width - 18, y: window.innerHeight - size.height - 70 },
    size,
  );
}

export interface DragState {
  position: Point;
  size: Size;
  dragging: boolean;
  resizing: boolean;
  startDrag: (event: React.PointerEvent) => void;
  startResize: (event: React.PointerEvent) => void;
}

/**
 * Pointer-driven drag and resize.
 *
 * `onSettled` fires on release, never during the gesture. Position lives in component
 * state while the pointer is down so dragging stays at frame rate, and only the final
 * resting place is handed upward to be persisted - routing every pointermove through the
 * service worker would make the window lag behind the cursor and write hundreds of times
 * for a single drag.
 */
export function useDraggable(
  initial: Point | null,
  initialSize: Size,
  onSettled: (position: Point, size: Size) => void,
): DragState {
  const [size, setSize] = useState<Size>(initialSize);
  const [position, setPosition] = useState<Point>(() =>
    initial ? clampToViewport(initial, initialSize) : defaultPosition(initialSize),
  );
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);

  const origin = useRef<{ pointer: Point; value: Point | Size }>({
    pointer: { x: 0, y: 0 },
    value: { x: 0, y: 0 },
  });

  const startDrag = useCallback(
    (event: React.PointerEvent) => {
      // Ignore drags started on a control inside the title bar.
      if ((event.target as HTMLElement).closest('button')) return;
      event.preventDefault();
      origin.current = { pointer: { x: event.clientX, y: event.clientY }, value: position };
      setDragging(true);
    },
    [position],
  );

  const startResize = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      origin.current = { pointer: { x: event.clientX, y: event.clientY }, value: size };
      setResizing(true);
    },
    [size],
  );

  useEffect(() => {
    if (!dragging && !resizing) return;

    const onMove = (event: PointerEvent): void => {
      const dx = event.clientX - origin.current.pointer.x;
      const dy = event.clientY - origin.current.pointer.y;

      if (dragging) {
        const from = origin.current.value as Point;
        setPosition(clampToViewport({ x: from.x + dx, y: from.y + dy }, size));
      } else {
        const from = origin.current.value as Size;
        setSize({
          width: Math.max(MIN_SIZE.width, Math.min(window.innerWidth - 24, from.width + dx)),
          height: Math.max(MIN_SIZE.height, Math.min(window.innerHeight - 24, from.height + dy)),
        });
      }
    };

    const onUp = (): void => {
      setDragging(false);
      setResizing(false);
    };

    // Bound to the window so the gesture survives the pointer leaving the panel,
    // including crossing over Roblox's own elements.
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, resizing, size]);

  // Persist only once the gesture ends.
  const gestured = useRef(false);
  useEffect(() => {
    if (dragging || resizing) {
      gestured.current = true;
      return;
    }
    if (!gestured.current) return;
    gestured.current = false;
    onSettled(position, size);
  }, [dragging, resizing, position, size, onSettled]);

  // A browser resize can strand the panel off-screen; pull it back.
  useEffect(() => {
    const onResize = (): void => setPosition((current) => clampToViewport(current, size));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [size]);

  return { position, size, dragging, resizing, startDrag, startResize };
}
