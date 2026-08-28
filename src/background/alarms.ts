import {
  PRESENCE_ALARM_NAME,
  PRESENCE_POLL_IDLE_MINUTES,
  PRUNE_ALARM_MINUTES,
  PRUNE_ALARM_NAME,
  STORAGE_KEYS,
} from '../config/constants';
import type { AppContext } from './context';
import { followPresence } from './handlers/playtimeFollow';

/**
 * Creates the recurring alarms. The listener is NOT registered here - see handleAlarm.
 *
 * Only prunes reports the user never acted on: anything actually flagged is their record
 * of what happened and is kept indefinitely.
 */
export function registerAlarms(context: AppContext): void {
  chrome.alarms.create(PRUNE_ALARM_NAME, { periodInMinutes: PRUNE_ALARM_MINUTES });
  void syncPresenceAlarm(context);
}

/**
 * Runs whichever alarm fired.
 *
 * Called from a listener registered synchronously at the top of the service worker, and
 * that placement is load-bearing: MV3 tears the worker down when idle and dispatches a
 * waking event only to listeners present after the script has evaluated. Registering
 * inside this function - which runs after the context has been built, several awaits
 * later - meant an alarm that woke the worker could find nobody listening. Nothing failed
 * loudly; the maintenance sweep simply did not always happen.
 */
export async function handleAlarm(context: AppContext, alarm: chrome.alarms.Alarm): Promise<void> {
  if (alarm.name === PRESENCE_ALARM_NAME) {
    await runPresenceFollow(context);
    return;
  }
  if (alarm.name !== PRUNE_ALARM_NAME) return;

  await pruneAll(context);
  // A session the user never closed would otherwise accrue forever.
  await context.playtime.closeStale();
}

/**
 * Creates the presence alarm only while the setting is on, and clears it the moment it is
 * switched off.
 *
 * An alarm that fires every five minutes to read a setting and return would be a small
 * cost paid forever by everyone who never wanted the feature. Called at worker start and
 * again whenever settings change.
 */
export async function syncPresenceAlarm(context: AppContext): Promise<void> {
  const settings = await context.settings.get();
  const wanted = settings.features.playtime && settings.playtime.followPresence;

  if (!wanted) {
    await chrome.alarms.clear(PRESENCE_ALARM_NAME);
    return;
  }

  const existing = await chrome.alarms.get(PRESENCE_ALARM_NAME);
  if (existing) return;
  chrome.alarms.create(PRESENCE_ALARM_NAME, {
    periodInMinutes: PRESENCE_POLL_IDLE_MINUTES,
    // A minute out, so switching the setting on does not fire a request in the same
    // instant the user is still reading what it does.
    delayInMinutes: 1,
  });
}

/**
 * Polls, then re-arms at whatever rate the answer justifies.
 *
 * Chrome alarms have one period, so changing the rate means replacing the alarm. Doing it
 * here rather than at a fixed rate is what keeps an idle browser at one request every
 * five minutes while a live session gets one a minute.
 */
async function runPresenceFollow(context: AppContext): Promise<void> {
  let minutes = PRESENCE_POLL_IDLE_MINUTES;
  try {
    minutes = await followPresence(context);
  } catch {
    // Never let a failed poll kill the alarm: it would stop tracking silently, which is
    // the one failure mode a time tracker must not have.
  }
  const settings = await context.settings.get();
  if (!settings.features.playtime || !settings.playtime.followPresence) {
    await chrome.alarms.clear(PRESENCE_ALARM_NAME);
    return;
  }
  chrome.alarms.create(PRESENCE_ALARM_NAME, { periodInMinutes: minutes });
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
