type Handler = () => void;

const handlers = new Set<Handler>();
let observer: MutationObserver | null = null;
let scheduled = false;

/**
 * One shared observer over the whole document with a registry of callbacks, rather than
 * an observer per feature. Callbacks are coalesced into a microtask because Roblox's
 * React tree can emit hundreds of mutations while hydrating a single page.
 */
export function observeDom(handler: Handler): () => void {
  handlers.add(handler);
  handler();

  if (!observer) {
    observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        for (const fn of handlers) {
          try {
            fn();
          } catch {
            // One broken watcher must never take down the others (spec section 38).
          }
        }
      });
    });
    observer.observe(document.documentElement, { subtree: true, childList: true });
  }

  return () => {
    handlers.delete(handler);
    if (handlers.size === 0 && observer) {
      observer.disconnect();
      observer = null;
    }
  };
}

/** First selector in priority order that currently matches. */
export function findAny(selectors: readonly string[]): HTMLElement | null {
  for (const selector of selectors) {
    const found = document.querySelector<HTMLElement>(selector);
    if (found) return found;
  }
  return null;
}

/** Resolves with the first matching element, or null once the deadline passes. */
export function waitForAny(
  selectors: readonly string[],
  timeoutMs: number,
): Promise<HTMLElement | null> {
  const existing = findAny(selectors);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      stop();
      resolve(null);
    }, timeoutMs);

    const stop = observeDom(() => {
      const found = findAny(selectors);
      if (!found) return;
      clearTimeout(timer);
      stop();
      resolve(found);
    });
  });
}

/**
 * roblox.com still serves full page loads for most navigations, but Roblox has been
 * migrating to a client-side router, so react to history changes rather than assuming
 * a reload will re-run the content script.
 */
export function onLocationChange(handler: Handler): void {
  let lastHref = window.location.href;
  const fire = (): void => {
    if (window.location.href === lastHref) return;
    lastHref = window.location.href;
    handler();
  };

  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method];
    history[method] = function patched(this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args);
      fire();
      return result;
    };
  }
  window.addEventListener('popstate', fire);
}
