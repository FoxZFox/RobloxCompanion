export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout: () => Error,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(onTimeout()), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Rate gate for user-triggered refreshes. Exposes when the next call becomes allowed
 * so the UI can render a countdown instead of silently swallowing clicks.
 */
export class ThrottleGate {
  private nextAllowedAt = 0;

  constructor(private readonly intervalMs: number) {}

  get availableAt(): number {
    return this.nextAllowedAt;
  }

  tryTake(now = Date.now()): boolean {
    if (now < this.nextAllowedAt) return false;
    this.nextAllowedAt = now + this.intervalMs;
    return true;
  }

  reset(): void {
    this.nextAllowedAt = 0;
  }
}

/** Serializes async work per key, so two surfaces cannot start the same scan twice. */
export class KeyedMutex {
  private readonly chains = new Map<string, Promise<unknown>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(key) ?? Promise.resolve();
    const next = prev.then(task, task);
    this.chains.set(
      key,
      next.catch(() => undefined),
    );
    return next;
  }
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

let idCounter = 0;
export function nextId(prefix = 'r'): string {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}`;
}
