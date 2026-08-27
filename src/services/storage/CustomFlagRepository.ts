import { STORAGE_KEYS } from '../../config/constants';
import type { CustomFlag, CustomFlagMap } from '../../models/flags';
import { MAX_FLAG_NAME_LENGTH } from '../../models/flags';
import { BaseRepository } from './storageArea';

let counter = 0;

/** Ids are opaque and local; they only have to be unique within this machine. */
function nextFlagId(): string {
  counter += 1;
  return `flag_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export class CustomFlagRepository extends BaseRepository {
  private cache: CustomFlagMap | null = null;

  async getAll(): Promise<CustomFlagMap> {
    if (this.cache) return this.cache;
    this.cache = (await this.readRaw<CustomFlagMap>(STORAGE_KEYS.customFlags)) ?? {};
    return this.cache;
  }

  async list(): Promise<CustomFlag[]> {
    return Object.values(await this.getAll()).sort((a, b) => a.createdAt - b.createdAt);
  }

  async create(input: {
    name: string;
    icon: string;
    avoid: boolean;
    placeId?: string;
  }): Promise<CustomFlag> {
    const all = await this.getAll();
    const flag: CustomFlag = {
      id: nextFlagId(),
      name: input.name.trim().slice(0, MAX_FLAG_NAME_LENGTH),
      icon: input.icon,
      avoid: input.avoid,
      createdAt: Date.now(),
    };
    if (input.placeId) flag.placeId = input.placeId;

    all[flag.id] = flag;
    await this.persist(all);
    return flag;
  }

  async update(id: string, patch: Partial<Omit<CustomFlag, 'id'>>): Promise<void> {
    const all = await this.getAll();
    const existing = all[id];
    if (!existing) return;
    const next: CustomFlag = { ...existing, ...patch, id };
    if (patch.name !== undefined) next.name = patch.name.trim().slice(0, MAX_FLAG_NAME_LENGTH);
    all[id] = next;
    await this.persist(all);
  }

  async remove(id: string): Promise<void> {
    const all = await this.getAll();
    delete all[id];
    await this.persist(all);
  }

  async replaceAll(flags: CustomFlag[]): Promise<void> {
    const all: CustomFlagMap = {};
    for (const flag of flags) all[flag.id] = flag;
    await this.persist(all);
  }

  private async persist(all: CustomFlagMap): Promise<void> {
    this.cache = all;
    await this.writeRaw(STORAGE_KEYS.customFlags, all);
  }
}
