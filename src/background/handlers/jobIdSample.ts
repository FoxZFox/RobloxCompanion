import { STORAGE_KEYS } from '../../config/constants';
import type { HistoryEntry } from '../../models/messages';
import type { AppContext } from '../context';

/** Enough ids to see a pattern; more would only make the same point more slowly. */
const SAMPLE_LIMIT = 200;

/**
 * Real Roblox job ids to inspect, from wherever we already have some.
 *
 * The first version of the job-id check read the loaded server list out of AppState, and
 * on the settings page that list is always empty - the active tab is the settings page,
 * so the state built for it has no experience and no servers. The check reported "0
 * servers loaded" to a user who had a server list open in another tab.
 *
 * So it asks the service worker instead, which holds every scan of this session, and
 * falls back to stored join history - which survives the worker sleeping, and is made of
 * ids that came from Roblox just the same.
 */
export async function collectJobIdSample(context: AppContext): Promise<string[]> {
  const ids = new Set(context.scannedJobIds(SAMPLE_LIMIT));
  if (ids.size >= SAMPLE_LIMIT) return [...ids];

  const stored = await chrome.storage.local.get(null);
  const prefix = STORAGE_KEYS.history('');

  for (const [key, value] of Object.entries(stored)) {
    if (!key.startsWith(prefix) || !Array.isArray(value)) continue;
    for (const entry of value as HistoryEntry[]) {
      if (typeof entry?.jobId === 'string' && entry.jobId) ids.add(entry.jobId);
      if (ids.size >= SAMPLE_LIMIT) return [...ids];
    }
  }

  return [...ids];
}
