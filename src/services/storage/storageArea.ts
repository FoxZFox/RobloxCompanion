/**
 * The slice of chrome.storage the repositories actually use.
 *
 * Narrowing it to an interface is what lets every repository be unit-tested with
 * `new MemoryStorageArea()` instead of a browser (spec section 46).
 */
export interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export const chromeStorage: StorageArea = {
  get: (key) => chrome.storage.local.get(key),
  set: (items) => chrome.storage.local.set(items),
  remove: (key) => chrome.storage.local.remove(key),
};

/** In-memory stand-in for tests. */
export class MemoryStorageArea implements StorageArea {
  private readonly data = new Map<string, unknown>();

  async get(key: string): Promise<Record<string, unknown>> {
    return this.data.has(key) ? { [key]: this.data.get(key) } : {};
  }

  async set(items: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(items)) this.data.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }

  get size(): number {
    return this.data.size;
  }
}

/**
 * Shared read/write plumbing. Repositories hold their own in-memory cache on top of
 * this and write through on change: user actions (flagging a server, adding to the
 * blacklist) are written immediately because losing one would break trust in the tool,
 * while per-scan sweeps are batched into a single write.
 */
export abstract class BaseRepository {
  constructor(protected readonly storage: StorageArea) {}

  protected async readRaw<T>(key: string): Promise<T | undefined> {
    const bag = await this.storage.get(key);
    return bag[key] as T | undefined;
  }

  protected async writeRaw<T>(key: string, value: T): Promise<void> {
    await this.storage.set({ [key]: value });
  }

  protected async removeRaw(key: string): Promise<void> {
    await this.storage.remove(key);
  }
}
