import type { CustomFlag } from '../../models/flags';
import type { AppContext } from '../context';

/**
 * A scoped flag belongs to the experience the user is looking at; an unscoped one
 * applies everywhere. That choice is made once at creation because moving a flag between
 * scopes later would orphan it from the servers already carrying it.
 */
export async function create(
  context: AppContext,
  input: { name: string; icon: string; avoid: boolean; scoped: boolean },
  placeId: string | undefined,
): Promise<CustomFlag> {
  return context.flags.create({
    name: input.name,
    icon: input.icon,
    avoid: input.avoid,
    ...(input.scoped && placeId ? { placeId } : {}),
  });
}

export async function update(
  context: AppContext,
  id: string,
  patch: Partial<Omit<CustomFlag, 'id'>>,
): Promise<void> {
  await context.flags.update(id, patch);
}

/**
 * Deleting a flag also strips it from every server that carried it.
 *
 * Leaving the id behind would be worse than untidy: a server would keep an invisible
 * mark that still influenced avoid rules, with nothing in the UI to explain why the
 * server was being skipped.
 */
export async function remove(
  context: AppContext,
  id: string,
  placeId: string | undefined,
): Promise<void> {
  await context.flags.remove(id);
  for (const known of context.knownPlaceIds(placeId)) {
    await context.reports.purgeCustomFlag(known, id);
  }
}

export async function toggleOnServer(
  context: AppContext,
  placeId: string,
  jobId: string,
  flagId: string,
  applied: boolean,
): Promise<void> {
  await context.reports.toggleCustomFlag(placeId, jobId, flagId, applied);
}
