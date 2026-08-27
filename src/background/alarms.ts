import { PRUNE_ALARM_MINUTES, PRUNE_ALARM_NAME, STORAGE_KEYS } from '../config/constants';
import type { AppContext } from './context';

/**
 * Periodic maintenance. Only prunes reports the user never acted on: anything actually
 * flagged is their record of what happened and is kept indefinitely.
 */
export function registerAlarms(context: AppContext): void {
  chrome.alarms.create(PRUNE_ALARM_NAME, { periodInMinutes: PRUNE_ALARM_MINUTES });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== PRUNE_ALARM_NAME) return;
    void pruneAll(context);
    // A session the user never closed would otherwise accrue forever.
    void context.playtime.closeStale();
  });
}

async function pruneAll(context: AppContext): Promise<void> {
  const everything = await chrome.storage.local.get(null);
  const prefix = STORAGE_KEYS.reports('');

  for (const key of Object.keys(everything)) {
    if (!key.startsWith(prefix)) continue;
    const placeId = key.slice(prefix.length);
    if (!placeId) continue;
    try {
      await context.reports.pruneStale(placeId);
    } catch {
      // A single bad place must not stop the sweep.
    }
  }
}
